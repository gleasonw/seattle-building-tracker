import "server-only";
import { sql } from "drizzle-orm";
import { HOUSING_TYPE_LABELS } from "@sbt/data/domain/housing-type";
import type { Filters } from "@/lib/filters";
import { formatDate } from "@/lib/format";
import { radiusLabel, STALLED_ISSUED_YEARS, STALLED_REVIEW_YEARS, EXPIRING_SOON_MONTHS } from "@/lib/rules";
import { query } from "./db";
import { measureOf, UNLOCATED, unitKind } from "./scope";

/** The place part of a description: "in Roosevelt", "within ½ mile of 6716 Roosevelt Way NE". */
export async function describeWhere(f: Filters): Promise<string> {
  const parts: string[] = [];
  const ids = [f.hood, f.center].filter((x): x is string => Boolean(x) && x !== UNLOCATED);
  const names = ids.length
    ? new Map((await query<{ id: string; name: string }>(sql`SELECT id, name FROM places WHERE id IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`)).map((r) => [r.id, r.name]))
    : new Map<string, string>();
  if (f.hood === UNLOCATED) parts.push("with no known location");
  else if (f.hood) parts.push(`in ${names.get(f.hood) ?? f.hood}`);
  if (f.center) parts.push(`in ${names.get(f.center) ?? f.center}`);
  if (f.lat != null && f.lng != null && f.r != null) parts.push(`within ${radiusLabel(f.r)} of ${f.label ?? `${f.lat.toFixed(4)}, ${f.lng.toFixed(4)}`}`);
  return parts.length ? parts.join(" ") : "citywide";
}

/** A sentence saying exactly what a project list counts. */
export async function describe(f: Filters, today: string): Promise<string> {
  const m = measureOf(f);
  const where = await describeWhere(f);
  const type = f.type?.length ? `${f.type.map((t) => HOUSING_TYPE_LABELS[t]).join(", ")} ` : "";
  const range = `from ${formatDate(f.from ?? "1900-01-01")} to ${formatDate(f.to ?? today)}`;
  switch (m) {
    case "completed": {
      const kind = unitKind(f);
      const what =
        kind === "net"
          ? "Net homes completed: units added by building permits completed, minus units removed by demolitions issued and building permits completed,"
          : kind === "added"
            ? `Units added by ${type}building permits completed`
            : "Units removed by demolitions issued and building permits completed";
      return `${what} ${where}, ${range}.`;
    }
    case "issued":
      return `Units on ${type}building permits issued ${where}, ${range}.`;
    case "applied":
      return `Units on ${type}building permits applied for ${where}, ${range}.`;
    case "outcome": {
      if (!f.outcome) return `Units applied for ${where}, ${range}, whatever has happened to them since.`;
      const o = { completed: "since completed", progress: "still in progress", expired: "whose permit has expired", dead: "that died" }[
        f.outcome
      ];
      return `Units applied for ${where}, ${range}, ${o}.`;
    }
    case "pipeline": {
      const stages = f.stage ?? ["review", "issued"];
      const names = { review: "in review", issued: "issued and not completed", expired: "past their permit's expiry while the City still lists them as issued" };
      const stage = stages.map((s) => names[s]).join(" or ");
      const counted = stages.includes("expired")
        ? " Projects whose permit has expired aren't counted in the pipeline."
        : "";
      const flag =
        f.flag === "stalled"
          ? `, stalled (in review ${STALLED_REVIEW_YEARS}+ years, or issued ${STALLED_ISSUED_YEARS}+ years ago)`
          : f.flag === "expiring"
            ? `, with permits expiring within ${EXPIRING_SOON_MONTHS} months`
            : "";
      return `${type}Projects ${stage} today ${where}${flag}. Units are those on the project's permits that aren't completed yet.${counted}`;
    }
    case "proposals":
      return `Proposals ${where}: projects on file that haven't formally applied yet. Not part of the pipeline.`;
  }
}
