import { resolve } from "node:path";
import { Cron } from "croner";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { csrf } from "hono/csrf";
import { db } from "./db";
import { logger } from "./lib/logger";
import { requireAuth } from "./middleware/auth";
import { processReminders } from "./reminders";
import { adminRoutes } from "./routes/admin";
import { authRoutes } from "./routes/auth";
import { clientRoutes } from "./routes/clients";
import { eventRoutes } from "./routes/events";
import { reminderRoutes } from "./routes/reminders";
import { signupRoutes } from "./routes/signup";
import { unsubscribeRoutes } from "./routes/unsubscribe";

// Apply pending migrations on startup
await migrate(db, {
	migrationsFolder: resolve(import.meta.dir, "../drizzle"),
});
logger.info("Migrations applied");

const app = new Hono();

// CSRF protection: reject cross-origin form submissions on non-GET/HEAD methods
app.use("*", csrf());

// Serve built CSS
app.get("/styles.css", serveStatic({ path: "./public/styles.css" }));

// Global error handler: JSON for API requests, HTML for browser requests
app.onError((err, c) => {
	logger.error(`${c.req.method} ${c.req.path}:`, err);
	const accept = c.req.header("accept") ?? "";
	const wantsJson =
		accept.includes("application/json") ||
		c.req.path.startsWith("/clients") ||
		c.req.path.startsWith("/events") ||
		c.req.path.startsWith("/reminders");
	if (wantsJson) {
		return c.json({ error: "Internal server error" }, 500);
	}
	return c.html(
		`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Error</title></head><body><h1>Something went wrong</h1><p>An unexpected error occurred. Please try again later.</p></body></html>`,
		500,
	);
});

// Not-found handler: JSON for API requests, HTML for browser requests
app.notFound((c) => {
	const accept = c.req.header("accept") ?? "";
	const wantsJson =
		accept.includes("application/json") ||
		c.req.path.startsWith("/clients") ||
		c.req.path.startsWith("/events") ||
		c.req.path.startsWith("/reminders");
	if (wantsJson) {
		return c.json({ error: "Not found" }, 404);
	}
	return c.html(
		`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Not Found</title></head><body style="background:#0f172a;color:#e2e8f0;padding:2rem;font-family:system-ui;"><h1>Page not found</h1><p><a href="/admin" style="color:#3b82f6;">Go to Admin</a></p></body></html>`,
		404,
	);
});

app.get("/", (c) => c.text("sql-email reminder service"));

// Health check (public)
const startedAt = new Date();
app.get("/health", async (c) => {
	let dbOk = false;
	try {
		await db.execute(sql`SELECT 1`);
		dbOk = true;
	} catch {
		// db unreachable
	}
	const uptimeSeconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);
	const status = dbOk ? "ok" : "degraded";
	return c.json(
		{ status, db: dbOk ? "ok" : "error", uptimeSeconds },
		dbOk ? 200 : 503,
	);
});

// Auth routes (public)
app.route("/auth", authRoutes);

// Public signup
app.route("/signup", signupRoutes);

// Public unsubscribe (token-based, no login required)
app.route("/unsubscribe", unsubscribeRoutes);

// Protected: admin UI
app.use("/admin/*", requireAuth);
app.route("/admin", adminRoutes);

// Protected: API routes
app.use("/clients/*", requireAuth);
app.use("/events/*", requireAuth);
app.use("/reminders/*", requireAuth);
app.route("/clients", clientRoutes);
app.route("/events", eventRoutes);
app.route("/reminders", reminderRoutes);

const port = Number(process.env.PORT) || 3001;

const server = Bun.serve({
	port,
	fetch: app.fetch,
});

logger.info(`Listening on http://localhost:${server.port}`);

// Schedule daily reminder processing
const reminderCronExpr = process.env.REMINDER_CRON ?? "0 8 * * *";
const reminderCron = new Cron(reminderCronExpr, async () => {
	logger.info("[cron] Processing reminders...");
	try {
		const result = await processReminders();
		logger.info(
			`[cron] Done: ${result.individual} individual, ${result.summaries} summaries`,
		);
	} catch (err) {
		logger.error("[cron] Failed:", err);
	}
});
logger.info(
	`[cron] Reminder job scheduled (next: ${reminderCron.nextRun()?.toISOString()}`,
);
