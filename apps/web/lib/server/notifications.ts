import "server-only";
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { and, asc, eq, gt, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@sbt/data/db/client";
import { digestDeliveries, subscriptionSeen, subscriptions } from "@sbt/data/db/schema";
import { placeHref, whereParsers, type Where } from "@/lib/filters";
import { formatDayMonth, formatNumber, unitsNoun } from "@/lib/format";
import { DIGEST_LOOKBACK_DAYS, DIGEST_MAX_ITEMS, radiusLabel, RADIUS_MILES } from "@/lib/rules";
import { getMovement, type Movement, type MovementKind } from "./movement";
import { getPlace } from "./places";
import { seattleDate } from "./today";

/**
 * Email updates about a place (SPEC P6). Someone asks for updates on a place report, confirms
 * through an emailed link, and then gets one email after each nightly sync that finds new
 * movement there. Movement is the same list the place report shows (movement.ts); each
 * subscription remembers which movements it has been sent, so a movement the City records
 * late (with an earlier date) is still sent once, and nothing is sent twice.
 *
 * Mail goes through Resend. Configure APP_URL, RESEND_API_KEY, EMAIL_FROM and
 * SUBSCRIPTION_SECRET; without them signup is hidden and digests are skipped.
 */

export type SubscriptionStatus = "check-email" | "confirmed" | "unsubscribed" | "invalid" | "invalid-link" | "unavailable";

/** A place someone can subscribe to, as posted by the form on a place report. */
export type PlaceInput = { hood?: string | null; center?: string | null; lat?: number | null; lng?: number | null; r?: number | null; label?: string | null };

const CONFIRM_TTL_MS = 48 * 60 * 60_000;
const RESEND_COOLDOWN_MS = 10 * 60_000;
/** Confirmation emails one address can be sent per hour, across places. */
const MAX_PENDING_PER_HOUR = 5;
const SEND_GAP_MS = 600; // Resend allows a couple of requests a second.

export class InvalidEmailError extends Error {}
export class InvalidPlaceError extends Error {}

export const notificationsConfigured = () =>
  Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM && process.env.SUBSCRIPTION_SECRET && siteOrigin());

/** The public origin for links in emails. */
export function siteOrigin(): string | null {
  const url = process.env.APP_URL || (process.env.RAILWAY_PUBLIC_DOMAIN && `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

const origin = () => {
  const o = siteOrigin();
  if (!o) throw new Error("APP_URL is required for email links");
  return o;
};
const secret = () => {
  const s = process.env.SUBSCRIPTION_SECRET;
  if (!s) throw new Error("SUBSCRIPTION_SECRET is required");
  return s;
};
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new InvalidEmailError("Invalid email address");
  return email;
}

/** Signs an unsubscribe link for one subscription. */
export function unsubscribeSignature(id: string, email: string): string {
  return createHmac("sha256", secret()).update(`unsubscribe:${id}:${email}`).digest("hex");
}

export function unsubscribeUrl(id: string, email: string): string {
  return `${origin()}/unsubscribe?id=${encodeURIComponent(id)}&signature=${unsubscribeSignature(id, email)}`;
}

/** Resolves a posted place to its report, ignoring any name the client sent for a known place. */
export async function resolvePlace(input: PlaceInput): Promise<{ where: Where; path: string; name: string }> {
  const slug = input.hood ?? input.center;
  if (slug) {
    const place = /^[a-z0-9-]{1,80}$/.test(slug) ? await getPlace(slug) : null;
    if (!place || (input.hood && place.kind !== "neighborhood") || (input.center && place.kind !== "center"))
      throw new InvalidPlaceError("Unknown place");
    return {
      where: place.kind === "neighborhood" ? { hood: place.id } : { center: place.id },
      path: placeHref(place),
      name: place.name,
    };
  }
  const lat = whereParsers.lat.parse(String(input.lat ?? ""));
  const lng = whereParsers.lng.parse(String(input.lng ?? ""));
  const r = whereParsers.r.parse(String(input.r ?? ""));
  const label = input.label?.trim();
  if (lat == null || lng == null || r == null || !(RADIUS_MILES as readonly number[]).includes(r) || !label || label.length > 120)
    throw new InvalidPlaceError("Unknown place");
  const rounded = { lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)), r };
  return { where: rounded, path: placeHref({ ...rounded, label }), name: `${radiusLabel(r)} around ${label}` };
}

export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  idempotencyKey: string,
  headers: Record<string, string> = {},
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error("RESEND_API_KEY and EMAIL_FROM are required");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ from, to: [to], subject, text, headers }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Email provider returned ${response.status}: ${await response.text()}`);
}

/** Movements of a place's report that a digest can mention, keyed as they're remembered. */
async function recentMovement(where: Where, today: string): Promise<{ key: string; move: Movement }[]> {
  const moves = await getMovement(where, today, { days: DIGEST_LOOKBACK_DAYS });
  return moves.map((move) => ({ key: `${move.projectKey}:${move.kind}:${move.date}`, move }));
}

async function markSeen(subscriptionId: string, keys: string[]) {
  for (let i = 0; i < keys.length; i += 1_000) {
    const values = keys.slice(i, i + 1_000).map((itemKey) => ({ subscriptionId, itemKey }));
    if (values.length) await db.insert(subscriptionSeen).values(values).onConflictDoNothing();
  }
}

/**
 * Starts a subscription and emails a confirmation link. Repeating it for a confirmed
 * subscription does nothing; for a pending one it re-sends at most every few minutes.
 */
export async function requestSubscription(rawEmail: string, input: PlaceInput): Promise<void> {
  if (!notificationsConfigured()) throw new Error("Email updates are not configured");
  const email = normalizeEmail(rawEmail);
  const place = await resolvePlace(input);
  const [existing] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.email, email), eq(subscriptions.placePath, place.path)))
    .limit(1);
  if (existing?.confirmedAt) return;
  const now = Date.now();
  if (existing?.confirmationRequestedAt && now - Date.parse(existing.confirmationRequestedAt) < RESEND_COOLDOWN_MS) return;
  const [recent] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.email, email),
        isNull(subscriptions.confirmedAt),
        gt(subscriptions.confirmationRequestedAt, new Date(now - 60 * 60_000).toISOString()),
      ),
    );
  if ((recent?.n ?? 0) >= MAX_PENDING_PER_HOUR) return;

  const token = randomBytes(32).toString("hex");
  const requestedAt = new Date(now).toISOString();
  const [row] = await db
    .insert(subscriptions)
    .values({
      id: randomUUID(),
      email,
      placePath: place.path,
      placeName: place.name,
      place: place.where,
      confirmationTokenHash: tokenHash(token),
      confirmationRequestedAt: requestedAt,
    })
    .onConflictDoUpdate({
      target: [subscriptions.email, subscriptions.placePath],
      set: { placeName: place.name, place: place.where, confirmationTokenHash: tokenHash(token), confirmationRequestedAt: requestedAt },
    })
    .returning();
  const link = `${origin()}/subscribe/confirm?token=${token}`;
  try {
    await sendEmail(
      email,
      `Confirm housing updates for ${place.name}`,
      [
        `Confirm your email to get housing updates for ${place.name} from the Seattle Building Tracker:`,
        "",
        link,
        "",
        "You'll get one email after the nightly check of the City's permit data whenever projects there move: apply, get issued, complete, expire or die.",
        "",
        "If you didn't ask for this, ignore this email and nothing will be sent.",
      ].join("\n"),
      `confirm/${tokenHash(token)}`,
    );
  } catch (error) {
    // Let the person try again right away.
    await db
      .update(subscriptions)
      .set({ confirmationRequestedAt: null })
      .where(and(eq(subscriptions.id, row!.id), eq(subscriptions.confirmationTokenHash, tokenHash(token))));
    throw error;
  }
}

/**
 * Confirms a subscription. Everything already in the place's movement counts as seen, so the
 * first digest only has what moved after signing up. Returns the place's path, or null.
 */
export async function confirmSubscription(token: string, today = seattleDate(new Date())): Promise<string | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.confirmationTokenHash, tokenHash(token))).limit(1);
  if (!sub?.confirmationRequestedAt || Date.now() - Date.parse(sub.confirmationRequestedAt) > CONFIRM_TTL_MS) return null;
  const baseline = await recentMovement(sub.place, today);
  await markSeen(
    sub.id,
    baseline.map((b) => b.key),
  );
  await db
    .update(subscriptions)
    .set({ confirmedAt: new Date().toISOString(), confirmationTokenHash: null })
    .where(eq(subscriptions.id, sub.id));
  return sub.placePath;
}

/** Ends a subscription from a signed link. Returns the place's path, or null for a bad link. */
export async function unsubscribe(id: string, signature: string): Promise<string | null> {
  if (!/^[a-f0-9]{64}$/.test(signature)) return null;
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1);
  if (!sub) return null;
  const expected = Buffer.from(unsubscribeSignature(sub.id, sub.email), "hex");
  if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) return null;
  await db.delete(subscriptions).where(eq(subscriptions.id, sub.id));
  return sub.placePath;
}

const KIND_TEXT: Record<MovementKind, string> = {
  applied: "Applied",
  issued: "Issued",
  completed: "Completed",
  expired: "Permit expired",
  died: "Died",
};

export function digestText(sub: { placeName: string; placePath: string }, moves: Movement[], unsubscribe: string): {
  subject: string;
  body: string;
} {
  const o = origin();
  const shown = moves.slice(0, DIGEST_MAX_ITEMS);
  const lines = shown.map((m) => {
    const units = m.projectUnits > m.units ? `${formatNumber(m.units)} of ${formatNumber(m.projectUnits)} homes` : unitsNoun(m.units, m.housingType);
    const dated = m.dating === "city" ? formatDayMonth(m.date) : `${formatDayMonth(m.date)} (${m.dating === "noticed" ? "date noticed; the City gives none" : "approximate date"})`;
    return `${KIND_TEXT[m.kind]}: ${m.address ?? m.mainPermit} · ${units} · ${dated}\n${o}/project/${encodeURIComponent(m.mainPermit)}`;
  });
  const more = moves.length - shown.length;
  const n = new Set(moves.map((m) => m.projectKey)).size;
  const subject = `${n} housing project${n === 1 ? "" : "s"} moved in ${sub.placeName}`;
  const body = [
    `New movement in ${sub.placeName} since the last update:`,
    "",
    lines.join("\n\n"),
    ...(more > 0 ? ["", `…and ${more} more.`] : []),
    "",
    `See the whole report: ${o}${sub.placePath}#movement`,
    "",
    "Dates are the City's own milestone dates. Completions are sometimes recorded weeks late.",
    "",
    `Stop these emails: ${unsubscribe}`,
  ].join("\n");
  return { subject, body };
}

/**
 * Sends each confirmed subscription its new movement, once. A digest that fails to send is
 * kept and retried by the next run. Safe to run more than once a day.
 */
export async function sendDigests(
  today = seattleDate(new Date()),
  /** Tests: only these subscriptions. */
  only?: (email: string) => boolean,
): Promise<{ sent: number; failed: number; skipped: number }> {
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const byPlace = new Map<string, Promise<{ key: string; move: Movement }[]>>();
  const subs = await db.select().from(subscriptions).where(isNotNull(subscriptions.confirmedAt)).orderBy(asc(subscriptions.createdAt));
  for (const sub of subs) {
    if (only && !only(sub.email)) continue;
    try {
      let [delivery] = await db
        .select()
        .from(digestDeliveries)
        .where(and(eq(digestDeliveries.subscriptionId, sub.id), isNull(digestDeliveries.sentAt)))
        .orderBy(asc(digestDeliveries.createdAt))
        .limit(1);
      if (!delivery) {
        if (!byPlace.has(sub.placePath)) byPlace.set(sub.placePath, recentMovement(sub.place, today));
        const recent = await byPlace.get(sub.placePath)!;
        const seen = new Set(
          (await db.select({ k: subscriptionSeen.itemKey }).from(subscriptionSeen).where(eq(subscriptionSeen.subscriptionId, sub.id))).map(
            (r) => r.k,
          ),
        );
        const fresh = recent.filter((r) => !seen.has(r.key));
        if (!fresh.length) {
          skipped++;
          continue;
        }
        const { subject, body } = digestText(
          sub,
          fresh.map((f) => f.move),
          unsubscribeUrl(sub.id, sub.email),
        );
        [delivery] = await db
          .insert(digestDeliveries)
          .values({ id: randomUUID(), subscriptionId: sub.id, itemKeys: fresh.map((f) => f.key), subject, body })
          .returning();
      }
      const unsub = unsubscribeUrl(sub.id, sub.email);
      await sendEmail(sub.email, delivery!.subject, delivery!.body, `digest/${delivery!.id}`, {
        "List-Unsubscribe": `<${unsub}>`,
      });
      await db.update(digestDeliveries).set({ sentAt: new Date().toISOString() }).where(eq(digestDeliveries.id, delivery!.id));
      await markSeen(sub.id, delivery!.itemKeys);
      sent++;
      await new Promise((r) => setTimeout(r, SEND_GAP_MS));
    } catch (error) {
      failed++;
      console.error(`Could not send the digest for subscription ${sub.id}`, error);
    }
  }
  return { sent, failed, skipped };
}
