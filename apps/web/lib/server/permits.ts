import "server-only";
import { sql } from "drizzle-orm";
import type { HousingType } from "@sbt/data/domain/housing-type";
import type { Filters, SORT_FIELDS, UnitKind } from "@/lib/filters";
import { query } from "./db";
import { scope } from "./scope";

export const PAGE_SIZE = 50;

export interface PermitRow {
  permitNum: string;
  permitType: string;
  address: string | null;
  craName: string | null;
  housingType: HousingType | null;
  housingTypeSource: "city" | "inferred" | null;
  /** Units this row contributes to the total: added minus removed, per the unit kind. */
  units: number;
  added: number;
  removed: number;
  statusCurrent: string | null;
  statusCategory: string;
  stage: string;
  appliedDate: string | null;
  issuedDate: string | null;
  completedDate: string | null;
  expiresDate: string | null;
  /** Date the row is credited at: the milestone date, or the issued date for demolitions. */
  creditedDate: string | null;
  projectKey: string;
  description: string | null;
  link: string | null;
}

export interface PermitList {
  rows: PermitRow[];
  totalPermits: number;
  totalUnits: number;
  totalAdded: number;
  totalRemoved: number;
  totalProjects: number;
  kind: UnitKind;
}

export async function listPermits(
  filters: Filters,
  opts: { sort: (typeof SORT_FIELDS)[number]; dir: "asc" | "desc"; page: number },
): Promise<PermitList> {
  const s = scope(filters);
  const order = { date: s.date, units: s.units, permit: sql.raw("p.permit_num") }[opts.sort];
  const direction = sql.raw(opts.dir === "asc" ? "ASC NULLS FIRST" : "DESC NULLS LAST");
  const offset = (Math.max(1, opts.page) - 1) * PAGE_SIZE;

  const [rows, [totals]] = await Promise.all([
    query<PermitRow & Record<string, unknown>>(sql`
      SELECT p.permit_num AS "permitNum", p.permit_type_mapped AS "permitType", p.address, a.name AS "craName",
             p.housing_type AS "housingType", p.housing_type_source AS "housingTypeSource",
             ${s.units}::int AS units, ${s.added}::int AS added, ${s.removed}::int AS removed,
             p.status_current AS "statusCurrent", p.status_category AS "statusCategory", p.stage,
             to_char(p.applied_date, 'YYYY-MM-DD') AS "appliedDate",
             to_char(p.issued_date, 'YYYY-MM-DD') AS "issuedDate",
             to_char(p.completed_date, 'YYYY-MM-DD') AS "completedDate",
             to_char(p.expires_date, 'YYYY-MM-DD') AS "expiresDate",
             to_char(${s.date}, 'YYYY-MM-DD') AS "creditedDate",
             p.project_key AS "projectKey", p.description, p.link
        FROM permits p LEFT JOIN areas a ON a.id = p.cra_id
       WHERE ${s.where}
       ORDER BY ${order} ${direction}, p.permit_num
       LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `),
    query<{ permits: number; units: number; added: number; removed: number; projects: number }>(sql`
      SELECT count(*)::int AS permits, coalesce(sum(${s.units}), 0)::int AS units,
             coalesce(sum(${s.added}), 0)::int AS added, coalesce(sum(${s.removed}), 0)::int AS removed,
             count(DISTINCT p.project_key)::int AS projects
        FROM permits p WHERE ${s.where}
    `),
  ]);

  return {
    rows,
    totalPermits: totals?.permits ?? 0,
    totalUnits: totals?.units ?? 0,
    totalAdded: totals?.added ?? 0,
    totalRemoved: totals?.removed ?? 0,
    totalProjects: totals?.projects ?? 0,
    kind: s.kind,
  };
}

export interface AreaOption {
  id: string;
  name: string;
}

export async function listAreas(): Promise<AreaOption[]> {
  return query<AreaOption & Record<string, unknown>>(sql`SELECT id, name FROM areas ORDER BY name`);
}

export async function listSubTypes(): Promise<string[]> {
  const rows = await query<{ sub: string }>(sql`
    SELECT DISTINCT permit_type_desc AS sub FROM permits p
     WHERE p.removed_at IS NULL AND p.permit_type_mapped = 'Building' AND p.housing_units_added > 0
       AND permit_type_desc IS NOT NULL
     ORDER BY 1
  `);
  return rows.map((r) => r.sub);
}
