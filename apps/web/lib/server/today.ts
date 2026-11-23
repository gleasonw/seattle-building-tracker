import "server-only";
import { connection } from "next/server";
import { isIsoDate } from "@/lib/filters";

const SEATTLE = "America/Los_Angeles";

/** A date as YYYY-MM-DD in Seattle. */
export function seattleDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SEATTLE, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/**
 * Today in Seattle. In development, `?asof=YYYY-MM-DD` pretends it's another day, to check
 * date-dependent behavior such as January's year in review. Ignored in production.
 */
export async function getToday(asof?: string | null): Promise<string> {
  await connection();
  if (process.env.NODE_ENV !== "production" && asof && isIsoDate(asof)) return asof;
  return seattleDate(new Date());
}
