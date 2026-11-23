import "server-only";
import { sql, type SQL } from "drizzle-orm";
import type { Filters, Measure, Stage, UnitKind, Where } from "@/lib/filters";
import {
  EXPIRED_GRACE_DAYS,
  EXPIRING_SOON_MONTHS,
  STALLED_ISSUED_YEARS,
  STALLED_REVIEW_YEARS,
} from "@/lib/rules";

/**
 * The single translation from filters to SQL. Every number on every page, and the project
 * list behind it, is a sum over `source()`, which is what guarantees a list adds up to the
 * number that was clicked (SPEC T1).
 *
 * Which permits count, and for how many units, depends on the measure (SPEC §2–3):
 * - completed / issued / applied: credited per permit at its milestone date.
 *   - added: building permits that add units. Demolitions never add units, whatever they report.
 *   - removed: building permits that remove units (at the milestone date) and demolitions
 *     that were issued and not cancelled or lapsed (at the issued date, because demolition
 *     completion dates are often administrative closures years later).
 *   - net: both. Only for completions ("homes completed"); other milestones count units added.
 * - pipeline / proposals: as of today, by project. A project is in the pipeline when its main
 *   permit is in review or issued; it counts the units on its permits that are still in progress.
 * - outcome: units applied for in the period, by what has happened to each permit since.
 */

const c = (alias: string, column: string) => sql.raw(`${alias}.${column}`);

/** A building permit that adds housing (not shoring-only, not restating another permit's units). */
export const housingSql = (a: string) =>
  sql.raw(
    `(${a}.permit_type_mapped = 'Building' AND ${a}.housing_units_added > 0 AND NOT ${a}.site_prep_only AND NOT ${a}.restated_units)`,
  );
export const buildingRemovalSql = (a: string) =>
  sql.raw(`(${a}.permit_type_mapped = 'Building' AND ${a}.housing_units_removed > 0 AND NOT ${a}.site_prep_only)`);
export const demolitionSql = (a: string) =>
  sql.raw(
    `(${a}.permit_type_mapped = 'Demolition' AND ${a}.housing_units_removed > 0 AND ${a}.issued_date IS NOT NULL AND ${a}.status_category IN ('done', 'pipeline'))`,
  );
/** Units a permit adds (zero for removal-only rows). */
export const addedSql = (a: string) => sql`(CASE WHEN ${housingSql(a)} THEN ${c(a, "housing_units_added")} ELSE 0 END)`;
const removedSql = (a: string) => sql.raw(`coalesce(${a}.housing_units_removed, 0)`);

/**
 * A permit's stage (SPEC §2 "Stage"). A recorded completion date wins over the City's status:
 * a permit with a completion date is completed even if its status says Expired or still
 * Issued, unless it is dead (cancelled, denied, withdrawn), which never counts as completed.
 * An issued permit past its expiration date with no completion is "expired" even while the
 * City still lists it as issued.
 */
export function stageSql(a: string, today: string): SQL {
  return sql`(CASE WHEN ${c(a, "status_category")} = 'dead' THEN 'dead'
    WHEN ${c(a, "completed_date")} IS NOT NULL OR ${c(a, "status_category")} = 'done' THEN 'completed'
    WHEN ${c(a, "status_category")} = 'lapsed' THEN 'expired'
    WHEN ${c(a, "stage")} = 'issued' AND ${c(a, "expires_date")} < ${today}::date - ${EXPIRED_GRACE_DAYS}::int THEN 'expired'
    WHEN ${c(a, "stage")} = 'issued' THEN 'issued'
    WHEN ${c(a, "stage")} = 'applied' THEN 'review'
    ELSE 'proposal' END)`;
}

/** Stalled (SPEC §2): see STALLED_REVIEW_YEARS / STALLED_ISSUED_YEARS in lib/rules.ts. */
export function stalledSql(a: string, today: string): SQL {
  const stage = stageSql(a, today);
  return sql`((${stage} = 'review' AND ${c(a, "applied_date")} <= ${today}::date - ${`${STALLED_REVIEW_YEARS} years`}::interval)
           OR (${stage} = 'issued' AND ${c(a, "issued_date")} <= ${today}::date - ${`${STALLED_ISSUED_YEARS} years`}::interval))`;
}

/** Expiring soon: issued, and the permit expires within EXPIRING_SOON_MONTHS. */
export function expiringSql(a: string, today: string): SQL {
  return sql`(${stageSql(a, today)} = 'issued' AND ${c(a, "expires_date")} >= ${today}::date
           AND ${c(a, "expires_date")} < ${today}::date + ${`${EXPIRING_SOON_MONTHS} months`}::interval)`;
}

/** When the stage started: applied, issued, expired or completed date. */
export function stageSinceSql(a: string, today: string): SQL {
  const stage = stageSql(a, today);
  return sql`(CASE ${stage} WHEN 'review' THEN ${c(a, "applied_date")} WHEN 'issued' THEN ${c(a, "issued_date")}
    WHEN 'expired' THEN ${c(a, "expires_date")} WHEN 'completed' THEN ${c(a, "completed_date")} END)`;
}

/** What has happened to an application since (SPEC P1 "Past years"). */
export const outcomeSql = (stage: SQL) =>
  sql`(CASE ${stage} WHEN 'completed' THEN 'completed' WHEN 'expired' THEN 'expired' WHEN 'dead' THEN 'dead' ELSE 'progress' END)`;

const MILES_TO_METERS = 1609.344;

/** The `hood` value for permits that are in no neighborhood. */
export const UNLOCATED = "none";

/** Conditions placing rows aliased `a` in a neighborhood, a center or a radius. */
export function placeConditions(w: Where, a: string): SQL[] {
  const out: SQL[] = [];
  // "none": located nowhere (no coordinates, or outside the city).
  if (w.hood === UNLOCATED) out.push(sql`${c(a, "neighborhood_id")} IS NULL`);
  else if (w.hood) out.push(sql`${c(a, "neighborhood_id")} = ${w.hood}`);
  if (w.center) out.push(sql`${c(a, "center_id")} = ${w.center}`);
  if (w.lat != null && w.lng != null && w.r != null) {
    const meters = w.r * MILES_TO_METERS;
    // Bounding box first, so the geometry index narrows the candidates.
    const dLat = (meters / 111_320) * 1.01;
    const dLng = dLat / Math.cos((w.lat * Math.PI) / 180);
    out.push(sql`${c(a, "geom")} && ST_MakeEnvelope(${w.lng - dLng}, ${w.lat - dLat}, ${w.lng + dLng}, ${w.lat + dLat}, 4326)
      AND ST_DWithin(${c(a, "geom")}::geography, ST_SetSRID(ST_MakePoint(${w.lng}, ${w.lat}), 4326)::geography, ${meters})`);
  }
  return out;
}

export const hasPlace = (w: Where) => Boolean(w.hood || w.center || (w.lat != null && w.lng != null && w.r != null));

const list = (values: readonly string[]) =>
  sql.join(
    values.map((v) => sql`${v}`),
    sql`, `,
  );
const and = (parts: SQL[]) => sql.join(parts, sql` AND `);

export const EARLIEST = "1900-01-01";

export function measureOf(f: Filters): Measure {
  return f.m ?? "completed";
}

export function unitKind(f: Filters): UnitKind {
  return measureOf(f) === "completed" ? (f.units ?? "net") : "added";
}

/**
 * The rows behind a number: one per contributing permit, with columns
 * project_key, permit_num, d (credited date), units (signed), added, removed,
 * hood, center, ptype (project housing type) and stage (the permit's, or for pipeline
 * measures the project's).
 */
export function source(f: Filters, today: string): SQL {
  const m = measureOf(f);
  if (m === "pipeline" || m === "proposals") return projectSource(f, today);

  const milestone = m === "outcome" ? "applied" : m;
  const kind = unitKind(f);
  const col = c("p", `${milestone}_date`);
  const date = kind === "added" ? col : sql`(CASE WHEN p.permit_type_mapped = 'Demolition' THEN p.issued_date ELSE ${col} END)`;
  const added = kind === "removed" ? sql`0` : addedSql("p");
  const removed = kind === "added" ? sql`0` : removedSql("p");
  const rows =
    kind === "added"
      ? housingSql("p")
      : kind === "removed"
        ? sql`(${buildingRemovalSql("p")} OR ${demolitionSql("p")})`
        : sql`(${housingSql("p")} OR ${buildingRemovalSql("p")} OR ${demolitionSql("p")})`;
  const stage = stageSql("p", today);
  const ptype = sql`coalesce(pr.housing_type, 'other')`;

  const conditions: SQL[] = [
    sql`p.removed_at IS NULL`,
    rows,
    sql`${date} >= ${f.from ?? EARLIEST}::date AND ${date} <= ${f.to ?? today}::date`,
    // Dead permits never count as completed, whatever completion date they carry (stageSql).
    ...(milestone === "completed" ? [sql`(p.permit_type_mapped = 'Demolition' OR p.status_category <> 'dead')`] : []),
    ...placeConditions(f, "p"),
  ];
  if (f.type?.length) conditions.push(sql`${ptype} IN (${list(f.type)})`);
  if (m === "outcome" && f.outcome) conditions.push(sql`${outcomeSql(stage)} = ${f.outcome}`);

  return sql`
    SELECT p.project_key, p.permit_num, ${date} AS d, (${added}) - (${removed}) AS units, ${added} AS added, ${removed} AS removed,
           p.neighborhood_id AS hood, p.center_id AS center, ${ptype} AS ptype, ${stage} AS stage
      FROM permits p LEFT JOIN projects pr ON pr.project_key = p.project_key
     WHERE ${and(conditions)}`;
}

/** Pipeline and proposals: projects by their main permit's stage, as of today. */
function projectSource(f: Filters, today: string): SQL {
  const proposals = measureOf(f) === "proposals";
  const projectStages: Stage[] = proposals ? ["proposal"] : (f.stage ?? ["review", "issued"]);
  const permitStages: Stage[] = proposals
    ? ["proposal"]
    : projectStages.includes("expired")
      ? ["review", "issued", "expired"]
      : ["review", "issued"];
  const ptype = sql`coalesce(pr.housing_type, 'other')`;
  const conditions: SQL[] = [
    sql`${stageSql("p", today)} IN (${list(permitStages)})`,
    sql`${stageSql("m", today)} IN (${list(projectStages)})`,
    // Expired here means past its expiry while the City still lists it as issued.
    ...(projectStages.includes("expired") ? [sql`(${stageSql("m", today)} <> 'expired' OR m.status_category = 'pipeline')`] : []),
    ...placeConditions(f, "m"),
  ];
  if (f.type?.length) conditions.push(sql`${ptype} IN (${list(f.type)})`);
  if (!proposals && f.flag === "stalled") conditions.push(stalledSql("m", today));
  if (!proposals && f.flag === "expiring") conditions.push(expiringSql("m", today));

  return sql`
    SELECT p.project_key, p.permit_num, NULL::date AS d, ${addedSql("p")} AS units, ${addedSql("p")} AS added, 0 AS removed,
           m.neighborhood_id AS hood, m.center_id AS center, ${ptype} AS ptype, ${stageSql("m", today)} AS stage
      FROM projects pr
      JOIN permits m ON m.permit_num = pr.main_permit_num AND m.removed_at IS NULL
      JOIN permits p ON p.project_key = pr.project_key AND p.removed_at IS NULL AND ${housingSql("p")}
     WHERE ${and(conditions)}`;
}
