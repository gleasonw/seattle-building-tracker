import "server-only";
import { sql } from "drizzle-orm";
import type { HousingType } from "@sbt/data/domain/housing-type";
import type { Where } from "@/lib/filters";
import { DATE_OLD_DEATHS_BY_LAST_MILESTONE } from "@/lib/rules";
import { formatAddress } from "@/lib/format";
import { query } from "./db";
import { housingSql, placeConditions, stageSql } from "./scope";

export const MOVEMENT_KINDS = ["applied", "issued", "completed", "expired", "died"] as const;
export type MovementKind = (typeof MOVEMENT_KINDS)[number];

export interface Movement {
  projectKey: string;
  mainPermit: string;
  address: string | null;
  hoodName: string | null;
  housingType: HousingType | null;
  kind: MovementKind;
  date: string;
  /** The City gives no date: dated by when the app first noticed it (SPEC T4). */
  dating: "city" | "noticed" | "approximate";
  units: number;
  permits: number;
  /** Units across the whole project, to say "4 of 10 homes" when only part of it moved. */
  projectUnits: number;
}

/**
 * Dated changes in projects' progress (SPEC §2 "Movement"), newest first. Milestones carry the
 * City's dates. Expiry is dated by the permit's own expiration date, read from its current
 * record, never from recorded changes to that field: the portal has cleared and restored
 * expiration dates en masse (SPEC open question 7), and a transient change must not read as
 * movement. Deaths count only when the whole project is dead now, so a status that flips and
 * flips back, or a dead application superseded by a live one, isn't shown as a death.
 */
export async function getMovement(
  where: Where,
  today: string,
  opts: { days: number; minProjectUnits?: number; limit?: number; projectKey?: string },
): Promise<Movement[]> {
  const from = shiftDays(today, -opts.days);
  const place = placeConditions(where, "m");
  const stage = stageSql("p", today);
  const mainStage = stageSql("m", today);
  const oldDeathDate = DATE_OLD_DEATHS_BY_LAST_MILESTONE ? sql`greatest(hp.applied_date, hp.issued_date)` : sql`NULL::date`;
  const rows = await query<Movement & Record<string, unknown>>(sql`
    WITH hp AS (
      SELECT p.permit_num, p.project_key, p.applied_date, p.issued_date, p.completed_date, p.expires_date,
             p.status_current, p.housing_units_added AS u, ${stage} AS stage, ${mainStage} AS main_stage
        FROM permits p
        JOIN projects pr ON pr.project_key = p.project_key
        JOIN permits m ON m.permit_num = pr.main_permit_num
       WHERE p.removed_at IS NULL AND ${housingSql("p")}
         ${opts.minProjectUnits ? sql`AND pr.units_added >= ${opts.minProjectUnits}` : sql``}
         ${opts.projectKey ? sql`AND p.project_key = ${opts.projectKey}` : sql``}
         ${place.length ? sql`AND ${sql.join(place, sql` AND `)}` : sql``}
         AND (p.applied_date >= ${from}::date OR p.issued_date >= ${from}::date OR p.completed_date >= ${from}::date
              OR ${stage} IN ('dead', 'expired'))
    ),
    -- First sync after the initial load that saw the permit's current status.
    noticed AS (
      SELECT e.permit_num, min((e.observed_at AT TIME ZONE 'America/Los_Angeles')::date) AS d
        FROM permit_events e JOIN hp ON hp.permit_num = e.permit_num
       WHERE hp.stage IN ('dead', 'expired') AND e.kind IN ('status', 'observed', 'restored')
         AND e.value_to = hp.status_current
         AND e.sync_run_id > (SELECT min(sync_run_id) FROM permit_events)
       GROUP BY e.permit_num
    ),
    moves AS (
      SELECT project_key, 'applied' AS kind, applied_date AS d, 'city' AS dating, u FROM hp WHERE applied_date IS NOT NULL
      UNION ALL
      SELECT project_key, 'issued', issued_date, 'city', u FROM hp WHERE issued_date IS NOT NULL
      UNION ALL
      SELECT project_key, 'completed', completed_date, 'city', u FROM hp WHERE stage = 'completed' AND completed_date IS NOT NULL
      UNION ALL
      SELECT hp.project_key, 'expired',
             CASE WHEN hp.expires_date <= ${today}::date THEN hp.expires_date ELSE n.d END,
             CASE WHEN hp.expires_date <= ${today}::date THEN 'city' ELSE 'noticed' END, hp.u
        FROM hp LEFT JOIN noticed n USING (permit_num) WHERE hp.stage = 'expired'
      UNION ALL
      SELECT hp.project_key, 'died',
             CASE WHEN hp.status_current = 'Expired' AND hp.expires_date <= ${today}::date THEN hp.expires_date
                  ELSE coalesce(n.d, ${oldDeathDate}) END,
             CASE WHEN hp.status_current = 'Expired' AND hp.expires_date <= ${today}::date THEN 'city'
                  WHEN n.d IS NOT NULL THEN 'noticed' ELSE 'approximate' END, hp.u
        FROM hp LEFT JOIN noticed n USING (permit_num) WHERE hp.stage = 'dead' AND hp.main_stage = 'dead'
    ),
    grouped AS (
      SELECT project_key, kind, d, dating, sum(u)::int AS units, count(*)::int AS permits
        FROM moves WHERE d >= ${from}::date AND d <= ${today}::date
       GROUP BY 1, 2, 3, 4
    )
    SELECT g.project_key AS "projectKey", pr.main_permit_num AS "mainPermit", m.address, h.name AS "hoodName",
           pr.housing_type AS "housingType", g.kind, to_char(g.d, 'YYYY-MM-DD') AS date, g.dating, g.units, g.permits,
           pr.units_added AS "projectUnits"
      FROM grouped g
      JOIN projects pr ON pr.project_key = g.project_key
      JOIN permits m ON m.permit_num = pr.main_permit_num
      LEFT JOIN places h ON h.id = m.neighborhood_id
     ORDER BY g.d DESC, g.units DESC, g.project_key, g.kind
     ${opts.limit ? sql`LIMIT ${opts.limit}` : sql``}
  `);
  return rows.map((r) => ({ ...r, address: formatAddress(r.address) }));
}

export function shiftDays(isoDay: string, days: number): string {
  const d = new Date(`${isoDay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
