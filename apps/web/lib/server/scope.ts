import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { DEFAULT_START, isoDate, type Filters, type Milestone, type UnitKind } from "@/lib/filters";

/**
 * The single translation from filters to SQL (DEV_REWRITE_SPEC §5.2). Every aggregate and
 * every drill-down list uses it, which is what guarantees a list adds up to the number
 * that was clicked (SPEC X3). Conditions reference the `permits` table as `p`.
 *
 * Which permits count, and for how many units, depends on the unit kind (§4.8):
 * - added: building permits that add units, at the milestone date.
 * - removed: building permits that remove units (at the milestone date) and demolitions
 *   that were issued and not cancelled or lapsed (at the issued date, because demolition
 *   completion dates are often administrative closures years later).
 * - net: both. Only defined for completions; other milestones always count units added.
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
 * Housing permits: building permits that add units, excluding shoring/excavation permits
 * that restate their building's units (see "What we count").
 */
const HOUSING_SQL = "(p.permit_type_mapped = 'Building' AND p.housing_units_added > 0 AND NOT p.site_prep_only)";
const IS_HOUSING = sql.raw(HOUSING_SQL);
const IS_BUILDING_REMOVAL = sql.raw(
  "(p.permit_type_mapped = 'Building' AND p.housing_units_removed > 0 AND NOT p.site_prep_only)",
);
const IS_DEMOLITION = sql.raw(
  "(p.permit_type_mapped = 'Demolition' AND p.housing_units_removed > 0 AND p.issued_date IS NOT NULL AND p.status_category IN ('done', 'pipeline'))",
);
const LIVE = sql.raw("p.removed_at IS NULL");

/** Units a housing permit adds (zero for removal-only rows). */
export const ADDED_UNITS = sql.raw(`(CASE WHEN ${HOUSING_SQL} THEN p.housing_units_added ELSE 0 END)`);
/** Units a row removes, as a positive number. */
export const REMOVED_UNITS = sql.raw("coalesce(p.housing_units_removed, 0)");

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

export function unitKind(filters: Filters, milestone: Milestone): UnitKind {
  return milestone === "completed" ? (filters.units ?? "net") : "added";
}

/** Housing-type, size and sub-type conditions on a housing permit aliased `alias`. */
function segmentConditions(filters: Filters, alias: "p" | "b"): SQL[] {
  const c = (col: string) => sql.raw(`${alias}.${col}`);
  const out: SQL[] = [];
  if (filters.type?.length) out.push(sql`${c("housing_type")} IN (${list(filters.type)})`);
  if (filters.sub?.length) out.push(sql`${c("permit_type_desc")} IN (${list(filters.sub)})`);
  if (filters.min != null) out.push(sql`${c("housing_units_added")} >= ${filters.min}`);
  return out;
}

export interface Scope {
  milestone: Milestone;
  kind: UnitKind;
  where: SQL;
  /** Date each row is credited at. */
  date: SQL;
  /** Signed units each row contributes: `added - removed`. */
  units: SQL;
  /** The parts of `units`: units added and units removed (positive), per the kind. */
  added: SQL;
  removed: SQL;
}

/**
 * WHERE clause, date and unit expressions for permits matching the filters. The date range
 * applies to the selected milestone (default: completed), which must be present.
 */
export function scope(
  filters: Filters,
  opts: { milestone?: Milestone; units?: UnitKind; ignoreDates?: boolean } = {},
): Scope {
  const milestone = opts.milestone ?? filters.on ?? "completed";
  const kind = milestone === "completed" ? (opts.units ?? unitKind(filters, milestone)) : "added";
  const col = milestoneColumn(milestone);

  const date = kind === "added" ? col : sql`(CASE WHEN p.permit_type_mapped = 'Demolition' THEN p.issued_date ELSE ${col} END)`;
  const added = kind === "removed" ? sql.raw("0") : ADDED_UNITS;
  const removed = kind === "added" ? sql.raw("0") : REMOVED_UNITS;
  const units = sql`(${added} - ${removed})`;
  const rows =
    kind === "added"
      ? IS_HOUSING
      : kind === "removed"
        ? sql`(${IS_BUILDING_REMOVAL} OR ${IS_DEMOLITION})`
        : sql`(${IS_HOUSING} OR ${IS_BUILDING_REMOVAL} OR ${IS_DEMOLITION})`;

  const conditions: SQL[] = [LIVE, rows];

  if (!opts.ignoreDates) {
    const { from, to } = dateRange(filters);
    conditions.push(sql`${date} >= ${from}::date AND ${date} <= ${to}::date`);
  }
  if (filters.status?.length) conditions.push(sql`p.status_category IN (${list(filters.status)})`);
  if (filters.area?.length) conditions.push(sql`p.cra_id IN (${list(filters.area)})`);
  if (filters.lat != null && filters.lng != null && filters.r != null) {
    conditions.push(
      sql`ST_DWithin(p.geom::geography, ST_SetSRID(ST_MakePoint(${filters.lng}, ${filters.lat}), 4326)::geography, ${filters.r * MILES_TO_METERS})`,
    );
  }

  // Type, size and sub-type describe housing. Rows that only remove units (demolitions,
  // conversions) match if a housing permit on the same project does.
  const own = segmentConditions(filters, "p");
  if (own.length) {
    const ownMatch = sql.join(own, sql` AND `);
    if (kind === "added") {
      conditions.push(ownMatch);
    } else {
      const viaProject = sql`EXISTS (SELECT 1 FROM permits b
        WHERE b.project_key = p.project_key AND b.removed_at IS NULL AND b.permit_type_mapped = 'Building'
          AND b.housing_units_added > 0 AND NOT b.site_prep_only AND ${sql.join(segmentConditions(filters, "b"), sql` AND `)})`;
      conditions.push(sql`((${IS_HOUSING} AND ${ownMatch}) OR (NOT ${IS_HOUSING} AND ${viaProject}))`);
    }
  }

  return { milestone, kind, where: sql.join(conditions, sql` AND `), date, units, added, removed };
}
