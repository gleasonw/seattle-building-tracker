/**
 * SQL steps that move a fully staged, reconciled snapshot into the live tables.
 * All run inside one transaction.
 */
import { getTableColumns } from "drizzle-orm";
import type postgres from "postgres";
import { permitsStaging } from "../db/schema";

/** postgres.js's TransactionSql type loses its call signature under TS 5; the runtime object is callable. */
export type Tx = postgres.Sql;

const columns = Object.values(getTableColumns(permitsStaging)).map((c) => `"${c.name}"`);
const columnList = columns.join(", ");
const updateList = columns
  .filter((c) => c !== '"permit_num"')
  .map((c) => `${c} = EXCLUDED.${c}`)
  .join(", ");

const MILESTONES = ["applied_date", "issued_date", "completed_date", "expires_date"] as const;

/** Append an event for every status or milestone change, new permit, and restored permit. */
export async function writeEvents(tx: Tx, runId: number): Promise<number> {
  const milestoneValues = MILESTONES.map(
    (m) => `('${m}', p.${m}::text, s.${m}::text)`,
  ).join(", ");

  const result = await tx.unsafe(
    `
    INSERT INTO permit_events (permit_num, sync_run_id, kind, field, value_from, value_to)
    SELECT s.permit_num, $1::int, 'status', 'status_current', p.status_current, s.status_current
      FROM permits_staging s JOIN permits p USING (permit_num)
     WHERE p.removed_at IS NULL AND s.status_current IS DISTINCT FROM p.status_current
    UNION ALL
    SELECT s.permit_num, $1::int, 'milestone', f.field, f.old, f.new
      FROM permits_staging s JOIN permits p USING (permit_num)
      CROSS JOIN LATERAL (VALUES ${milestoneValues}) AS f(field, old, new)
     WHERE p.removed_at IS NULL AND f.old IS DISTINCT FROM f.new
    UNION ALL
    SELECT s.permit_num, $1::int, 'observed', 'status_current', NULL, s.status_current
      FROM permits_staging s
     WHERE NOT EXISTS (SELECT 1 FROM permits p WHERE p.permit_num = s.permit_num)
    UNION ALL
    SELECT s.permit_num, $1::int, 'restored', 'status_current', p.status_current, s.status_current
      FROM permits_staging s JOIN permits p USING (permit_num)
     WHERE p.removed_at IS NOT NULL
    `,
    [runId],
  );
  return result.count;
}

/** Upsert staged rows; rows whose content changed get a new updated_at. */
export async function upsertPermits(tx: Tx): Promise<{ inserted: number; updated: number }> {
  const [row] = await tx.unsafe<{ inserted: number; updated: number }[]>(`
    WITH up AS (
      INSERT INTO permits (${columnList})
      SELECT ${columnList} FROM permits_staging
      ON CONFLICT (permit_num) DO UPDATE
         SET ${updateList}, updated_at = now(), removed_at = NULL
       WHERE permits.content_hash IS DISTINCT FROM EXCLUDED.content_hash
          OR permits.removed_at IS NOT NULL
      RETURNING (xmax = 0) AS is_insert
    )
    SELECT count(*) FILTER (WHERE is_insert)::int AS inserted,
           count(*) FILTER (WHERE NOT is_insert)::int AS updated
      FROM up
  `);
  return row!;
}

/** Soft-delete permits that are no longer in the source. */
export async function removeMissing(tx: Tx, runId: number): Promise<number> {
  const result = await tx`
    WITH gone AS (
      UPDATE permits p SET removed_at = now()
       WHERE p.removed_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM permits_staging s WHERE s.permit_num = p.permit_num)
      RETURNING p.permit_num, p.status_current
    )
    INSERT INTO permit_events (permit_num, sync_run_id, kind, field, value_from)
    SELECT permit_num, ${runId}, 'removed', 'status_current', status_current FROM gone
  `;
  return result.count;
}

/** Point geometry and CRA for rows changed in this run (or never assigned). The CRA is unused by the web app; places come from assignPlaces. */
export async function deriveGeography(tx: Tx, runStartedAt: string): Promise<void> {
  await tx`
    UPDATE permits
       SET geom = CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL
                       THEN ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) END,
           cra_id = NULL
     WHERE updated_at >= ${runStartedAt} OR (cra_id IS NULL AND latitude IS NOT NULL)
  `;
  await tx`
    UPDATE permits p SET cra_id = a.id
      FROM areas a
     WHERE p.cra_id IS NULL AND p.geom IS NOT NULL AND ST_Contains(a.geom, p.geom)
  `;
  // Points just outside every polygon (shorelines, boundary slivers): nearest CRA within 50 m.
  await tx`
    UPDATE permits p SET cra_id = (
      SELECT a.id FROM areas a
       WHERE ST_DWithin(a.geom::geography, p.geom::geography, 50)
       ORDER BY a.geom::geography <-> p.geom::geography
       LIMIT 1)
     WHERE p.cra_id IS NULL AND p.geom IS NOT NULL
  `;
  await assignPlaces(tx, runStartedAt);
}

/** Points this far outside every neighborhood (shorelines, piers) go to the nearest one. */
const NEAREST_NEIGHBORHOOD_METERS = 50;

/**
 * Neighborhood and center for each located permit (SPEC §2 "Place"). Neighborhoods tile the
 * city, so every located permit inside Seattle gets exactly one; centers are optional.
 * `changedSince` limits the work to rows updated since then (plus rows never assigned);
 * null reassigns every permit, after the boundaries change.
 */
export async function assignPlaces(tx: Tx, changedSince: string | null): Promise<void> {
  const target = changedSince
    ? tx`p.updated_at >= ${changedSince} OR (p.geom IS NOT NULL AND p.neighborhood_id IS NULL)`
    : tx`true`;
  await tx`
    UPDATE permits p
       SET neighborhood_id = (SELECT pl.id FROM places pl
                               WHERE pl.kind = 'neighborhood' AND ST_Contains(pl.geom, p.geom) LIMIT 1),
           center_id = (SELECT pl.id FROM places pl
                         WHERE pl.kind = 'center' AND ST_Contains(pl.geom, p.geom) LIMIT 1)
     WHERE ${target}
  `;
  await tx`
    UPDATE permits p SET neighborhood_id = (
      SELECT pl.id FROM places pl
       WHERE pl.kind = 'neighborhood' AND ST_DWithin(pl.geom::geography, p.geom::geography, ${NEAREST_NEIGHBORHOOD_METERS})
       ORDER BY pl.geom::geography <-> p.geom::geography
       LIMIT 1)
     WHERE p.neighborhood_id IS NULL AND p.geom IS NOT NULL
  `;
}

/** Groups at least this large, restating at least this many units, are treated as restatements. */
const RESTATED_MIN_PERMITS = 3;
const RESTATED_MIN_UNITS = 50;
/** Same-site siblings: permits at one address, applied for the same day, each listing this many units or more. */
const SIBLING_MIN_UNITS = 3;

/**
 * Some multi-building developments without a development site repeat the whole
 * development's unit count on every building's permit. Two patterns are counted once,
 * keeping the units on the first live permit and flagging the rest:
 *
 * - Large developments: at least RESTATED_MIN_PERMITS unlinked building permits on one
 *   street, applied for the same year, each listing the same RESTATED_MIN_UNITS or more
 *   (e.g. 24 townhouse-structure permits each listing 238 units). Smaller repeats along a
 *   street (a row of 20-unit buildings) are plausibly real and are left alone.
 * - Small sites: two or more unlinked building permits at the same address, applied for the
 *   same day, each listing the same SIBLING_MIN_UNITS or more. These are one site's buildings
 *   ("Construct west units 1A-B" and "east units 2A-B", each "(4) attached dwelling units"),
 *   and each permit states the site's total. One- and two-unit siblings are usually one
 *   house or duplex per permit, so they're left alone.
 */
export async function flagRestatedUnits(tx: Tx): Promise<number> {
  await tx`UPDATE permits SET restated_units = false WHERE restated_units`;
  const result = await tx`
    WITH base AS (
      SELECT permit_num, address, applied_date, housing_units_added, status_category
        FROM permits
       WHERE removed_at IS NULL AND permit_type_mapped = 'Building' AND NOT site_prep_only
         AND development_site IS NULL AND applied_date IS NOT NULL
         AND housing_units_added >= ${SIBLING_MIN_UNITS}
    ),
    large AS (
      SELECT permit_num,
             row_number() OVER w AS rn,
             count(*) OVER w AS n
        FROM base
       WHERE housing_units_added >= ${RESTATED_MIN_UNITS}
      WINDOW w AS (PARTITION BY regexp_replace(upper(address), '^[0-9A-Z-]+[[:space:]]+', ''),
                                date_trunc('year', applied_date), housing_units_added
                   ORDER BY (status_category = 'dead'), permit_num
                   ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)
    ),
    siblings AS (
      SELECT permit_num, row_number() OVER w AS rn
        FROM base
       WHERE address IS NOT NULL
      WINDOW w AS (PARTITION BY upper(regexp_replace(address, '[[:space:]]+', ' ', 'g')), applied_date, housing_units_added
                   ORDER BY (status_category = 'dead'), permit_num)
    ),
    flagged AS (
      SELECT permit_num FROM large WHERE n >= ${RESTATED_MIN_PERMITS} AND rn > 1
      UNION
      SELECT permit_num FROM siblings WHERE rn > 1
    )
    UPDATE permits p SET restated_units = true
      FROM flagged f
     WHERE f.permit_num = p.permit_num
  `;
  return result.count;
}

/**
 * Bump when rebuildProjects or assignPlaces change, so the next deploy re-derives
 * (reference/load.ts) instead of waiting for the nightly sync.
 */
export const DERIVE_VERSION = "3";

/**
 * Rebuild the projects table. A project is every unit-adding
 * building permit sharing a project key, plus demolitions on the same key.
 */
export async function rebuildProjects(tx: Tx): Promise<number> {
  await tx`TRUNCATE projects`;
  const result = await tx`
    WITH b AS (
      SELECT * FROM permits
       WHERE removed_at IS NULL AND permit_type_mapped = 'Building' AND housing_units_added > 0
         AND NOT site_prep_only AND NOT restated_units
    ),
    demo AS (
      SELECT project_key, count(*)::int AS n, coalesce(sum(housing_units_removed), 0)::int AS removed
        FROM permits
       WHERE removed_at IS NULL AND permit_type_mapped = 'Demolition'
       GROUP BY project_key
    ),
    -- The main permit sets the project's stage and housing type (SPEC §2 "Stage"): the one
    -- with the most units, preferring live permits over dead ones that were superseded.
    main AS (
      SELECT DISTINCT ON (project_key) project_key, permit_num, housing_type, cra_id
        FROM b
       ORDER BY project_key, (status_category = 'dead'), housing_units_added DESC, applied_date NULLS LAST, permit_num
    ),
    agg AS (
      SELECT project_key,
             max(development_site) AS development_site,
             count(*)::int AS n,
             -- Dead permits are usually superseded by a live one on the same site; count
             -- their units only if every permit on the project died.
             CASE WHEN bool_and(status_category = 'dead') THEN sum(housing_units_added)
                  ELSE sum(housing_units_added) FILTER (WHERE status_category <> 'dead')
             END::int AS units_added,
             coalesce(sum(housing_units_removed), 0)::int AS units_removed,
             min(applied_date) AS applied_date,
             bool_or(status_category = 'pipeline') AS any_pipeline,
             bool_or(status_category = 'done') AS any_done,
             bool_or(status_category = 'lapsed') AS any_lapsed,
             min(array_position(ARRAY['pre_intake','applied','issued'], stage))
               FILTER (WHERE status_category = 'pipeline') AS stage_ix,
             bool_and(issued_date IS NOT NULL) FILTER (WHERE status_category <> 'dead') AS all_issued,
             max(issued_date) FILTER (WHERE status_category <> 'dead') AS max_issued,
             max(completed_date) FILTER (WHERE status_category = 'done') AS max_completed,
             max(greatest(applied_date, issued_date, completed_date)) AS last_activity,
             max(expires_date) FILTER (WHERE status_category IN ('pipeline', 'lapsed')) AS expires
        FROM b
       GROUP BY project_key
    ),
    classified AS (
      SELECT agg.*,
             CASE WHEN any_pipeline THEN 'pipeline' WHEN any_done THEN 'done'
                  WHEN any_lapsed THEN 'lapsed' ELSE 'dead' END AS status_category
        FROM agg
    )
    INSERT INTO projects (
      project_key, development_site, main_permit_num, building_permit_count, demolition_permit_count,
      housing_type, cra_id, units_added, units_removed, applied_date, issued_date, completed_date,
      last_activity_date, expires_date, status_category, stage)
    SELECT c.project_key, c.development_site, m.permit_num, c.n, coalesce(d.n, 0),
           m.housing_type, m.cra_id, c.units_added, c.units_removed + coalesce(d.removed, 0),
           c.applied_date,
           CASE WHEN c.all_issued THEN c.max_issued END,
           CASE WHEN c.status_category = 'done' THEN c.max_completed END,
           c.last_activity, c.expires, c.status_category,
           CASE WHEN c.status_category = 'pipeline'
                THEN (ARRAY['pre_intake','applied','issued'])[c.stage_ix]
                ELSE c.status_category END
      FROM classified c
      JOIN main m USING (project_key)
      LEFT JOIN demo d USING (project_key)
  `;
  return result.count;
}
