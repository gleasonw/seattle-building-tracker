import "server-only";
import { sql, type SQL } from "drizzle-orm";
import type { HousingType } from "@sbt/data/domain/housing-type";
import type { Filters, Stage } from "@/lib/filters";
import { formatAddress } from "@/lib/format";
import { query } from "./db";
import { buildingRemovalSql, demolitionSql, expiringSql, housingSql, source, stageSinceSql, stageSql, stalledSql } from "./scope";

export const PAGE_SIZE = 50;

export type ProjectSort = "units" | "address" | "time" | "movement";

export interface ProjectRow {
  projectKey: string;
  mainPermit: string;
  address: string | null;
  /** Units this project contributes to the number: signed (net) where removals count. */
  units: number;
  added: number;
  removed: number;
  permits: number;
  housingType: HousingType | null;
  stage: Stage;
  stageSince: string | null;
  expiresDate: string | null;
  stalled: boolean;
  expiring: boolean;
  /** City status of the main permit, to explain "permit expired" while the City says issued. */
  cityStatus: string | null;
  lastMovement: string | null;
  /** Units across the project's live housing permits, and how many of them are completed. */
  projectUnits: number;
  completedUnits: number;
  hoodId: string | null;
  hoodName: string | null;
  lat: number | null;
  lng: number | null;
}

export interface ProjectList {
  rows: ProjectRow[];
  totalUnits: number;
  totalAdded: number;
  totalRemoved: number;
  totalPermits: number;
  totalProjects: number;
}

/** Per-project details for a set of project keys (CTE `bp` with project_key and any_permit). */
function projectInfoColumns(today: string): SQL {
  return sql`
    m.permit_num AS "mainPermit", m.address, pr.housing_type AS "housingType",
    ${stageSql("m", today)} AS stage,
    to_char(${stageSinceSql("m", today)}, 'YYYY-MM-DD') AS "stageSince",
    to_char(m.expires_date, 'YYYY-MM-DD') AS "expiresDate",
    ${stalledSql("m", today)} AS stalled,
    ${expiringSql("m", today)} AS expiring,
    m.status_current AS "cityStatus",
    to_char(lm.last_movement, 'YYYY-MM-DD') AS "lastMovement",
    coalesce(lm.project_units, 0)::int AS "projectUnits",
    coalesce(lm.completed_units, 0)::int AS "completedUnits",
    m.neighborhood_id AS "hoodId", h.name AS "hoodName", m.latitude AS lat, m.longitude AS lng`;
}

function projectInfoJoins(today: string): SQL {
  return sql`
    LEFT JOIN projects pr ON pr.project_key = bp.project_key
    JOIN permits m ON m.permit_num = coalesce(pr.main_permit_num, bp.any_permit)
    LEFT JOIN places h ON h.id = m.neighborhood_id
    LEFT JOIN LATERAL (
      SELECT max(greatest(x.applied_date, x.issued_date, x.completed_date,
                          CASE WHEN ${stageSql("x", today)} = 'expired' THEN x.expires_date END)) AS last_movement,
             sum(x.housing_units_added) FILTER (WHERE ${stageSql("x", today)} <> 'dead') AS project_units,
             sum(x.housing_units_added) FILTER (WHERE ${stageSql("x", today)} = 'completed') AS completed_units
        FROM permits x
       WHERE x.project_key = bp.project_key AND x.removed_at IS NULL AND ${housingSql("x")}
    ) lm ON true`;
}

const ORDER: Record<ProjectSort, SQL> = {
  units: sql`abs(bp.units) DESC, bp.added DESC`,
  address: sql`m.address ASC NULLS LAST`,
  time: sql`"stageSince" ASC NULLS LAST`,
  movement: sql`lm.last_movement DESC NULLS LAST`,
};

/** The projects behind a number, with totals computed from exactly these rows (SPEC T1). */
export async function listProjects(
  filters: Filters,
  today: string,
  opts: { sort?: ProjectSort; page?: number; limit?: number | null } = {},
): Promise<ProjectList> {
  const limit = opts.limit === null ? null : (opts.limit ?? PAGE_SIZE);
  const offset = limit ? (Math.max(1, opts.page ?? 1) - 1) * limit : 0;
  const src = source(filters, today);
  const [rows, [totals]] = await Promise.all([
    query<ProjectRow & Record<string, unknown>>(sql`
      WITH src AS (${src}),
      bp AS (
        SELECT project_key, sum(units)::int AS units, sum(added)::int AS added, sum(removed)::int AS removed,
               count(*)::int AS permits, min(permit_num) AS any_permit
          FROM src GROUP BY project_key
      )
      SELECT bp.project_key AS "projectKey", bp.units, bp.added, bp.removed, bp.permits, ${projectInfoColumns(today)}
        FROM bp ${projectInfoJoins(today)}
       ORDER BY ${ORDER[opts.sort ?? "units"]}, bp.project_key
       ${limit ? sql`LIMIT ${limit} OFFSET ${offset}` : sql``}
    `),
    query<{ units: number; added: number; removed: number; permits: number; projects: number }>(sql`
      SELECT coalesce(sum(units), 0)::int AS units, coalesce(sum(added), 0)::int AS added,
             coalesce(sum(removed), 0)::int AS removed, count(*)::int AS permits,
             count(DISTINCT project_key)::int AS projects
        FROM (${src}) src
    `),
  ]);
  return {
    rows: rows.map((r) => ({ ...r, address: formatAddress(r.address) })),
    totalUnits: totals?.units ?? 0,
    totalAdded: totals?.added ?? 0,
    totalRemoved: totals?.removed ?? 0,
    totalPermits: totals?.permits ?? 0,
    totalProjects: totals?.projects ?? 0,
  };
}

export interface ProjectPermit {
  permitNum: string;
  permitType: string;
  typeDesc: string | null;
  description: string | null;
  added: number;
  removed: number;
  /** Counts toward units added (a housing permit). */
  counted: boolean;
  /** Its removals count toward units removed. */
  removalCounted: boolean;
  appliedDate: string | null;
  issuedDate: string | null;
  completedDate: string | null;
  expiresDate: string | null;
  stage: Stage;
  cityStatus: string | null;
  link: string | null;
}

export interface ProjectDetail extends Omit<ProjectRow, "units" | "added" | "removed" | "permits"> {
  description: string | null;
  link: string | null;
  housingTypeSource: "city" | "inferred" | null;
  appliedDate: string | null;
  issuedDate: string | null;
  completedDate: string | null;
  centerId: string | null;
  centerName: string | null;
  unitsAdded: number;
  unitsRemoved: number;
  permits: ProjectPermit[];
}

/** A project by any of its permit numbers (SPEC P4). */
export async function getProject(permitNum: string, today: string): Promise<ProjectDetail | null> {
  const [head] = await query<Omit<ProjectDetail, "permits" | "unitsAdded" | "unitsRemoved">>(sql`
    WITH bp AS (
      SELECT p.project_key, (SELECT min(x.permit_num) FROM permits x WHERE x.project_key = p.project_key AND x.removed_at IS NULL) AS any_permit
        FROM permits p WHERE p.permit_num = ${permitNum}
    )
    SELECT bp.project_key AS "projectKey", ${projectInfoColumns(today)},
           m.description, m.link, m.housing_type_source AS "housingTypeSource",
           to_char(m.applied_date, 'YYYY-MM-DD') AS "appliedDate",
           to_char(m.issued_date, 'YYYY-MM-DD') AS "issuedDate",
           to_char(m.completed_date, 'YYYY-MM-DD') AS "completedDate",
           m.center_id AS "centerId", c.name AS "centerName"
      FROM bp ${projectInfoJoins(today)}
      LEFT JOIN places c ON c.id = m.center_id
  `);
  if (!head) return null;
  const permits = await query<ProjectPermit & Record<string, unknown>>(sql`
    SELECT p.permit_num AS "permitNum", p.permit_type_mapped AS "permitType", p.permit_type_desc AS "typeDesc",
           p.description,
           CASE WHEN ${housingSql("p")} THEN p.housing_units_added ELSE 0 END AS added,
           coalesce(p.housing_units_removed, 0) AS removed,
           ${housingSql("p")} AS counted,
           (${buildingRemovalSql("p")} OR ${demolitionSql("p")}) AS "removalCounted",
           to_char(p.applied_date, 'YYYY-MM-DD') AS "appliedDate",
           to_char(p.issued_date, 'YYYY-MM-DD') AS "issuedDate",
           to_char(p.completed_date, 'YYYY-MM-DD') AS "completedDate",
           to_char(p.expires_date, 'YYYY-MM-DD') AS "expiresDate",
           ${stageSql("p", today)} AS stage, p.status_current AS "cityStatus", p.link
      FROM permits p
     WHERE p.project_key = ${head.projectKey} AND p.removed_at IS NULL
     ORDER BY (p.permit_num = ${head.mainPermit}) DESC, p.permit_type_mapped, p.applied_date NULLS LAST, p.permit_num
  `);
  // Units as the project counts them: dead permits only when the whole project died (they
  // were usually superseded); removals as the totals count them (scope.ts).
  const live = permits.filter((p) => p.stage !== "dead");
  const counted = live.length ? live : permits;
  return {
    ...head,
    address: formatAddress(head.address),
    permits,
    unitsAdded: counted.reduce((s, p) => s + p.added, 0),
    unitsRemoved: permits.filter((p) => p.removalCounted).reduce((s, p) => s + p.removed, 0),
  };
}

export interface AddressPermit {
  permitNum: string;
  permitType: string;
  typeDesc: string | null;
  description: string | null;
  units: number;
  cityStatus: string | null;
  appliedDate: string | null;
  issuedDate: string | null;
  completedDate: string | null;
  link: string | null;
}

/**
 * Permits at the same address that aren't part of the project, including ones that add no
 * units (shoring, tenant improvements). They can show work going on that the project's own
 * permits don't record (SPEC P4).
 */
export async function getOtherPermitsAtAddress(address: string | null, projectKey: string): Promise<AddressPermit[]> {
  if (!address?.trim()) return [];
  return query<AddressPermit & Record<string, unknown>>(sql`
    SELECT p.permit_num AS "permitNum", p.permit_type_mapped AS "permitType", p.permit_type_desc AS "typeDesc",
           p.description, coalesce(p.housing_units_added, 0) AS units, p.status_current AS "cityStatus",
           to_char(p.applied_date, 'YYYY-MM-DD') AS "appliedDate",
           to_char(p.issued_date, 'YYYY-MM-DD') AS "issuedDate",
           to_char(p.completed_date, 'YYYY-MM-DD') AS "completedDate", p.link
      FROM permits p
     WHERE p.removed_at IS NULL AND p.project_key <> ${projectKey}
       AND upper(regexp_replace(trim(p.address), '[[:space:]]+', ' ', 'g')) = upper(regexp_replace(trim(${address}), '[[:space:]]+', ' ', 'g'))
     ORDER BY greatest(p.applied_date, p.issued_date, p.completed_date) DESC NULLS LAST, p.permit_num
     LIMIT 50
  `);
}
