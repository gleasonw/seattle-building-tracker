import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { DEFAULT_START, isoDate, type Filters, type Milestone } from "@/lib/filters";

/**
 * The single translation from filters to SQL (DEV_REWRITE_SPEC §5.2). Every aggregate and
 * every drill-down list uses it, which is what guarantees a list adds up to the number
 * that was clicked (SPEC X3). Conditions reference the `permits` table as `p`.
 */

const MILESTONE_COLUMN: Record<Milestone, SQL> = {
  applied: sql.raw("p.applied_date"),
  issued: sql.raw("p.issued_date"),
  completed: sql.raw("p.completed_date"),
};

export function milestoneColumn(on: Milestone): SQL {
  return MILESTONE_COLUMN[on];
}

/**
 * Housing permits: building permits that add units, still present in the source, excluding
 * shoring/excavation permits that restate their building's units (see "What we count").
 */
export const HOUSING_PERMITS = sql.raw(
  "p.removed_at IS NULL AND p.permit_type_mapped = 'Building' AND p.housing_units_added > 0 AND NOT p.site_prep_only",
);

const list = (values: readonly (string | number)[]) =>
  sql.join(
    values.map((v) => sql`${v}`),
    sql`, `,
  );

const MILES_TO_METERS = 1609.344;

export function dateRange(filters: Filters) {
  return {
    from: filters.from ?? DEFAULT_START,
    to: filters.to ?? isoDate(new Date()),
  };
}

/**
 * WHERE clause for housing permits matching the filters. The date range applies to the
 * selected milestone (default: completed), which must be present.
 */
export function filtersToWhere(filters: Filters, opts: { milestone?: Milestone; ignoreDates?: boolean } = {}): SQL {
  const on = opts.milestone ?? filters.on ?? "completed";
  const conditions: SQL[] = [HOUSING_PERMITS];

  if (!opts.ignoreDates) {
    const { from, to } = dateRange(filters);
    const col = milestoneColumn(on);
    conditions.push(sql`${col} >= ${from}::date AND ${col} <= ${to}::date`);
  }
  if (filters.status?.length) conditions.push(sql`p.status_category IN (${list(filters.status)})`);
  if (filters.type?.length) conditions.push(sql`p.housing_type IN (${list(filters.type)})`);
  if (filters.area?.length) conditions.push(sql`p.cra_id IN (${list(filters.area)})`);
  if (filters.sub?.length) conditions.push(sql`p.permit_type_desc IN (${list(filters.sub)})`);
  if (filters.min != null) conditions.push(sql`p.housing_units_added >= ${filters.min}`);
  if (filters.lat != null && filters.lng != null && filters.r != null) {
    conditions.push(
      sql`ST_DWithin(p.geom::geography, ST_SetSRID(ST_MakePoint(${filters.lng}, ${filters.lat}), 4326)::geography, ${filters.r * MILES_TO_METERS})`,
    );
  }
  return sql.join(conditions, sql` AND `);
}
