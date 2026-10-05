import "server-only";
import { sql } from "drizzle-orm";
import type { HousingType } from "@sbt/data/domain/housing-type";
import type { StatusCategory } from "@sbt/data/domain/status";
import type { Filters } from "@/lib/filters";
import { query } from "./db";
import { dateRange, scope } from "./scope";

/**
 * Bottleneck measures (SPEC M4–M6, V3, V5). Cohorts are application years.
 *
 * - Share built (M4) is per permit: each permit's units, by its own status, in the year it
 *   was applied for. That makes every cell an exact /permits drill-down.
 * - Durations (M5), review breakdown (M6) and stalled projects (V5) are per project, so a
 *   45-permit townhouse site is one data point. Their drill-downs use `by=project`.
 */

/** Segment filters for bottleneck measures: dates are application dates; status and unit kind don't apply. */
export function bottleneckFilters(filters: Filters): Filters {
  return { ...filters, on: "applied", status: null, stage: null, units: null, by: null };
}

/** Projects with at least one permit in the segment, keyed `pr`. */
function projectsInSegment(filters: Filters) {
  const s = scope(bottleneckFilters(filters), { milestone: "applied", ignoreDates: true });
  const { from, to } = dateRange(filters);
  return sql`pr.applied_date >= ${from}::date AND pr.applied_date <= ${to}::date
    AND EXISTS (SELECT 1 FROM permits p WHERE p.project_key = pr.project_key AND ${s.where})`;
}

export interface OutcomeRow {
  year: number;
  housingType: HousingType;
  status: StatusCategory;
  /** Pipeline stage, or the status for finished permits; "dead" is split by whether it was issued. */
  stage: "applied" | "issued" | "done" | "lapsed" | "dead_unissued" | "dead_issued";
  units: number;
  permits: number;
  projects: number;
}

/** Units applied for per cohort year, type and outcome (M4 and the V3 funnel). */
export async function getOutcomes(filters: Filters): Promise<OutcomeRow[]> {
  const s = scope(bottleneckFilters(filters), { milestone: "applied" });
  return query<OutcomeRow & Record<string, unknown>>(sql`
    SELECT extract(year FROM p.applied_date)::int AS year, p.housing_type AS "housingType",
           p.status_category AS status,
           CASE WHEN p.status_category = 'dead' THEN
                  CASE WHEN p.issued_date IS NULL THEN 'dead_unissued' ELSE 'dead_issued' END
                ELSE p.stage END AS stage,
           sum(p.housing_units_added)::int AS units, count(*)::int AS permits,
           count(DISTINCT p.project_key)::int AS projects
      FROM permits p
     WHERE ${s.where}
     GROUP BY 1, 2, 3, 4
     ORDER BY 1, 2
  `);
}

/** Distinct projects per cohort and type, for the reliability rule on shares. */
export async function getCohortProjects(filters: Filters) {
  const s = scope(bottleneckFilters(filters), { milestone: "applied" });
  return query<{ year: number; housingType: HousingType | null; projects: number; topUnits: number; units: number }>(sql`
    WITH x AS (
      SELECT extract(year FROM p.applied_date)::int AS year, p.housing_type, p.project_key,
             sum(p.housing_units_added)::int AS units
        FROM permits p WHERE ${s.where}
       GROUP BY GROUPING SETS ((1, 2, 3), (1, 3))
    )
    SELECT year, housing_type AS "housingType", count(*)::int AS projects,
           max(units)::int AS "topUnits", sum(units)::int AS units
      FROM x GROUP BY 1, 2
  `);
}

export interface DurationRow {
  year: number;
  /** null for all types combined. */
  housingType: HousingType | null;
  stage: "applied_to_issued" | "issued_to_completed";
  projects: number;
  p25: number;
  median: number;
  p75: number;
}

/** Median days per stage by cohort and type, with the 25th–75th percentile spread (M5). */
export async function getStageDurations(filters: Filters): Promise<DurationRow[]> {
  return query<DurationRow & Record<string, unknown>>(sql`
    WITH d AS (
      SELECT extract(year FROM pr.applied_date)::int AS year, pr.housing_type,
             'applied_to_issued' AS stage, pr.issued_date - pr.applied_date AS days
        FROM projects pr WHERE ${projectsInSegment(filters)} AND pr.issued_date IS NOT NULL
      UNION ALL
      SELECT extract(year FROM pr.applied_date)::int, pr.housing_type,
             'issued_to_completed', pr.completed_date - pr.issued_date
        FROM projects pr WHERE ${projectsInSegment(filters)} AND pr.completed_date IS NOT NULL AND pr.issued_date IS NOT NULL
    )
    SELECT year, housing_type AS "housingType", stage, count(*)::int AS projects,
           percentile_cont(0.25) WITHIN GROUP (ORDER BY days)::int AS p25,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY days)::int AS median,
           percentile_cont(0.75) WITHIN GROUP (ORDER BY days)::int AS p75
      FROM d WHERE days >= 0
     GROUP BY GROUPING SETS ((year, housing_type, stage), (year, stage))
     ORDER BY 1, 2
  `);
}

/** Durations pooled over every cohort in range up to `throughYear`, by type (null = all types). */
export async function getPooledDurations(filters: Filters, throughYear: number) {
  return query<Omit<DurationRow, "year"> & Record<string, unknown>>(sql`
    WITH d AS (
      SELECT pr.housing_type, 'applied_to_issued' AS stage, pr.issued_date - pr.applied_date AS days
        FROM projects pr
       WHERE ${projectsInSegment(filters)} AND pr.issued_date IS NOT NULL
         AND pr.applied_date < ${`${throughYear + 1}-01-01`}::date
      UNION ALL
      SELECT pr.housing_type, 'issued_to_completed', pr.completed_date - pr.issued_date
        FROM projects pr
       WHERE ${projectsInSegment(filters)} AND pr.completed_date IS NOT NULL AND pr.issued_date IS NOT NULL
         AND pr.applied_date < ${`${throughYear + 1}-01-01`}::date
    )
    SELECT housing_type AS "housingType", stage, count(*)::int AS projects,
           percentile_cont(0.25) WITHIN GROUP (ORDER BY days)::int AS p25,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY days)::int AS median,
           percentile_cont(0.75) WITHIN GROUP (ORDER BY days)::int AS p75
      FROM d WHERE days >= 0
     GROUP BY GROUPING SETS ((housing_type, stage), (stage))
  `);
}

/** The City started recording review time split between City and applicant for 2018 applications. */
export const REVIEW_DATA_START_YEAR = 2018;

export interface ReviewRow {
  year: number;
  housingType: HousingType | null;
  projects: number;
  cityDays: number;
  applicantDays: number;
  cycles: number;
}

/** Median days of City review vs. applicant corrections, and review cycles, on each project's main permit (M6). */
export async function getReviewBreakdown(filters: Filters): Promise<ReviewRow[]> {
  return query<ReviewRow & Record<string, unknown>>(sql`
    SELECT extract(year FROM pr.applied_date)::int AS year, pr.housing_type AS "housingType",
           count(*)::int AS projects,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY m.days_plan_review_city)::int AS "cityDays",
           percentile_cont(0.5) WITHIN GROUP (ORDER BY m.days_out_corrections)::int AS "applicantDays",
           percentile_cont(0.5) WITHIN GROUP (ORDER BY m.number_review_cycles)::numeric(4, 1)::float AS cycles
      FROM projects pr JOIN permits m ON m.permit_num = pr.main_permit_num
     WHERE ${projectsInSegment(filters)} AND m.days_plan_review_city IS NOT NULL
       AND pr.applied_date >= ${`${REVIEW_DATA_START_YEAR}-01-01`}::date
     GROUP BY GROUPING SETS ((1, 2), (1))
     ORDER BY 1, 2
  `);
}

/**
 * Time by which nearly all projects of a type finish: the 90th percentile of applied →
 * completed for settled cohorts. Cohorts younger than this are provisional (SPEC T3).
 */
export async function getProvisionalCutoffs(): Promise<Map<HousingType | "all", number>> {
  const rows = await query<{ housingType: HousingType | null; days: number }>(sql`
    SELECT housing_type AS "housingType",
           percentile_cont(0.9) WITHIN GROUP (ORDER BY completed_date - applied_date)::int AS days
      FROM projects
     WHERE completed_date IS NOT NULL AND applied_date >= '2012-01-01' AND applied_date < '2019-01-01'
     GROUP BY GROUPING SETS ((housing_type), ())
  `);
  return new Map(rows.map((r) => [r.housingType ?? "all", r.days]));
}

/** Whether a cohort year is still too young for its outcomes to be settled. */
export function isProvisionalCohort(year: number, cutoffDays: number, today = new Date()): boolean {
  const cohortEnd = Date.UTC(year, 11, 31);
  return cohortEnd + cutoffDays * 86_400_000 > today.getTime();
}

export interface StalledProject {
  projectKey: string;
  mainPermitNum: string;
  address: string | null;
  housingType: HousingType | null;
  units: number;
  stage: "applied" | "issued";
  stageStart: string;
  daysInStage: number;
  typicalDays: number;
  slowDays: number;
  expiresDate: string | null;
  link: string | null;
  latitude: number | null;
  longitude: number | null;
  craName: string | null;
  buildingPermits: number;
}

/** How far past the typical time in a stage counts as stalled. */
export const STALLED_PERCENTILE = 0.9;
/** Issued projects whose permit expires within this many days are listed as at risk. */
export const EXPIRING_WITHIN_DAYS = 90;

/**
 * Pipeline projects that have been in their current stage longer than 90% of past projects
 * of the same type, or whose permit is about to expire (V5). Ranked by units at risk.
 */
export async function getStalledProjects(filters: Filters, limit = 200): Promise<{ rows: StalledProject[]; total: number; units: number }> {
  const s = scope(bottleneckFilters(filters), { milestone: "applied", ignoreDates: true });
  const rows = await query<StalledProject & Record<string, unknown> & { total: number; total_units: number }>(sql`
    WITH history AS (
      SELECT housing_type, 'applied' AS stage,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY issued_date - applied_date) AS typical,
             percentile_cont(${STALLED_PERCENTILE}) WITHIN GROUP (ORDER BY issued_date - applied_date) AS slow
        FROM projects WHERE issued_date IS NOT NULL AND applied_date >= now() - interval '10 years'
       GROUP BY housing_type
      UNION ALL
      SELECT housing_type, 'issued',
             percentile_cont(0.5) WITHIN GROUP (ORDER BY completed_date - issued_date),
             percentile_cont(${STALLED_PERCENTILE}) WITHIN GROUP (ORDER BY completed_date - issued_date)
        FROM projects WHERE completed_date IS NOT NULL AND issued_date IS NOT NULL AND applied_date >= now() - interval '10 years'
       GROUP BY housing_type
    ),
    current AS (
      SELECT pr.*, CASE WHEN pr.stage = 'applied' THEN pr.applied_date
                        ELSE coalesce(pr.issued_date, pr.last_activity_date) END AS stage_start
        FROM projects pr
       WHERE pr.status_category = 'pipeline' AND pr.stage IN ('applied', 'issued')
         AND EXISTS (SELECT 1 FROM permits p WHERE p.project_key = pr.project_key AND ${s.where})
    ),
    flagged AS (
      SELECT c.*, (current_date - c.stage_start) AS days_in_stage, h.typical, h.slow
        FROM current c JOIN history h ON h.housing_type IS NOT DISTINCT FROM c.housing_type AND h.stage = c.stage
       WHERE current_date - c.stage_start > h.slow
          OR (c.stage = 'issued' AND c.expires_date BETWEEN current_date AND current_date + ${EXPIRING_WITHIN_DAYS}::int)
    )
    SELECT f.project_key AS "projectKey", f.main_permit_num AS "mainPermitNum", m.address,
           f.housing_type AS "housingType", f.units_added AS units, f.stage,
           to_char(f.stage_start, 'YYYY-MM-DD') AS "stageStart", f.days_in_stage AS "daysInStage",
           f.typical::int AS "typicalDays", f.slow::int AS "slowDays",
           to_char(f.expires_date, 'YYYY-MM-DD') AS "expiresDate", m.link, m.latitude, m.longitude, a.name AS "craName",
           f.building_permit_count AS "buildingPermits",
           count(*) OVER ()::int AS total, sum(f.units_added) OVER ()::int AS total_units
      FROM flagged f
      JOIN permits m ON m.permit_num = f.main_permit_num
      LEFT JOIN areas a ON a.id = f.cra_id
     ORDER BY f.units_added DESC, f.days_in_stage DESC
     LIMIT ${limit}
  `);
  return { rows, total: rows[0]?.total ?? 0, units: rows[0]?.total_units ?? 0 };
}
