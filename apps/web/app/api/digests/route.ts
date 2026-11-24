import { timingSafeEqual } from "node:crypto";
import { notificationsConfigured, sendDigests } from "@/lib/server/notifications";

export const maxDuration = 300;

function authorized(request: Request): boolean {
  const secret = process.env.DIGEST_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

/** Called by the nightly sync once it has merged a snapshot (packages/data/src/sync/run.ts). */
export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!notificationsConfigured()) return Response.json({ skipped: "email updates are not configured" });
  const result = await sendDigests();
  console.log(`Digests: ${result.sent} sent, ${result.failed} failed, ${result.skipped} with nothing new`);
  return Response.json(result, { status: result.failed ? 500 : 200 });
}
