import "server-only";
import { sql } from "drizzle-orm";
import { measureInferenceAccuracy, type AccuracyReport } from "@sbt/data/domain/housing-type-accuracy";
import { query } from "./db";

/** Live sizes of everything that isn't counted, for the "What we count" page (SPEC T6). */
type ExclusionCounts = Record<
  | "housing_permits"
  | "housing_units"
  | "no_units_permits"
  | "pre_intake_permits"
  | "pre_intake_units"
  | "lapsed_permits"
  | "lapsed_units"
  | "unlocated_permits"
  | "unlocated_units"
  | "demolition_permits"
  | "demolition_units_added"
  | "demolition_units_removed"
  | "demolition_units_counted"
  | "demolition_units_uncounted"
  | "building_units_removed"
  | "site_prep_permits"
  | "site_prep_units"
  | "restated_permits"
  | "restated_units",
  number
>;

export async function getExclusions() {
  const [row] = await query<ExclusionCounts>(sql`
    SELECT
      count(*) FILTER (WHERE permit_type_mapped = 'Building' AND housing_units_added > 0 AND NOT site_prep_only AND NOT restated_units)::int AS housing_permits,
      coalesce(sum(housing_units_added) FILTER (WHERE permit_type_mapped = 'Building' AND housing_units_added > 0 AND NOT site_prep_only AND NOT restated_units), 0)::int AS housing_units,
      count(*) FILTER (WHERE restated_units)::int AS restated_permits,
      coalesce(sum(housing_units_added) FILTER (WHERE restated_units), 0)::int AS restated_units,
      count(*) FILTER (WHERE permit_type_mapped = 'Building' AND housing_units_added > 0 AND site_prep_only)::int AS site_prep_permits,
      coalesce(sum(housing_units_added) FILTER (WHERE permit_type_mapped = 'Building' AND housing_units_added > 0 AND site_prep_only), 0)::int AS site_prep_units,
      count(*) FILTER (WHERE permit_type_mapped = 'Building' AND coalesce(housing_units_added, 0) <= 0)::int AS no_units_permits,
      count(*) FILTER (WHERE permit_type_mapped = 'Building' AND housing_units_added > 0 AND stage = 'pre_intake')::int AS pre_intake_permits,
      coalesce(sum(housing_units_added) FILTER (WHERE permit_type_mapped = 'Building' AND housing_units_added > 0 AND stage = 'pre_intake'), 0)::int AS pre_intake_units,
      count(*) FILTER (WHERE permit_type_mapped = 'Building' AND housing_units_added > 0 AND stage = 'lapsed')::int AS lapsed_permits,
      coalesce(sum(housing_units_added) FILTER (WHERE permit_type_mapped = 'Building' AND housing_units_added > 0 AND stage = 'lapsed'), 0)::int AS lapsed_units,
      count(*) FILTER (WHERE permit_type_mapped = 'Building' AND housing_units_added > 0 AND cra_id IS NULL)::int AS unlocated_permits,
      coalesce(sum(housing_units_added) FILTER (WHERE permit_type_mapped = 'Building' AND housing_units_added > 0 AND cra_id IS NULL), 0)::int AS unlocated_units,
      count(*) FILTER (WHERE permit_type_mapped = 'Demolition')::int AS demolition_permits,
      coalesce(sum(housing_units_added) FILTER (WHERE permit_type_mapped = 'Demolition'), 0)::int AS demolition_units_added,
      coalesce(sum(housing_units_removed) FILTER (WHERE permit_type_mapped = 'Demolition'), 0)::int AS demolition_units_removed,
      coalesce(sum(housing_units_removed) FILTER (WHERE permit_type_mapped = 'Demolition' AND issued_date IS NOT NULL AND status_category IN ('done', 'pipeline')), 0)::int AS demolition_units_counted,
      coalesce(sum(housing_units_removed) FILTER (WHERE permit_type_mapped = 'Demolition' AND NOT (issued_date IS NOT NULL AND status_category IN ('done', 'pipeline'))), 0)::int AS demolition_units_uncounted,
      coalesce(sum(housing_units_removed) FILTER (WHERE permit_type_mapped = 'Building' AND NOT site_prep_only), 0)::int AS building_units_removed
    FROM permits WHERE removed_at IS NULL
  `);
  const [removed] = await query<{ n: number }>(sql`SELECT count(*)::int AS n FROM permits WHERE removed_at IS NOT NULL`);
  const [projects] = await query<{ projects: number; grouped: number }>(sql`
    SELECT count(*)::int AS projects, count(*) FILTER (WHERE building_permit_count > 1)::int AS grouped FROM projects
  `);
  return { ...row!, removed: removed?.n ?? 0, projects: projects?.projects ?? 0, multiPermitProjects: projects?.grouped ?? 0 };
}

/** Classifier accuracy on years where the City recorded dwelling types (2018–2023). */
export async function getHousingTypeAccuracy(): Promise<AccuracyReport & { from: number; to: number }> {
  const from = 2018;
  const to = 2023;
  const rows = await query<{
    permitTypeMapped: string;
    housingUnitsAdded: number;
    dwellingUnitType: string;
    housingCategory: string | null;
    permitClass: string | null;
    description: string | null;
  }>(sql`
    SELECT permit_type_mapped AS "permitTypeMapped", housing_units_added AS "housingUnitsAdded",
           dwelling_unit_type AS "dwellingUnitType", housing_category AS "housingCategory",
           permit_class AS "permitClass", description
      FROM permits
     WHERE removed_at IS NULL AND permit_type_mapped = 'Building' AND housing_units_added > 0
       AND dwelling_unit_type IS NOT NULL AND extract(year FROM applied_date) BETWEEN ${from} AND ${to}
  `);
  return { ...measureInferenceAccuracy(rows), from, to };
}

/** Share of recent applications where the City recorded a dwelling type. */
export async function getDwellingTypeCoverage() {
  return query<{ year: number; coverage: number }>(sql`
    SELECT extract(year FROM applied_date)::int AS year,
           round(100.0 * count(dwelling_unit_type) / count(*))::int AS coverage
      FROM permits
     WHERE removed_at IS NULL AND permit_type_mapped = 'Building' AND housing_units_added > 0
       AND applied_date >= date_trunc('year', now()) - interval '4 years'
     GROUP BY 1 ORDER BY 1
  `);
}
