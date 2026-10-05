/**
 * Compares our database with aggregates computed by the portal itself (DEV_REWRITE_SPEC §7).
 * Exits non-zero if any check differs by more than the tolerance.
 *
 * Usage: pnpm --filter @sbt/data verify:portal
 */
import "dotenv/config";
import { sql } from "../db/client";
import { IMPORT_WHERE, soql } from "../sync/portal";

const TOLERANCE = 0.001; // 0.1%

interface Check {
  name: string;
  portal: Map<string, number>;
  local: Map<string, number>;
}

const toMap = (rows: { key: string | null; value: string | number | null }[]) =>
  new Map(rows.map((r) => [String(r.key ?? "∅"), Number(r.value ?? 0)]));

async function yearly(field: "completeddate" | "applieddate", column: "completed_date" | "applied_date") {
  const portal = await soql<{ key: string; value: string }>({
    $select: `date_extract_y(${field}) AS key, sum(housingunitsadded) AS value`,
    $where: `permittypemapped = 'Building' AND housingunitsadded > 0 AND ${field} >= '1950-01-01'`,
    $group: "key",
  });
  const local = await sql<{ key: string; value: number }[]>`
    SELECT extract(year FROM ${sql(column)})::int::text AS key, sum(housing_units_added)::int AS value
      FROM permits
     WHERE removed_at IS NULL AND permit_type_mapped = 'Building' AND housing_units_added > 0
       AND ${sql(column)} IS NOT NULL
     GROUP BY 1`;
  return { portal: toMap(portal), local: toMap(local) };
}

async function byStatus() {
  const portal = await soql<{ key: string; value: string }>({
    $select: "statuscurrent AS key, count(*) AS value",
    $where: IMPORT_WHERE,
    $group: "key",
  });
  const local = await sql<{ key: string; value: number }[]>`
    SELECT status_current AS key, count(*)::int AS value
      FROM permits WHERE removed_at IS NULL GROUP BY 1`;
  return { portal: toMap(portal), local: toMap(local) };
}

const checks: Check[] = [
  { name: "Units completed by year", ...(await yearly("completeddate", "completed_date")) },
  { name: "Units applied for by year", ...(await yearly("applieddate", "applied_date")) },
  { name: "Permits by status", ...(await byStatus()) },
];

let failures = 0;
for (const check of checks) {
  const keys = [...new Set([...check.portal.keys(), ...check.local.keys()])].sort();
  const bad = keys.filter((k) => {
    const p = check.portal.get(k) ?? 0;
    const l = check.local.get(k) ?? 0;
    return Math.abs(p - l) > Math.max(1, p * TOLERANCE);
  });
  const portalTotal = [...check.portal.values()].reduce((a, b) => a + b, 0);
  const localTotal = [...check.local.values()].reduce((a, b) => a + b, 0);
  console.log(
    `${bad.length ? "✗" : "✓"} ${check.name}: portal ${portalTotal.toLocaleString()}, local ${localTotal.toLocaleString()}`,
  );
  for (const k of bad) {
    console.log(`    ${k}: portal ${check.portal.get(k) ?? 0}, local ${check.local.get(k) ?? 0}`);
  }
  failures += bad.length;
}

await sql.end();
if (failures > 0) {
  console.error(`${failures} mismatches.`);
  process.exit(1);
}
