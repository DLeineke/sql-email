ALTER TABLE "events" ADD COLUMN "recurrence_pattern" text;
ALTER TABLE "events" ADD COLUMN "recurrence_interval" integer DEFAULT 1;
ALTER TABLE "events" ADD COLUMN "recurrence_end_date" date;
ALTER TABLE "events" ADD COLUMN "parent_event_id" integer REFERENCES "events"("id") ON DELETE CASCADE;
