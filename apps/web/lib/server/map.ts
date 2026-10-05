import "server-only";
import { sql } from "drizzle-orm";
import type { Filters } from "@/lib/filters";
import { query } from "./db";
import { scope } from "./scope";

export interface MapPoint {
  permitNum: string;
  lat: number;
  lng: number;
  address: string | null;
  added: number;
  removed: number;
  date: string | null;
  link: string | null;
}

/** Most points drawn on one map; beyond this the smallest permits are left off (and the map says so). */
export const MAP_POINT_LIMIT = 10_000;

/** Located permits behind the current filters, largest first (SPEC X4). */
export async function getMapPoints(filters: Filters): Promise<{ points: MapPoint[]; unlocated: number; total: number }> {
  const s = scope(filters);
  const [points, [counts]] = await Promise.all([
    query<MapPoint & Record<string, unknown>>(sql`
      SELECT p.permit_num AS "permitNum", p.latitude AS lat, p.longitude AS lng, p.address,
             ${s.added}::int AS added, ${s.removed}::int AS removed,
             to_char(${s.date}, 'YYYY-MM-DD') AS date, p.link
        FROM permits p
       WHERE ${s.where} AND p.geom IS NOT NULL
       ORDER BY greatest(${s.added}, ${s.removed}) DESC, p.permit_num
       LIMIT ${MAP_POINT_LIMIT}
    `),
    query<{ total: number; unlocated: number }>(sql`
      SELECT count(*)::int AS total, count(*) FILTER (WHERE p.geom IS NULL)::int AS unlocated
        FROM permits p WHERE ${s.where}
    `),
  ]);
  return { points, unlocated: counts?.unlocated ?? 0, total: counts?.total ?? 0 };
}
