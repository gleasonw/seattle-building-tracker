CREATE TABLE "building_permits" (
	"permit_num" varchar(100) PRIMARY KEY NOT NULL,
	"related_mup" varchar(100),
	"parent_permit_num" varchar(100),
	"permit_class" varchar(255),
	"permit_class_mapped" varchar(255),
	"permit_type_mapped" varchar(255),
	"permit_type_desc" varchar(255),
	"description" text,
	"housing_units" integer,
	"housing_units_removed" integer,
	"housing_units_added" integer,
	"est_project_cost" numeric(15, 2),
	"applied_date" date,
	"issued_date" date,
	"expires_date" date,
	"completed_date" date,
	"initial_review_complete_date" date,
	"plan_review_complete_date" date,
	"ready_to_issue_date" date,
	"status_current" varchar(255),
	"original_address1" varchar(500),
	"original_city" varchar(255),
	"original_state" varchar(10),
	"original_zip" varchar(20),
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"location1" varchar(255),
	"neighborhood" varchar(255),
	"zoning" text,
	"contractor_company_name" varchar(500),
	"link" text,
	"remote_created_at" timestamp,
	"remote_updated_at" timestamp,
	"local_updated_at" timestamp DEFAULT now(),
	"total_days_plan_review" integer,
	"days_initial_plan_review" integer,
	"days_plan_review_city" integer,
	"days_out_corrections" integer,
	"number_review_cycles" integer,
	"days_issue_permit_city" integer,
	"dwelling_unit_type" varchar(255),
	"housing_category" varchar(255),
	"standard_plan" boolean,
	"dependent_building" boolean
);
--> statement-breakpoint
CREATE TABLE "sync_metadata" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"last_sync_started_at" timestamp,
	"last_sync_completed_at" timestamp,
	"last_sync_status" varchar(50),
	"last_sync_error" text,
	"total_records_processed" integer DEFAULT 0,
	"records_inserted" integer DEFAULT 0,
	"records_updated" integer DEFAULT 0,
	"records_failed" integer DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX "issued_date_idx" ON "building_permits" USING btree ("issued_date");--> statement-breakpoint
CREATE INDEX "applied_date_idx" ON "building_permits" USING btree ("applied_date");--> statement-breakpoint
CREATE INDEX "status_current_idx" ON "building_permits" USING btree ("status_current");--> statement-breakpoint
CREATE INDEX "permit_class_mapped_idx" ON "building_permits" USING btree ("permit_class_mapped");--> statement-breakpoint
CREATE INDEX "location_idx" ON "building_permits" USING btree ("original_city","original_zip");--> statement-breakpoint
CREATE INDEX "neighborhood_idx" ON "building_permits" USING btree ("neighborhood");--> statement-breakpoint
CREATE INDEX "related_mup_idx" ON "building_permits" USING btree ("related_mup");--> statement-breakpoint
CREATE INDEX "parent_permit_num_idx" ON "building_permits" USING btree ("parent_permit_num");--> statement-breakpoint
CREATE INDEX "remote_updated_at_idx" ON "building_permits" USING btree ("remote_updated_at");