ALTER TABLE "clients" ADD COLUMN "unsubscribe_token" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "unsubscribed_at" timestamp;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_unsubscribe_token_unique" UNIQUE("unsubscribe_token");--> statement-breakpoint
UPDATE "clients" SET "unsubscribe_token" = gen_random_uuid()::text WHERE "unsubscribe_token" IS NULL;
