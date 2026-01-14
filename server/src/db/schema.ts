import {
  pgTable,
  varchar,
  text,
  integer,
  decimal,
  date,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

export const buildingPermits = pgTable(
  "building_permits",
  {
    // Identifiers
    permitNum: varchar("permit_num", { length: 100 }).primaryKey().notNull(),
    relatedMup: varchar("related_mup", { length: 100 }),
    parentPermitNum: varchar("parent_permit_num", { length: 100 }),

    // Classification
    permitClass: varchar("permit_class", { length: 255 }),
    permitClassMapped: varchar("permit_class_mapped", { length: 255 }),
    permitTypeMapped: varchar("permit_type_mapped", { length: 255 }),
    permitTypeDesc: varchar("permit_type_desc", { length: 255 }),

    // Details
    description: text("description"),
    housingUnits: integer("housing_units"),
    housingUnitsRemoved: integer("housing_units_removed"),
    housingUnitsAdded: integer("housing_units_added"),
    estProjectCost: decimal("est_project_cost", { precision: 15, scale: 2 }),

    // Dates
    appliedDate: date("applied_date", { mode: "string" }),
    issuedDate: date("issued_date", { mode: "string" }),
    expiresDate: date("expires_date", { mode: "string" }),
    completedDate: date("completed_date", { mode: "string" }),
    initialReviewCompleteDate: date("initial_review_complete_date", {
      mode: "string",
    }),
    planReviewCompleteDate: date("plan_review_complete_date", {
      mode: "string",
    }),
    readyToIssueDate: date("ready_to_issue_date", { mode: "string" }),

    // Status
    statusCurrent: varchar("status_current", { length: 255 }),

    // Location
    originalAddress1: varchar("original_address1", { length: 500 }),
    originalCity: varchar("original_city", { length: 255 }),
    originalState: varchar("original_state", { length: 10 }),
    originalZip: varchar("original_zip", { length: 20 }),
    latitude: decimal("latitude", { precision: 10, scale: 8 }),
    longitude: decimal("longitude", { precision: 11, scale: 8 }),
    location1: varchar("location1", { length: 255 }),
    neighborhood: varchar("neighborhood", { length: 255 }),
    zoning: text("zoning"),

    // Contractor
    contractorCompanyName: varchar("contractor_company_name", { length: 500 }),

    // Metadata
    link: text("link"),
    remoteCreatedAt: timestamp("remote_created_at", { mode: "string" }),
    remoteUpdatedAt: timestamp("remote_updated_at", { mode: "string" }),
    localUpdatedAt: timestamp("local_updated_at", {
      mode: "string",
    }).defaultNow(),

    // Review Metrics
    totalDaysPlanReview: integer("total_days_plan_review"),
    daysInitialPlanReview: integer("days_initial_plan_review"),
    daysPlanReviewCity: integer("days_plan_review_city"),
    daysOutCorrections: integer("days_out_corrections"),
    numberReviewCycles: integer("number_review_cycles"),
    daysIssuePermitCity: integer("days_issue_permit_city"),

    // Housing Info
    dwellingUnitType: varchar("dwelling_unit_type", { length: 255 }),
    housingCategory: varchar("housing_category", { length: 255 }),
    standardPlan: boolean("standard_plan"),
    dependentBuilding: boolean("dependent_building"),
  },
  (table) => ({
    // Indexes for performance optimization
    issuedDateIdx: index("issued_date_idx").on(table.issuedDate),
    appliedDateIdx: index("applied_date_idx").on(table.appliedDate),
    statusCurrentIdx: index("status_current_idx").on(table.statusCurrent),
    permitClassMappedIdx: index("permit_class_mapped_idx").on(
      table.permitClassMapped
    ),
    locationIdx: index("location_idx").on(
      table.originalCity,
      table.originalZip
    ),
    neighborhoodIdx: index("neighborhood_idx").on(table.neighborhood),
    relatedMupIdx: index("related_mup_idx").on(table.relatedMup),
    parentPermitNumIdx: index("parent_permit_num_idx").on(
      table.parentPermitNum
    ),
    remoteUpdatedAtIdx: index("remote_updated_at_idx").on(
      table.remoteUpdatedAt
    ),
  })
);

export const syncMetadata = pgTable("sync_metadata", {
  id: varchar("id", { length: 100 }).primaryKey().notNull(),
  lastSyncStartedAt: timestamp("last_sync_started_at", { mode: "string" }),
  lastSyncCompletedAt: timestamp("last_sync_completed_at", { mode: "string" }),
  lastSyncStatus: varchar("last_sync_status", { length: 50 }),
  lastSyncError: text("last_sync_error"),
  totalRecordsProcessed: integer("total_records_processed").default(0),
  recordsInserted: integer("records_inserted").default(0),
  recordsUpdated: integer("records_updated").default(0),
  recordsFailed: integer("records_failed").default(0),
});

// Export TypeScript types for type-safe queries
export type BuildingPermit = InferSelectModel<typeof buildingPermits>;
export type NewBuildingPermit = InferInsertModel<typeof buildingPermits>;
export type SyncMetadata = InferSelectModel<typeof syncMetadata>;
export type NewSyncMetadata = InferInsertModel<typeof syncMetadata>;
