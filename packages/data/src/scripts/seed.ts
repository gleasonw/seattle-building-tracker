/**
 * Loads reference data that changes rarely: CRA boundaries and policy annotations.
 * Safe to re-run; replaces both tables.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sql } from "../db/client";

const dataFile = (name: string) => fileURLToPath(new URL(`../../data/${name}`, import.meta.url));

interface CraFeature {
  properties: {
    CRA_NO: number;
    CRA_GRP: number;
    GEN_ALIAS: string;
    DETL_NAMES: string | null;
    NEIGHDIST: string | null;
    AREA_ACRES: number | null;
  };
  geometry: unknown;
}

const cra = JSON.parse(readFileSync(dataFile("cra.geojson"), "utf8")) as { features: CraFeature[] };
const policyEvents = JSON.parse(readFileSync(dataFile("policy-events.json"), "utf8")) as Array<{
  date: string;
  label: string;
  detail: string | null;
  url: string;
  verifiedOn: string | null;
}>;

await sql.begin(async (transaction) => {
  const tx = transaction as unknown as typeof sql;
  await tx`UPDATE permits SET cra_id = NULL WHERE cra_id IS NOT NULL`;
  await tx`DELETE FROM areas`;
  for (const f of cra.features) {
    const p = f.properties;
    await tx`
      INSERT INTO areas (id, name, detail_names, group_id, district, acres, geom)
      VALUES (${String(p.CRA_NO)}, ${p.GEN_ALIAS}, ${p.DETL_NAMES}, ${p.CRA_GRP}, ${p.NEIGHDIST},
              ${p.AREA_ACRES}, ST_Multi(ST_MakeValid(ST_GeomFromGeoJSON(${JSON.stringify(f.geometry)}))))`;
  }

  await tx`DELETE FROM policy_events`;
  for (const e of policyEvents) {
    await tx`
      INSERT INTO policy_events (date, label, detail, url, verified_on)
      VALUES (${e.date}, ${e.label}, ${e.detail}, ${e.url}, ${e.verifiedOn})`;
  }
});

console.log(`Seeded ${cra.features.length} areas and ${policyEvents.length} policy events.`);
console.log("Run a sync (or the derive step) to reassign permits to areas.");
await sql.end();
