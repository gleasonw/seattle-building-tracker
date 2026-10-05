import "server-only";
import { sql } from "drizzle-orm";
import type { HousingType } from "@sbt/data/domain/housing-type";
import type { Filters, Milestone } from "@/lib/filters";
import { query } from "./db";
import { filtersToWhere, milestoneColumn } from "./scope";

export const PAGE_SIZE = 50;

export interface PermitRow {
  permitNum: string;
  address: string | null;
  craName: string | null;
  housingType: HousingType | null;
  housingTypeSource: "city" | "inferred" | null;
  units: number;
  unitsRemoved: number | null;
  statusCurrent: string | null;
  statusCategory: string;
  stage: string;
  appliedDate: string | null;
  issuedDate: string | null;
  completedDate: string | null;
  expiresDate: string | null;
  projectKey: string;
  description: string | null;
  link: string | null;
}

export interface PermitList {
  rows: PermitRow[];
  totalPermits: number;
  totalUnits: number;
  totalProjects: number;
}

const SORT_SQL = {
  date: (on: Milestone) => milestoneColumn(on),
  units: () => sql.raw("p.housing_units_added"),
  permit: () => sql.raw("p.permit_num"),
};

export async function listPermits(
  filters: Filters,
  opts: { sort: keyof typeof SORT_SQL; dir: "asc" | "desc"; page: number },
): Promise<PermitList> {
  const on = filters.on ?? "completed";
  const where = filtersToWhere(filters, { milestone: on });
  const order = SORT_SQL[opts.sort](on);
  const direction = sql.raw(opts.dir === "asc" ? "ASC NULLS FIRST" : "DESC NULLS LAST");
  const offset = (Math.max(1, opts.page) - 1) * PAGE_SIZE;

  const [rows, [totals]] = await Promise.all([
    query<PermitRow & Record<string, unknown>>(sql`
      SELECT p.permit_num AS "permitNum", p.address, a.name AS "craName",
             p.housing_type AS "housingType", p.housing_type_source AS "housingTypeSource",
             p.housing_units_added AS units, p.housing_units_removed AS "unitsRemoved",
             p.status_current AS "statusCurrent", p.status_category AS "statusCategory", p.stage,
             to_char(p.applied_date, 'YYYY-MM-DD') AS "appliedDate",
             to_char(p.issued_date, 'YYYY-MM-DD') AS "issuedDate",
             to_char(p.completed_date, 'YYYY-MM-DD') AS "completedDate",
             to_char(p.expires_date, 'YYYY-MM-DD') AS "expiresDate",
             p.project_key AS "projectKey", p.description, p.link
        FROM permits p LEFT JOIN areas a ON a.id = p.cra_id
       WHERE ${where}
       ORDER BY ${order} ${direction}, p.permit_num
       LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `),
    query<{ permits: number; units: number; projects: number }>(sql`
      SELECT count(*)::int AS permits, coalesce(sum(p.housing_units_added), 0)::int AS units,
             count(DISTINCT p.project_key)::int AS projects
        FROM permits p WHERE ${where}
    `),
  ]);

  return {
    rows,
    totalPermits: totals?.permits ?? 0,
    totalUnits: totals?.units ?? 0,
    totalProjects: totals?.projects ?? 0,
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
