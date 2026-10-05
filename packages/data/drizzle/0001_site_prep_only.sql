ALTER TABLE "permits" ADD COLUMN "site_prep_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "permits_staging" ADD COLUMN "site_prep_only" boolean DEFAULT false NOT NULL;