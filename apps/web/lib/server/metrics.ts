import "server-only";
import { sql } from "drizzle-orm";
import type { HousingType } from "@sbt/data/domain/housing-type";
import type { Filters, Milestone, UnitKind } from "@/lib/filters";
import type { Support } from "@/lib/reliability";
import { query } from "./db";
import { dateRange, scope } from "./scope";

/** Units, permits, projects and concentration behind a set of filters (SPEC T2). */
export async function getSupport(filters: Filters, milestone?: Milestone, units?: UnitKind): Promise<Support> {
  const s = scope(filters, { milestone, units });
  const [row] = await query<{
    units: number;
    added: number;
    removed: number;
    permits: number;
    projects: number;
    top_units: number | null;
    top_label: string | null;
  }>(sql`
    WITH scoped AS (
      SELECT p.project_key, p.address, ${s.units} AS units, ${s.added} AS added, ${s.removed} AS removed
        FROM permits p WHERE ${s.where}
    ),
    by_project AS (
      SELECT project_key, sum(added)::int AS added, sum(removed)::int AS removed, min(address) AS address
        FROM scoped GROUP BY project_key
    ),
    top AS (SELECT * FROM by_project ORDER BY greatest(added, removed) DESC LIMIT 1)
    SELECT coalesce((SELECT sum(units) FROM scoped), 0)::int AS units,
           coalesce((SELECT sum(added) FROM scoped), 0)::int AS added,
           coalesce((SELECT sum(removed) FROM scoped), 0)::int AS removed,
           (SELECT count(*) FROM scoped)::int AS permits,
           (SELECT count(*) FROM by_project)::int AS projects,
           (SELECT greatest(added, removed) FROM top) AS top_units,
           (SELECT address FROM top) AS top_label
  `);
  return {
    totalUnits: row?.units ?? 0,
    addedUnits: row?.added ?? 0,
    removedUnits: row?.removed ?? 0,
    permitCount: row?.permits ?? 0,
    projectCount: row?.projects ?? 0,
    topProjectUnits: row?.top_units ?? 0,
    topProjectLabel: row?.top_label ?? null,
  };
}

export interface YearTypeRow {
  year: number;
  /** A housing type for units added, or "removed" for units removed (as a negative number). */
  series: HousingType | "removed";
  units: number;
}

/** Units per year: added by housing type, plus removals as their own (negative) series. */
export async function getUnitsByYearAndType(filters: Filters, milestone: Milestone): Promise<YearTypeRow[]> {
  const s = scope(filters, { milestone });
  const rows = await query<{ year: number; housing_type: HousingType | null; added: number; removed: number }>(sql`
    SELECT extract(year FROM ${s.date})::int AS year, p.housing_type,
           sum(${s.added})::int AS added, sum(${s.removed})::int AS removed
      FROM permits p
     WHERE ${s.where}
     GROUP BY 1, 2
     ORDER BY 1, 2
  `);
  const out: YearTypeRow[] = [];
  const removed = new Map<number, number>();
  for (const r of rows) {
    if (r.added > 0 && r.housing_type) out.push({ year: r.year, series: r.housing_type, units: r.added });
    if (r.removed > 0) removed.set(r.year, (removed.get(r.year) ?? 0) + r.removed);
  }
  for (const [year, units] of removed) out.push({ year, series: "removed", units: -units });
  return out;
}

export interface MonthPoint {
  month: string; // YYYY-MM-01
  units: number;
  trailing12: number | null;
}

/** Monthly units with a trailing 12-month total; months with no permits are zero. */
export async function getMonthlyWithTrailing(filters: Filters, milestone: Milestone): Promise<MonthPoint[]> {
  const { from, to } = dateRange(filters);
  // Look back 11 extra months so the first trailing total in range is complete.
  const lookback = { ...filters, from: shiftMonths(from, -11) };
  const s = scope(lookback, { milestone });
  const rows = await query<{ month: string; units: number; trailing12: number; n: number }>(sql`
    WITH months AS (
      SELECT generate_series(date_trunc('month', ${lookback.from}::date), date_trunc('month', ${to}::date), interval '1 month')::date AS month
    ),
    monthly AS (
      SELECT date_trunc('month', ${s.date})::date AS month, sum(${s.units})::int AS units
        FROM permits p
       WHERE ${s.where}
       GROUP BY 1
    )
    SELECT to_char(m.month, 'YYYY-MM-DD') AS month,
           coalesce(x.units, 0)::int AS units,
           sum(coalesce(x.units, 0)) OVER (ORDER BY m.month ROWS BETWEEN 11 PRECEDING AND CURRENT ROW)::int AS trailing12,
           count(*) OVER (ORDER BY m.month ROWS BETWEEN 11 PRECEDING AND CURRENT ROW)::int AS n
      FROM months m LEFT JOIN monthly x USING (month)
     ORDER BY m.month
  `);
  return rows
    .filter((r) => r.month >= from.slice(0, 7) + "-01")
    .map((r) => ({ month: r.month, units: r.units, trailing12: r.n === 12 ? r.trailing12 : null }));
}

export interface PeriodComparison {
  current: Support & { from: string; to: string };
  previous: Support & { from: string; to: string };
}

/** Units for an aligned window this year vs. the same window last year (SPEC V1). */
export async function getYearToDate(filters: Filters, milestone: Milestone, today = new Date()): Promise<PeriodComparison> {
  const year = today.getUTCFullYear();
  const md = today.toISOString().slice(5, 10);
  const current = { from: `${year}-01-01`, to: `${year}-${md}` };
  const previous = { from: `${year - 1}-01-01`, to: `${year - 1}-${md === "02-29" ? "02-28" : md}` };
  const [c, p] = await Promise.all([
    getSupport({ ...filters, ...current }, milestone),
    getSupport({ ...filters, ...previous }, milestone),
  ]);
  return { current: { ...c, ...current }, previous: { ...p, ...previous } };
}

export interface TopPermit {
  permitNum: string;
  address: string | null;
  units: number;
  date: string | null;
  housingType: HousingType | null;
  link: string | null;
  projectKey: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
}

/** The permits adding the most units. */
export async function getTopPermits(filters: Filters, milestone: Milestone, limit = 10): Promise<TopPermit[]> {
  const s = scope(filters, { milestone, units: "added" });
  return query<TopPermit & Record<string, unknown>>(sql`
    SELECT p.permit_num AS "permitNum", p.address, p.housing_units_added AS units,
           to_char(${s.date}, 'YYYY-MM-DD') AS date, p.housing_type AS "housingType", p.link, p.latitude, p.longitude,
           p.project_key AS "projectKey", p.description
      FROM permits p
     WHERE ${s.where}
     ORDER BY p.housing_units_added DESC, ${s.date} DESC
     LIMIT ${limit}
  `);
}

/** How much of a total depends on inferred or unknown housing types (SPEC T4). */
export async function getTypeSourceShares(filters: Filters, milestone: Milestone) {
  const [row] = await query<{ total: number; inferred: number; unknown: number }>(sql`
    SELECT coalesce(sum(p.housing_units_added), 0)::int AS total,
           coalesce(sum(p.housing_units_added) FILTER (WHERE p.housing_type_source = 'inferred'), 0)::int AS inferred,
           coalesce(sum(p.housing_units_added) FILTER (WHERE p.housing_type = 'other'), 0)::int AS unknown
      FROM permits p WHERE ${scope(filters, { milestone, units: "added" }).where}
  `);
  const total = row?.total ?? 0;
  return {
    inferredShare: total ? (row!.inferred / total) : 0,
    unknownShare: total ? (row!.unknown / total) : 0,
  };
}

export interface PolicyEvent {
  date: string;
  label: string;
  detail: string | null;
  url: string;
}

/** Only verified annotations are ever shown (SPEC V1). */
export async function getPolicyEvents(): Promise<PolicyEvent[]> {
  return query<PolicyEvent & Record<string, unknown>>(sql`
    SELECT to_char(date, 'YYYY-MM-DD') AS date, label, detail, url
      FROM policy_events WHERE verified_on IS NOT NULL ORDER BY date
  `);
}

export interface Freshness {
  lastSuccessAt: string | null;
  lastRunStatus: string | null;
  /** No successful sync in the last 48 hours (SPEC T5). */
  stale: boolean;
}

export async function getFreshness(): Promise<Freshness> {
  const [row] = await query<{ last_success: string | null; last_status: string | null; stale: boolean }>(sql`
    WITH s AS (SELECT max(finished_at) AS t FROM sync_runs WHERE status = 'success')
    SELECT (SELECT t FROM s)::text AS last_success,
           (SELECT status FROM sync_runs ORDER BY id DESC LIMIT 1) AS last_status,
           coalesce((SELECT t FROM s) < now() - interval '48 hours', true) AS stale
  `);
  return {
    lastSuccessAt: row?.last_success ?? null,
    lastRunStatus: row?.last_status ?? null,
    stale: row?.stale ?? true,
  };
}

function shiftMonths(isoDay: string, months: number): string {
  const d = new Date(`${isoDay}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}
