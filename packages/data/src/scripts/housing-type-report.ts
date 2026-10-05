/**
 * Housing-type inference accuracy (DEV_REWRITE_SPEC §4.7).
 *
 * For permits where the City recorded a dwelling unit type, hide it, run the inference,
 * and compare. Reports per-type precision/recall by permits and by units, plus the
 * unit-size distribution of apartment permits for choosing multifamily cutoffs.
 *
 * Usage: pnpm --filter @sbt/data report:housing-type [--from 2018] [--to 2023]
 */
import "dotenv/config";
import { sql } from "../db/client";
import { CLASSIFIER_VERSION, HOUSING_TYPES } from "../domain/housing-type";
import { measureInferenceAccuracy } from "../domain/housing-type-accuracy";

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1]! : fallback;
};
const from = Number(arg("from", "2018"));
const to = Number(arg("to", "2023"));

const rows = await sql<
  {
    permit_type_mapped: string;
    housing_units_added: number;
    dwelling_unit_type: string;
    housing_category: string | null;
    permit_class: string | null;
    description: string | null;
  }[]
>`
  SELECT permit_type_mapped, housing_units_added, dwelling_unit_type, housing_category, permit_class, description
    FROM permits
   WHERE removed_at IS NULL AND permit_type_mapped = 'Building' AND housing_units_added > 0
     AND dwelling_unit_type IS NOT NULL
     AND extract(year FROM applied_date) BETWEEN ${from} AND ${to}`;

const report = measureInferenceAccuracy(
  rows.map((r) => ({
    permitTypeMapped: r.permit_type_mapped,
    housingUnitsAdded: r.housing_units_added,
    dwellingUnitType: r.dwelling_unit_type,
    housingCategory: r.housing_category,
    permitClass: r.permit_class,
    description: r.description,
  })),
);
const { confusion } = report;
const pct = (v: number | null) => (v === null ? "   –  " : `${(100 * v).toFixed(1).padStart(5)}%`);

console.log(`Housing-type inference, classifier v${CLASSIFIER_VERSION}, applied ${from}–${to}`);
console.log(`Compared ${report.compared.toLocaleString()} permits where the City recorded a dwelling type.\n`);
console.log("type        units   recall(units) precision(units)");
for (const t of report.byType) {
  console.log(`${t.type.padEnd(11)} ${String(t.units).padStart(6)}   ${pct(t.recallUnits)}        ${pct(t.precisionUnits)}`);
}
console.log(`\nOverall: ${pct(report.permitAccuracy)} of permits, ${pct(report.unitAccuracy)} of units.\n`);

console.log("Biggest confusions (truth → guess, by units):");
const pairs = HOUSING_TYPES.flatMap((t) =>
  HOUSING_TYPES.filter((g) => g !== t).map((g) => ({ t, g, ...confusion[t][g] })),
)
  .sort((a, b) => b.units - a.units)
  .slice(0, 8);
for (const p of pairs) console.log(`  ${p.t} → ${p.g}: ${p.permits} permits, ${p.units} units`);

const sizes = await sql<{ bucket: string; permits: number; units: number }[]>`
  SELECT CASE WHEN housing_units_added < 5 THEN '2-4' WHEN housing_units_added < 10 THEN '5-9'
              WHEN housing_units_added < 20 THEN '10-19' WHEN housing_units_added < 50 THEN '20-49'
              WHEN housing_units_added < 100 THEN '50-99' WHEN housing_units_added < 150 THEN '100-149'
              WHEN housing_units_added < 250 THEN '150-249' ELSE '250+' END AS bucket,
         count(*)::int AS permits, sum(housing_units_added)::int AS units
    FROM permits
   WHERE removed_at IS NULL AND housing_type IN ('mf_small', 'mf_mid', 'mf_large') AND housing_units_added >= 2
   GROUP BY 1 ORDER BY min(housing_units_added)`;
console.log("\nMultifamily permits by size:");
for (const s of sizes) console.log(`  ${s.bucket.padEnd(8)} ${String(s.permits).padStart(6)} permits ${String(s.units).padStart(8)} units`);

await sql.end();
