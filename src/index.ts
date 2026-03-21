import { resolve } from "node:path";
import { Cron } from "croner";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { Hono } from "hono";
import { db } from "./db";
import { processReminders } from "./reminders";
import { adminRoutes } from "./routes/admin";
import { clientRoutes } from "./routes/clients";
import { eventRoutes } from "./routes/events";
import { signupRoutes } from "./routes/signup";

// Apply pending migrations on startup
await migrate(db, {
	migrationsFolder: resolve(import.meta.dir, "../drizzle"),
});
console.log("Migrations applied");

const app = new Hono();

app.get("/", (c) => c.text("sql-email reminder service"));
app.post("/reminders/process", async (c) => c.json(await processReminders()));
app.route("/admin", adminRoutes);
app.route("/clients", clientRoutes);
app.route("/events", eventRoutes);
app.route("/signup", signupRoutes);

const port = Number(process.env.PORT) || 3001;

const server = Bun.serve({
	port,
	fetch: app.fetch,
});

console.log(`Listening on http://localhost:${server.port}`);

// Schedule daily reminder processing
const reminderCronExpr = process.env.REMINDER_CRON ?? "0 8 * * *";
const reminderCron = new Cron(reminderCronExpr, async () => {
	console.log("[cron] Processing reminders...");
	try {
		const result = await processReminders();
		console.log(
			`[cron] Done: ${result.individual} individual, ${result.summaries} summaries`,
		);
	} catch (err) {
		console.error("[cron] Failed:", err);
	}
});
console.log(
	`[cron] Reminder job scheduled (next: ${reminderCron.nextRun()?.toISOString()}`,
);
