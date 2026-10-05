CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
CREATE TABLE "areas" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"detail_names" text,
	"group_id" integer NOT NULL,
	"district" text,
	"acres" double precision,
	"geom" geometry(MultiPolygon, 4326) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permit_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"permit_num" text NOT NULL,
	"sync_run_id" integer NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"field" text,
	"value_from" text,
	"value_to" text
);
--> statement-breakpoint
CREATE TABLE "permits" (
	"permit_num" text PRIMARY KEY NOT NULL,
	"source_row_id" text,
	"permit_class" text,
	"permit_class_mapped" text,
	"permit_type_mapped" text NOT NULL,
	"permit_type_desc" text,
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
	"status_current" text,
	"related_mup" text,
	"parent_permit_num" text,
	"development_site" text,
	"address" text,
	"city" text,
	"state" text,
	"zip" text,
	"latitude" double precision,
	"longitude" double precision,
	"zoning" text,
	"contractor_company_name" text,
	"link" text,
	"total_days_plan_review" integer,
	"days_initial_plan_review" integer,
	"days_plan_review_city" integer,
	"days_out_corrections" integer,
	"number_review_cycles" integer,
	"days_issue_permit_city" integer,
	"dwelling_unit_type" text,
	"housing_category" text,
	"standard_plan" boolean,
	"dependent_building" boolean,
	"status_category" text NOT NULL,
	"stage" text NOT NULL,
	"housing_type" text,
	"housing_type_source" text,
	"project_key" text NOT NULL,
	"content_hash" text NOT NULL,
	"geom" geometry(Point, 4326),
	"cra_id" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "permits_staging" (
	"permit_num" text PRIMARY KEY NOT NULL,
	"source_row_id" text,
	"permit_class" text,
	"permit_class_mapped" text,
	"permit_type_mapped" text NOT NULL,
	"permit_type_desc" text,
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
	"status_current" text,
	"related_mup" text,
	"parent_permit_num" text,
	"development_site" text,
	"address" text,
	"city" text,
	"state" text,
	"zip" text,
	"latitude" double precision,
	"longitude" double precision,
	"zoning" text,
	"contractor_company_name" text,
	"link" text,
	"total_days_plan_review" integer,
	"days_initial_plan_review" integer,
	"days_plan_review_city" integer,
	"days_out_corrections" integer,
	"number_review_cycles" integer,
	"days_issue_permit_city" integer,
	"dwelling_unit_type" text,
	"housing_category" text,
	"standard_plan" boolean,
	"dependent_building" boolean,
	"status_category" text NOT NULL,
	"stage" text NOT NULL,
	"housing_type" text,
	"housing_type_source" text,
	"project_key" text NOT NULL,
	"content_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"label" text NOT NULL,
	"detail" text,
	"url" text NOT NULL,
	"verified_on" date
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"project_key" text PRIMARY KEY NOT NULL,
	"development_site" text,
	"main_permit_num" text NOT NULL,
	"building_permit_count" integer NOT NULL,
	"demolition_permit_count" integer NOT NULL,
	"housing_type" text,
	"cra_id" text,
	"units_added" integer NOT NULL,
	"units_removed" integer NOT NULL,
	"applied_date" date,
	"issued_date" date,
	"completed_date" date,
	"last_activity_date" date,
	"expires_date" date,
	"status_category" text NOT NULL,
	"stage" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text NOT NULL,
	"source_count" integer,
	"staged_count" integer,
	"inserted" integer,
	"updated" integer,
	"removed" integer,
	"events_written" integer,
	"error" text,
	"details" jsonb
);
--> statement-breakpoint
ALTER TABLE "permits" ADD CONSTRAINT "permits_cra_id_areas_id_fk" FOREIGN KEY ("cra_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "areas_geom_idx" ON "areas" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "permit_events_permit_idx" ON "permit_events" USING btree ("permit_num");--> statement-breakpoint
CREATE INDEX "permit_events_observed_idx" ON "permit_events" USING btree ("observed_at");--> statement-breakpoint
CREATE INDEX "permits_type_idx" ON "permits" USING btree ("permit_type_mapped");--> statement-breakpoint
CREATE INDEX "permits_stage_idx" ON "permits" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "permits_housing_type_idx" ON "permits" USING btree ("housing_type");--> statement-breakpoint
CREATE INDEX "permits_cra_idx" ON "permits" USING btree ("cra_id");--> statement-breakpoint
CREATE INDEX "permits_project_idx" ON "permits" USING btree ("project_key");--> statement-breakpoint
CREATE INDEX "permits_applied_idx" ON "permits" USING btree ("applied_date");--> statement-breakpoint
CREATE INDEX "permits_issued_idx" ON "permits" USING btree ("issued_date");--> statement-breakpoint
CREATE INDEX "permits_completed_idx" ON "permits" USING btree ("completed_date");--> statement-breakpoint
CREATE INDEX "permits_geom_idx" ON "permits" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "projects_stage_idx" ON "projects" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "projects_housing_type_idx" ON "projects" USING btree ("housing_type");--> statement-breakpoint
CREATE INDEX "projects_cra_idx" ON "projects" USING btree ("cra_id");--> statement-breakpoint
CREATE INDEX "projects_applied_idx" ON "projects" USING btree ("applied_date");
--> statement-breakpoint
ALTER TABLE "permits_staging" SET UNLOGGED;