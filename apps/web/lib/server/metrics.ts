import "server-only";
import { sql, type SQL } from "drizzle-orm";
import type { HousingType } from "@sbt/data/domain/housing-type";
import type { Filters } from "@/lib/filters";
import type { Support } from "@/lib/reliability";
import { formatAddress } from "@/lib/format";
import { query } from "./db";
import { source } from "./scope";

/** Units, permits, projects and the largest project behind a number (SPEC T2). */
export async function summarize(filters: Filters, today: string): Promise<Support> {
  const [row] = await query<{
    units: number;
    added: number;
    removed: number;
    permits: number;
    projects: number;
    top_units: number | null;
    top_label: string | null;
  }>(sql`
    WITH src AS (${source(filters, today)}),
    by_project AS (
      SELECT project_key, sum(added)::int AS added, sum(removed)::int AS removed, min(permit_num) AS any_permit
        FROM src GROUP BY project_key
    ),
    top AS (SELECT * FROM by_project ORDER BY greatest(added, removed) DESC, project_key LIMIT 1)
    SELECT coalesce((SELECT sum(units) FROM src), 0)::int AS units,
           coalesce((SELECT sum(added) FROM src), 0)::int AS added,
           coalesce((SELECT sum(removed) FROM src), 0)::int AS removed,
           (SELECT count(*) FROM src)::int AS permits,
           (SELECT count(*) FROM by_project)::int AS projects,
           (SELECT greatest(added, removed) FROM top) AS top_units,
           (SELECT m.address FROM top
              LEFT JOIN projects pr ON pr.project_key = top.project_key
              JOIN permits m ON m.permit_num = coalesce(pr.main_permit_num, top.any_permit)) AS top_label
  `);
  return {
    totalUnits: row?.units ?? 0,
    addedUnits: row?.added ?? 0,
    removedUnits: row?.removed ?? 0,
    permitCount: row?.permits ?? 0,
    projectCount: row?.projects ?? 0,
    topProjectUnits: row?.top_units ?? 0,
    topProjectLabel: formatAddress(row?.top_label ?? null),
  };
}

export interface GroupTotal {
  key: string;
  units: number;
  added: number;
  removed: number;
  permits: number;
  projects: number;
}

const GROUP_KEYS = {
  year: sql`extract(year FROM d)::int::text`,
  hood: sql`hood`,
  center: sql`center`,
  ptype: sql`ptype`,
  stage: sql`stage`,
  outcome: sql`(CASE stage WHEN 'completed' THEN 'completed' WHEN 'expired' THEN 'expired' WHEN 'dead' THEN 'dead' ELSE 'progress' END)`,
} satisfies Record<string, SQL>;

/** Totals per group (year, neighborhood, type…). Each group's list is the same filters plus that group. */
export async function totalsBy(filters: Filters, today: string, by: keyof typeof GROUP_KEYS): Promise<GroupTotal[]> {
  const key = GROUP_KEYS[by];
  return query<GroupTotal & Record<string, unknown>>(sql`
    SELECT ${key} AS key, sum(units)::int AS units, sum(added)::int AS added, sum(removed)::int AS removed,
           count(*)::int AS permits, count(DISTINCT project_key)::int AS projects
      FROM (${source(filters, today)}) src
     GROUP BY 1
     ORDER BY 2 DESC
  `);
}

/** How much of a total's housing type is inferred or unknown (SPEC T4), by the main permit's type. */
export async function getTypeSourceShares(filters: Filters, today: string) {
  const [row] = await query<{ total: number; inferred: number; unknown: number }>(sql`
    SELECT coalesce(sum(src.added), 0)::int AS total,
           coalesce(sum(src.added) FILTER (WHERE m.housing_type_source = 'inferred'), 0)::int AS inferred,
           coalesce(sum(src.added) FILTER (WHERE src.ptype = 'other'), 0)::int AS unknown
      FROM (${source({ ...filters, units: "added" }, today)}) src
      LEFT JOIN projects pr ON pr.project_key = src.project_key
      LEFT JOIN permits m ON m.permit_num = pr.main_permit_num
  `);
  const total = row?.total ?? 0;
  return { inferredShare: total ? row!.inferred / total : 0, unknownShare: total ? row!.unknown / total : 0 };
}

export interface TypeTotal {
  type: HousingType;
  units: number;
  projects: number;
}

export interface PolicyEvent {
  date: string;
  label: string;
  detail: string | null;
  url: string;
}

/** Only verified annotations are ever shown (SPEC P1 "The long view"). */
export async function getPolicyEvents(): Promise<PolicyEvent[]> {
  return query<PolicyEvent & Record<string, unknown>>(sql`
    SELECT to_char(date, 'YYYY-MM-DD') AS date, label, detail, url
      FROM policy_events WHERE verified_on IS NOT NULL ORDER BY date
  `);
}

export interface Freshness {
  lastSuccessAt: string | null;
  lastRunStatus: string | null;
  /** Why the latest run failed, if it did. */
  lastError: string | null;
  /** No successful sync in the last 48 hours (SPEC T5). */
  stale: boolean;
}

export async function getFreshness(): Promise<Freshness> {
  const [row] = await query<{ last_success: string | null; last_status: string | null; last_error: string | null; stale: boolean }>(sql`
    WITH s AS (SELECT max(finished_at) AS t FROM sync_runs WHERE status = 'success')
    SELECT (SELECT t FROM s)::text AS last_success,
           (SELECT status FROM sync_runs ORDER BY id DESC LIMIT 1) AS last_status,
           (SELECT error FROM sync_runs ORDER BY id DESC LIMIT 1) AS last_error,
           coalesce((SELECT t FROM s) < now() - interval '48 hours', true) AS stale
  `);
  return {
    lastSuccessAt: row?.last_success ?? null,
    lastRunStatus: row?.last_status ?? null,
    // Errors the sync marked internal (database/network) may contain hosts or SQL: never show them.
    lastError:
      row?.last_status === "failed" && row.last_error && !row.last_error.startsWith("internal: ") ? row.last_error : null,
    stale: row?.stale ?? true,
  };
}
