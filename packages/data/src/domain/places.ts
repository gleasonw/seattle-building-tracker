/**
 * Places (SPEC §2): neighborhoods from the City Clerk's Neighborhood Map Atlas and centers
 * from the Comprehensive Plan. Pure helpers for turning the snapshotted boundary layers into
 * place rows; reference/load.ts writes them to the database.
 */

export const PLACE_KINDS = ["neighborhood", "center"] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

export interface PlaceRow {
  id: string;
  kind: PlaceKind;
  name: string;
  district: string | null;
  aliases: string[];
  geometry: unknown;
}

export interface NeighborhoodFeature {
  properties: { name: string; district: string; altNames: string | null };
  geometry: unknown;
}

export interface CenterFeature {
  properties: { name: string; placeType: string; centerNo: number };
  geometry: unknown;
}

export interface AliasFile {
  neighborhoods: Record<string, string[]>;
  centers: Record<string, string[]>;
}

/** "Harrison/Denny-Blaine" → "harrison-denny-blaine". */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "Roosevelt" + "Urban Center" → "Roosevelt Urban Center". */
export function centerName(name: string, placeType: string): string {
  return `${name} ${placeType}`;
}

const unique = (values: string[]) => [...new Set(values.map((v) => v.trim()).filter(Boolean))];

/**
 * Place rows from the two layers plus the hand-kept alias list. Throws if an alias names a
 * place that isn't in the layer (a renamed neighborhood would otherwise silently lose its
 * informal names) or if two places would get the same slug.
 */
export function buildPlaces(
  neighborhoods: NeighborhoodFeature[],
  centers: CenterFeature[],
  aliases: AliasFile,
): PlaceRow[] {
  const rows: PlaceRow[] = [];
  const hoodNames = new Set(neighborhoods.map((f) => f.properties.name));
  const centerNames = new Set(centers.map((f) => f.properties.name));
  for (const name of Object.keys(aliases.neighborhoods)) {
    if (!hoodNames.has(name)) throw new Error(`place-aliases.json: no neighborhood named "${name}"`);
  }
  for (const name of Object.keys(aliases.centers)) {
    if (!centerNames.has(name)) throw new Error(`place-aliases.json: no center named "${name}"`);
  }

  for (const f of neighborhoods) {
    const { name, district, altNames } = f.properties;
    rows.push({
      id: slugify(name),
      kind: "neighborhood",
      name,
      district,
      aliases: unique([...(altNames?.split(",") ?? []), ...(aliases.neighborhoods[name] ?? [])]),
      geometry: f.geometry,
    });
  }
  for (const f of centers) {
    const { name, placeType } = f.properties;
    const full = centerName(name, placeType);
    rows.push({
      id: slugify(full),
      kind: "center",
      name: full,
      district: placeType,
      aliases: unique([name, ...(aliases.centers[name] ?? [])]),
      geometry: f.geometry,
    });
  }

  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.id)) throw new Error(`Two places share the slug "${r.id}"`);
    seen.add(r.id);
  }
  return rows;
}
