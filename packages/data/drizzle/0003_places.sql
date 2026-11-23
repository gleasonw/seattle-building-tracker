CREATE TABLE "places" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"district" text,
	"aliases" text[] DEFAULT '{}' NOT NULL,
	"geom" geometry(MultiPolygon, 4326) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reference_data" (
	"name" text PRIMARY KEY NOT NULL,
	"version" text NOT NULL,
	"loaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "permits" ADD COLUMN "neighborhood_id" text;--> statement-breakpoint
ALTER TABLE "permits" ADD COLUMN "center_id" text;--> statement-breakpoint
CREATE INDEX "places_geom_idx" ON "places" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "permits_neighborhood_idx" ON "permits" USING btree ("neighborhood_id");--> statement-breakpoint
CREATE INDEX "permits_center_idx" ON "permits" USING btree ("center_id");