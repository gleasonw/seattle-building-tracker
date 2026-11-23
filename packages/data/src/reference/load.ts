/**
 * Reference data that ships with the code: place boundaries (data/neighborhoods.geojson,
 * data/centers.geojson, data/place-aliases.json) and derived tables. Runs after migrations
 * (scripts/migrate.ts), which the web service runs on every start, so a deploy that changes
 * the boundaries or the derivation applies them to production by itself. Each step is keyed
 * by a version in `reference_data` and is skipped when nothing changed.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type postgres from "postgres";
import { buildPlaces, type AliasFile, type CenterFeature, type NeighborhoodFeature } from "../domain/places";
import { assignPlaces, DERIVE_VERSION, flagRestatedUnits, rebuildProjects, type Tx } from "../sync/merge";

const dataFile = (name: string) => fileURLToPath(new URL(`../../data/${name}`, import.meta.url));

const PLACE_FILES = ["neighborhoods.geojson", "centers.geojson", "place-aliases.json"] as const;

export interface BoundarySource {
  name: string;
  layer: string;
  url: string;
  item: string;
  retrieved: string;
  dataLastEdited?: string;
  note?: string;
}

function readPlaceFiles() {
  const raw = Object.fromEntries(PLACE_FILES.map((f) => [f, readFileSync(dataFile(f), "utf8")])) as Record<
    (typeof PLACE_FILES)[number],
    string
  >;
  const hash = createHash("sha256");
  for (const f of PLACE_FILES) hash.update(raw[f]);
  const hoods = JSON.parse(raw["neighborhoods.geojson"]) as { features: NeighborhoodFeature[]; source: BoundarySource };
  const centers = JSON.parse(raw["centers.geojson"]) as { features: CenterFeature[]; source: BoundarySource };
  const aliases = JSON.parse(raw["place-aliases.json"]) as AliasFile;
  return { version: hash.digest("hex").slice(0, 16), rows: buildPlaces(hoods.features, centers.features, aliases) };
}

async function currentVersion(tx: Tx, name: string): Promise<string | null> {
  const [row] = await tx<{ version: string }[]>`SELECT version FROM reference_data WHERE name = ${name}`;
  return row?.version ?? null;
}

async function setVersion(tx: Tx, name: string, version: string) {
  await tx`
    INSERT INTO reference_data (name, version) VALUES (${name}, ${version})
    ON CONFLICT (name) DO UPDATE SET version = EXCLUDED.version, loaded_at = now()`;
}

/** Load whatever reference data changed. Returns what was done, for the log. */
export async function ensureReferenceData(sql: postgres.Sql): Promise<string[]> {
  const { version, rows } = readPlaceFiles();
  return sql.begin(async (transaction) => {
    const tx = transaction as unknown as Tx;
    // One loader at a time: the web service and the sync job can start together.
    await tx`SELECT pg_advisory_xact_lock(hashtext('sbt_reference_data'))`;
    const done: string[] = [];

    const placesChanged = (await currentVersion(tx, "places")) !== version;
    if (placesChanged) {
      await tx`DELETE FROM places`;
      for (const r of rows) {
        await tx`
          INSERT INTO places (id, kind, name, district, aliases, geom)
          VALUES (${r.id}, ${r.kind}, ${r.name}, ${r.district}, ${r.aliases},
                  ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_GeomFromGeoJSON(${JSON.stringify(r.geometry)})), 3)))`;
      }
      await assignPlaces(tx, null);
      await setVersion(tx, "places", version);
      done.push(`loaded ${rows.length} places and reassigned permits`);
    }

    if (placesChanged || (await currentVersion(tx, "derive")) !== DERIVE_VERSION) {
      const restated = await flagRestatedUnits(tx);
      const n = await rebuildProjects(tx);
      await setVersion(tx, "derive", DERIVE_VERSION);
      done.push(`flagged ${restated} restated permits; rebuilt ${n} projects`);
    }
    return done;
  });
}
