import "server-only";
import { sql } from "drizzle-orm";
import type { PlaceKind } from "@sbt/data/domain/places";
import type { PlaceOption } from "@/lib/search";
import { formatAddress } from "@/lib/format";
import { query } from "./db";
import { addedSql, housingSql, stageSql } from "./scope";

export interface Place {
  id: string;
  kind: PlaceKind;
  name: string;
  district: string | null;
  aliases: string[];
  /** Boundary as [lat, lng] rings per polygon, simplified for drawing. */
  polygons: [number, number][][][];
  /** A point inside the place, for "widen to a radius". */
  center: { lat: number; lng: number };
}

export interface RelatedPlace {
  id: string;
  kind: PlaceKind;
  name: string;
  /** Share of this place's area inside the related one. */
  overlap: number;
}

type Rings = [number, number][][][];

export function toLatLng(geojson: string): Rings {
  const g = JSON.parse(geojson) as { type: string; coordinates: [number, number][][][] | [number, number][][] };
  const polys = (g.type === "Polygon" ? [g.coordinates] : g.coordinates) as [number, number][][][];
  return polys.map((poly) => poly.map((ring) => ring.map(([lng, lat]) => [lat, lng] as [number, number])));
}

export async function getPlace(id: string): Promise<Place | null> {
  const [row] = await query<{
    id: string;
    kind: PlaceKind;
    name: string;
    district: string | null;
    aliases: string[];
    geojson: string;
    lat: number;
    lng: number;
  }>(sql`
    SELECT id, kind, name, district, aliases,
           ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, 0.00003), 6) AS geojson,
           ST_Y(ST_PointOnSurface(geom)) AS lat, ST_X(ST_PointOnSurface(geom)) AS lng
      FROM places WHERE id = ${id}
  `);
  if (!row) return null;
  return { ...row, polygons: toLatLng(row.geojson), center: { lat: row.lat, lng: row.lng } };
}

/** Places of the other kind that overlap this one, largest overlap first (SPEC P3 "switches to a related place"). */
export async function getRelatedPlaces(id: string): Promise<RelatedPlace[]> {
  return query<RelatedPlace & Record<string, unknown>>(sql`
    SELECT o.id, o.kind, o.name, (ST_Area(ST_Intersection(p.geom, o.geom)) / nullif(ST_Area(p.geom), 0))::float AS overlap
      FROM places p JOIN places o ON o.kind <> p.kind AND ST_Intersects(p.geom, o.geom)
     WHERE p.id = ${id}
       AND ST_Area(ST_Intersection(p.geom, o.geom)) > 0.05 * least(ST_Area(p.geom), ST_Area(o.geom))
     ORDER BY 4 DESC
  `);
}

/** The neighborhood and center containing a point. */
export async function getPlacesAt(lat: number, lng: number): Promise<RelatedPlace[]> {
  return query<RelatedPlace & Record<string, unknown>>(sql`
    SELECT id, kind, name, 1::float AS overlap FROM places
     WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326))
     ORDER BY kind DESC
  `);
}

/** Every place with its pipeline units today, for search hints (SPEC P2). */
export async function listPlaceOptions(today: string): Promise<PlaceOption[]> {
  return query<PlaceOption & Record<string, unknown>>(sql`
    WITH pipe AS (
      SELECT m.neighborhood_id AS hood, m.center_id AS center, ${addedSql("p")} AS units
        FROM projects pr
        JOIN permits m ON m.permit_num = pr.main_permit_num AND m.removed_at IS NULL
        JOIN permits p ON p.project_key = pr.project_key AND p.removed_at IS NULL AND ${housingSql("p")}
       WHERE ${stageSql("p", today)} IN ('review', 'issued') AND ${stageSql("m", today)} IN ('review', 'issued')
    ),
    by_place AS (
      SELECT hood AS id, sum(units)::int AS units FROM pipe WHERE hood IS NOT NULL GROUP BY 1
      UNION ALL
      SELECT center, sum(units)::int FROM pipe WHERE center IS NOT NULL GROUP BY 1
    )
    SELECT pl.id, pl.kind, pl.name, pl.district, pl.aliases, coalesce(b.units, 0)::int AS "pipelineUnits"
      FROM places pl LEFT JOIN by_place b ON b.id = pl.id
     ORDER BY pl.kind DESC, pl.name
  `);
}

export interface AddressProject {
  mainPermit: string;
  address: string | null;
  units: number;
  stage: string;
  distance: number;
}

/** Projects whose main permit is within `meters` of a point: "the projects at that address" (SPEC P2). */
export async function getProjectsNear(lat: number, lng: number, today: string, meters = 30): Promise<AddressProject[]> {
  const rows = await query<AddressProject & Record<string, unknown>>(sql`
    SELECT m.permit_num AS "mainPermit", m.address, pr.units_added AS units, ${stageSql("m", today)} AS stage,
           ST_Distance(m.geom::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography)::float AS distance
      FROM projects pr JOIN permits m ON m.permit_num = pr.main_permit_num
     WHERE m.removed_at IS NULL
       AND ST_DWithin(m.geom::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${meters})
     ORDER BY distance, pr.units_added DESC
     LIMIT 10
  `);
  return rows.map((r) => ({ ...r, address: formatAddress(r.address) }));
}

/** Projects whose address matches the text, for searches the geocoder doesn't resolve. */
export async function searchProjectAddresses(q: string, today: string): Promise<(AddressProject & { lat: number | null; lng: number | null })[]> {
  const pattern = `%${q.trim().replace(/[%_\\]/g, (c) => `\\${c}`).replace(/\s+/g, "%")}%`;
  const rows = await query<AddressProject & { lat: number | null; lng: number | null } & Record<string, unknown>>(sql`
    SELECT m.permit_num AS "mainPermit", m.address, pr.units_added AS units, ${stageSql("m", today)} AS stage,
           0::float AS distance, m.latitude AS lat, m.longitude AS lng
      FROM projects pr JOIN permits m ON m.permit_num = pr.main_permit_num
     WHERE m.removed_at IS NULL AND m.address ILIKE ${pattern}
     ORDER BY pr.units_added DESC
     LIMIT 8
  `);
  return rows.map((r) => ({ ...r, address: formatAddress(r.address) }));
}
