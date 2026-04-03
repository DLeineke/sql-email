ALTER TABLE "users" ADD COLUMN "role" text NOT NULL DEFAULT 'viewer';--> statement-breakpoint
UPDATE "users" SET "role" = 'admin';
