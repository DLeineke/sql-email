import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./src/db/schema.ts",
	out: "./drizzle",
	dialect: "postgresql",
	migrations: {
		prefix: "timestamp",
	},
	dbCredentials: {
		url: process.env.DATABASE_URL!,
	},
});
