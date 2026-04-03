CREATE TABLE "categories" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL UNIQUE,
  "color" text NOT NULL DEFAULT '#3b82f6',
  "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "events" ADD COLUMN "category_id" integer REFERENCES "categories"("id") ON DELETE SET NULL;
