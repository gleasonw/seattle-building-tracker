/**
 * Email updates (SPEC P6), end to end against the local database with the email provider
 * stubbed: signup → confirmation email → confirm (baseline) → digest of only new movement →
 * nothing twice → retry after a failed send → unsubscribe.
 */
import { eq, like } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { db, sql } from "@sbt/data/db/client";
import { digestDeliveries, subscriptions } from "@sbt/data/db/schema";
import { getMovement, shiftDays } from "@/lib/server/movement";
import {
  confirmSubscription,
  requestSubscription,
  unitLines,
  sendDigests,
  unsubscribe,
} from "@/lib/server/notifications";

const TODAY = "2026-11-22";
const BASELINE_DAY = shiftDays(TODAY, -21);
const PLACE = { hood: "crown-hill" };
const EMAIL_DOMAIN = "@notifications-test.example";

type Sent = { to: string[]; subject: string; text: string; headers: Record<string, string> };
let sent: Sent[] = [];
let failNext = false;

beforeAll(() => {
  process.env.APP_URL = "https://tracker.test";
  process.env.RESEND_API_KEY = "re_test";
  process.env.EMAIL_FROM = "Tracker <updates@tracker.test>";
  process.env.SUBSCRIPTION_SECRET = "test-secret";
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    expect(url).toBe("https://api.resend.com/emails");
    if (failNext) {
      failNext = false;
      return new Response("provider down", { status: 503 });
    }
    sent.push(JSON.parse(String(init.body)));
    return new Response("{}", { status: 200 });
  });
});
beforeEach(async () => {
  sent = [];
  await db.delete(subscriptions).where(like(subscriptions.email, `%${EMAIL_DOMAIN}`));
});
afterAll(async () => {
  await db.delete(subscriptions).where(like(subscriptions.email, `%${EMAIL_DOMAIN}`));
  vi.unstubAllGlobals();
  await sql.end();
});

const mine = (email: string) => email.endsWith(EMAIL_DOMAIN);
const tokenFrom = (mail: Sent) => /token=([a-f0-9]{64})/.exec(mail.text)![1]!;

test("signup, confirm, digest of new movement only, once, then unsubscribe", async () => {
  const email = `Someone${EMAIL_DOMAIN}`;
  await requestSubscription(email, PLACE);
  expect(sent).toHaveLength(1);
  expect(sent[0]!.to).toEqual([email.toLowerCase()]);
  expect(sent[0]!.subject).toBe("Confirm housing updates for Crown Hill");

  // A second request within minutes doesn't send again.
  await requestSubscription(email, PLACE);
  expect(sent).toHaveLength(1);

  // Unconfirmed: no digest.
  expect((await sendDigests(TODAY, mine)).sent).toBe(0);

  // Confirm three weeks ago: what had moved by then is the baseline.
  const path = await confirmSubscription(tokenFrom(sent[0]!), BASELINE_DAY);
  expect(path).toBe("/place/crown-hill");
  expect(await confirmSubscription(tokenFrom(sent[0]!), BASELINE_DAY)).toBeNull(); // token is single-use

  const before = new Set((await getMovement(PLACE, BASELINE_DAY, { days: 30 })).map((m) => `${m.projectKey}:${m.kind}:${m.date}`));
  const fresh = (await getMovement(PLACE, TODAY, { days: 30 })).filter((m) => !before.has(`${m.projectKey}:${m.kind}:${m.date}`));
  expect(fresh.length).toBeGreaterThan(0); // the local data has movement in Crown Hill in the last three weeks

  sent = [];
  const first = await sendDigests(TODAY, mine);
  expect(first).toMatchObject({ sent: 1, failed: 0 });
  const digest = sent[0]!;
  const projects = new Set(fresh.map((m) => m.projectKey)).size;
  expect(digest.subject).toBe(`${projects} housing project${projects === 1 ? "" : "s"} moved in Crown Hill`);
  for (const m of fresh.slice(0, 40)) {
    expect(digest.text).toContain(`https://tracker.test/project/${encodeURIComponent(m.mainPermit)}`);
    expect(digest.text).toMatch(new RegExp(`${m.permitNums.join(", ")}: (adds|added|would have added) `));
  }
  expect(digest.text).toContain("https://tracker.test/place/crown-hill#movement");
  expect(digest.headers["List-Unsubscribe"]).toMatch(/^<https:\/\/tracker\.test\/unsubscribe\?id=/);

  // Nothing new: nothing sent.
  sent = [];
  expect((await sendDigests(TODAY, mine)).sent).toBe(0);
  expect(sent).toHaveLength(0);

  // Unsubscribe needs the signed link.
  const link = new URL(/Stop these emails: (\S+)/.exec(digest.text)![1]!);
  const id = link.searchParams.get("id")!;
  expect(await unsubscribe(id, "0".repeat(64))).toBeNull();
  expect(await unsubscribe(id, link.searchParams.get("signature")!)).toBe("/place/crown-hill");
  expect(await db.select().from(subscriptions).where(eq(subscriptions.id, id))).toHaveLength(0);
});

test("a failed send is kept and retried with the same content", async () => {
  const email = `retry${EMAIL_DOMAIN}`;
  await requestSubscription(email, PLACE);
  await confirmSubscription(tokenFrom(sent[0]!), BASELINE_DAY);
  sent = [];
  failNext = true;
  vi.spyOn(console, "error").mockImplementationOnce(() => {});
  expect(await sendDigests(TODAY, mine)).toMatchObject({ sent: 0, failed: 1 });
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.email, email));
  const [pending] = await db.select().from(digestDeliveries).where(eq(digestDeliveries.subscriptionId, sub!.id));
  expect(pending?.sentAt).toBeNull();

  expect(await sendDigests(TODAY, mine)).toMatchObject({ sent: 1, failed: 0 });
  expect(sent[0]!.subject).toBe(pending!.subject);
  expect((await sendDigests(TODAY, mine)).sent).toBe(0);
});

test("radius places are canonical and bad input is refused", async () => {
  const email = `radius${EMAIL_DOMAIN}`;
  await requestSubscription(email, { lat: 47.676543219, lng: -122.317, r: 0.5, label: "6716 Roosevelt Way NE" });
  const [row] = await db.select().from(subscriptions).where(eq(subscriptions.email, email));
  expect(row!.placeName).toBe("½ mile around 6716 Roosevelt Way NE");
  expect(row!.placePath).toBe("/near/6716%20Roosevelt%20Way%20NE?lat=47.67654&lng=-122.317&r=0.5");

  await expect(requestSubscription("not-an-email", PLACE)).rejects.toThrow("Invalid email address");
  await expect(requestSubscription(email, { hood: "atlantis" })).rejects.toThrow("Unknown place");
  await expect(requestSubscription(email, { center: "crown-hill" })).rejects.toThrow("Unknown place");
  await expect(requestSubscription(email, { lat: 40, lng: -122.3, r: 0.5, label: "x" })).rejects.toThrow("Unknown place");
});

test("each movement says what its permits add and remove, with the site's demolition and the net", () => {
  const base = {
    projectKey: "p",
    mainPermit: "7000001-CN",
    address: "1 Main St",
    hoodName: null,
    housingType: "townhouse" as const,
    kind: "issued" as const,
    date: "2026-11-10",
    dating: "city" as const,
    permits: 1,
  };
  expect(unitLines({ ...base, units: 2, projectUnits: 2, permitNums: ["7000001-CN"], unitsRemoved: 0, demolitionUnitsRemoved: 0 })).toEqual([
    "  Permit 7000001-CN: adds 2 units, removes none",
  ]);
  expect(unitLines({ ...base, kind: "expired", units: 66, projectUnits: 66, permitNums: ["7000001-CN"], unitsRemoved: 0, demolitionUnitsRemoved: 0 })).toEqual([
    "  Permit 7000001-CN: would have added 66 units, would have removed none",
  ]);
  expect(
    unitLines({ ...base, units: 4, projectUnits: 10, permitNums: ["7000001-CN", "7000002-CN"], unitsRemoved: 1, demolitionUnitsRemoved: 2 }),
  ).toEqual([
    "  Permits 7000001-CN, 7000002-CN: adds 4 units, removes 1 unit",
    "  Demolition on the site: removes 2 units",
    "  Net: +1 unit",
    "  The whole project adds 10 townhouses",
  ]);
});
