import {
  bigserial,
  boolean,
  customType,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/** PostGIS MultiPolygon in WGS84. Read/written as raw SQL (ST_GeomFromGeoJSON / ST_AsGeoJSON). */
const multiPolygon = customType<{ data: string }>({
  dataType() {
    return "geometry(MultiPolygon, 4326)";
  },
});

/** PostGIS Point in WGS84, set from latitude/longitude by the sync. */
const point = customType<{ data: string }>({
  dataType() {
    return "geometry(Point, 4326)";
  },
});

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "string" });
const day = (name: string) => date(name, { mode: "string" });

/**
 * Columns shared by `permits` and `permits_staging`: everything taken from the source,
 * normalized, plus derivations that depend only on the row itself.
 */
const permitColumns = () => ({
  permitNum: text("permit_num").primaryKey(),
  sourceRowId: text("source_row_id"),

  permitClass: text("permit_class"),
  permitClassMapped: text("permit_class_mapped"),
  permitTypeMapped: text("permit_type_mapped").notNull(),
  permitTypeDesc: text("permit_type_desc"),
  description: text("description"),

  housingUnits: integer("housing_units"),
  housingUnitsRemoved: integer("housing_units_removed"),
  housingUnitsAdded: integer("housing_units_added"),
  estProjectCost: numeric("est_project_cost", { precision: 15, scale: 2 }),

  appliedDate: day("applied_date"),
  issuedDate: day("issued_date"),
  expiresDate: day("expires_date"),
  completedDate: day("completed_date"),
  initialReviewCompleteDate: day("initial_review_complete_date"),
  planReviewCompleteDate: day("plan_review_complete_date"),
  readyToIssueDate: day("ready_to_issue_date"),

  statusCurrent: text("status_current"),

  relatedMup: text("related_mup"),
  parentPermitNum: text("parent_permit_num"),
  developmentSite: text("development_site"),

  address: text("address"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  zoning: text("zoning"),
  contractorCompanyName: text("contractor_company_name"),
  link: text("link"),

  totalDaysPlanReview: integer("total_days_plan_review"),
  daysInitialPlanReview: integer("days_initial_plan_review"),
  daysPlanReviewCity: integer("days_plan_review_city"),
  daysOutCorrections: integer("days_out_corrections"),
  numberReviewCycles: integer("number_review_cycles"),
  daysIssuePermitCity: integer("days_issue_permit_city"),

  dwellingUnitType: text("dwelling_unit_type"),
  housingCategory: text("housing_category"),
  standardPlan: boolean("standard_plan"),
  dependentBuilding: boolean("dependent_building"),

  // Derived from the row alone (see domain/).
  /** Shoring/excavation-only permit; its units aren't counted (domain/housing-type.ts). */
  sitePrepOnly: boolean("site_prep_only").notNull().default(false),
  statusCategory: text("status_category").notNull(),
  stage: text("stage").notNull(),
  housingType: text("housing_type"),
  housingTypeSource: text("housing_type_source"),
  projectKey: text("project_key").notNull(),
  contentHash: text("content_hash").notNull(),
});

export const permits = pgTable(
  "permits",
  {
    ...permitColumns(),
    geom: point("geom"),
    craId: text("cra_id").references(() => areas.id),
    firstSeenAt: ts("first_seen_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    removedAt: ts("removed_at"),
  },
  (t) => [
    index("permits_type_idx").on(t.permitTypeMapped),
    index("permits_stage_idx").on(t.stage),
    index("permits_housing_type_idx").on(t.housingType),
    index("permits_cra_idx").on(t.craId),
    index("permits_project_idx").on(t.projectKey),
    index("permits_applied_idx").on(t.appliedDate),
    index("permits_issued_idx").on(t.issuedDate),
    index("permits_completed_idx").on(t.completedDate),
    index("permits_geom_idx").using("gist", t.geom),
  ],
);

/** Scratch table (made UNLOGGED in the migration), truncated and refilled on every sync run. */
export const permitsStaging = pgTable("permits_staging", permitColumns());

export const permitEvents = pgTable(
  "permit_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    permitNum: text("permit_num").notNull(),
    syncRunId: integer("sync_run_id").notNull(),
    observedAt: ts("observed_at").notNull().defaultNow(),
    /** observed | status | milestone | removed | restored */
    kind: text("kind").notNull(),
    field: text("field"),
    valueFrom: text("value_from"),
    valueTo: text("value_to"),
  },
  (t) => [
    index("permit_events_permit_idx").on(t.permitNum),
    index("permit_events_observed_idx").on(t.observedAt),
  ],
);

export const syncRuns = pgTable("sync_runs", {
  id: serial("id").primaryKey(),
  startedAt: ts("started_at").notNull().defaultNow(),
  finishedAt: ts("finished_at"),
  /** running | success | failed */
  status: text("status").notNull(),
  sourceCount: integer("source_count"),
  stagedCount: integer("staged_count"),
  inserted: integer("inserted"),
  updated: integer("updated"),
  removed: integer("removed"),
  eventsWritten: integer("events_written"),
  error: text("error"),
  details: jsonb("details"),
});

/** Community Reporting Areas. */
export const areas = pgTable(
  "areas",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    detailNames: text("detail_names"),
    groupId: integer("group_id").notNull(),
    district: text("district"),
    acres: doublePrecision("acres"),
    geom: multiPolygon("geom").notNull(),
  },
  (t) => [index("areas_geom_idx").using("gist", t.geom)],
);

/** One row per development (permits sharing a development site). Rebuilt every sync. */
export const projects = pgTable(
  "projects",
  {
    projectKey: text("project_key").primaryKey(),
    developmentSite: text("development_site"),
    mainPermitNum: text("main_permit_num").notNull(),
    buildingPermitCount: integer("building_permit_count").notNull(),
    demolitionPermitCount: integer("demolition_permit_count").notNull(),
    housingType: text("housing_type"),
    craId: text("cra_id"),
    unitsAdded: integer("units_added").notNull(),
    unitsRemoved: integer("units_removed").notNull(),
    appliedDate: day("applied_date"),
    issuedDate: day("issued_date"),
    completedDate: day("completed_date"),
    lastActivityDate: day("last_activity_date"),
    expiresDate: day("expires_date"),
    statusCategory: text("status_category").notNull(),
    stage: text("stage").notNull(),
  },
  (t) => [
    index("projects_stage_idx").on(t.stage),
    index("projects_housing_type_idx").on(t.housingType),
    index("projects_cra_idx").on(t.craId),
    index("projects_applied_idx").on(t.appliedDate),
  ],
);

export const policyEvents = pgTable("policy_events", {
  id: serial("id").primaryKey(),
  date: day("date").notNull(),
  label: text("label").notNull(),
  detail: text("detail"),
  url: text("url").notNull(),
  /** Annotations without a verification date are never shown. */
  verifiedOn: day("verified_on"),
});

