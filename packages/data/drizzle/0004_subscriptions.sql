CREATE TABLE "digest_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription_id" text NOT NULL,
	"item_keys" text[] NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "subscription_seen" (
	"subscription_id" text NOT NULL,
	"item_key" text NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_seen_subscription_id_item_key_pk" PRIMARY KEY("subscription_id","item_key")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"place_path" text NOT NULL,
	"place_name" text NOT NULL,
	"place" jsonb NOT NULL,
	"confirmation_token_hash" text,
	"confirmation_requested_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "digest_deliveries" ADD CONSTRAINT "digest_deliveries_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_seen" ADD CONSTRAINT "subscription_seen_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "digest_deliveries_subscription_idx" ON "digest_deliveries" USING btree ("subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_email_place_idx" ON "subscriptions" USING btree ("email","place_path");--> statement-breakpoint
CREATE INDEX "subscriptions_token_idx" ON "subscriptions" USING btree ("confirmation_token_hash");