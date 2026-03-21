import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { Hono } from "hono";
import { html } from "hono/html";
import { db } from "../db";

interface JournalEntry {
	idx: number;
	version: string;
	when: number;
	tag: string;
	breakpoints: boolean;
}

interface Journal {
	version: string;
	dialect: string;
	entries: JournalEntry[];
}

const MIGRATIONS_DIR = resolve(import.meta.dir, "../../drizzle");

function readJournal(): Journal {
	const journalPath = resolve(MIGRATIONS_DIR, "meta/_journal.json");
	return JSON.parse(readFileSync(journalPath, "utf-8"));
}

async function getAppliedMigrations(): Promise<Map<number, Date>> {
	const rows = await db.execute<{ created_at: string }>(
		"SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at",
	);
	const map = new Map<number, Date>();
	for (const row of rows) {
		const ts = Number(row.created_at);
		map.set(ts, new Date(ts));
	}
	return map;
}

export const adminRoutes = new Hono();

adminRoutes.get("/", (c) => {
	return c.html(html`
		<!doctype html>
		<html>
			<head>
				<title>Admin - sql-email</title>
				<style>
					* { margin: 0; padding: 0; box-sizing: border-box; }
					body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; padding: 2rem; }
					h1 { font-size: 1.5rem; margin-bottom: 1.5rem; color: #f8fafc; }
					h2 { font-size: 1.1rem; margin-bottom: 1rem; color: #94a3b8; }
					.card { background: #1e293b; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; }
					.summary { display: flex; gap: 1.5rem; margin-bottom: 1rem; }
					.stat { text-align: center; }
					.stat-value { font-size: 2rem; font-weight: 700; }
					.stat-label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; }
					.green { color: #4ade80; }
					.yellow { color: #facc15; }
					table { width: 100%; border-collapse: collapse; }
					th, td { text-align: left; padding: 0.5rem 1rem; border-bottom: 1px solid #334155; }
					th { color: #64748b; font-size: 0.75rem; text-transform: uppercase; }
					.badge { padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; }
					.badge-applied { background: #064e3b; color: #4ade80; }
					.badge-pending { background: #713f12; color: #facc15; }
					button { background: #3b82f6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.875rem; }
					button:hover { background: #2563eb; }
					nav { margin-bottom: 2rem; display: flex; gap: 1rem; }
					nav a { color: #94a3b8; text-decoration: none; }
					nav a:hover { color: #f8fafc; }
				</style>
			</head>
			<body>
				<nav>
					<a href="/admin">Admin</a>
					<a href="/admin/maintenance">Maintenance</a>
				</nav>
				<h1>Admin Dashboard</h1>
				<div class="card">
					<h2>Quick Links</h2>
					<p><a href="/admin/maintenance" style="color:#3b82f6;">Maintenance &amp; Migrations</a></p>
				</div>
			</body>
		</html>
	`);
});

adminRoutes.get("/maintenance", async (c) => {
	const journal = readJournal();
	const applied = await getAppliedMigrations();

	const migrations = journal.entries.map((entry) => ({
		tag: entry.tag,
		generatedAt: new Date(entry.when).toISOString(),
		applied: applied.has(entry.when),
		appliedAt: applied.get(entry.when)?.toISOString() ?? null,
	}));

	const total = migrations.length;
	const appliedCount = migrations.filter((m) => m.applied).length;
	const pendingCount = migrations.filter((m) => !m.applied).length;

	return c.html(html`
		<!doctype html>
		<html>
			<head>
				<title>Maintenance - sql-email</title>
				<style>
					* { margin: 0; padding: 0; box-sizing: border-box; }
					body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; padding: 2rem; }
					h1 { font-size: 1.5rem; margin-bottom: 1.5rem; color: #f8fafc; }
					h2 { font-size: 1.1rem; margin-bottom: 1rem; color: #94a3b8; }
					.card { background: #1e293b; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; }
					.summary { display: flex; gap: 1.5rem; margin-bottom: 1rem; }
					.stat { text-align: center; }
					.stat-value { font-size: 2rem; font-weight: 700; }
					.stat-label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; }
					.green { color: #4ade80; }
					.yellow { color: #facc15; }
					table { width: 100%; border-collapse: collapse; }
					th, td { text-align: left; padding: 0.5rem 1rem; border-bottom: 1px solid #334155; }
					th { color: #64748b; font-size: 0.75rem; text-transform: uppercase; }
					.badge { padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; }
					.badge-applied { background: #064e3b; color: #4ade80; }
					.badge-pending { background: #713f12; color: #facc15; }
					button { background: #3b82f6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.875rem; }
					button:hover { background: #2563eb; }
					nav { margin-bottom: 2rem; display: flex; gap: 1rem; }
					nav a { color: #94a3b8; text-decoration: none; }
					nav a:hover { color: #f8fafc; }
				</style>
			</head>
			<body>
				<nav>
					<a href="/admin">Admin</a>
					<a href="/admin/maintenance">Maintenance</a>
				</nav>
				<h1>Maintenance</h1>

				<div class="card">
					<h2>Migrations</h2>
					<div class="summary">
						<div class="stat">
							<div class="stat-value">${total}</div>
							<div class="stat-label">Total</div>
						</div>
						<div class="stat">
							<div class="stat-value green">${appliedCount}</div>
							<div class="stat-label">Applied</div>
						</div>
						<div class="stat">
							<div class="stat-value yellow">${pendingCount}</div>
							<div class="stat-label">Pending</div>
						</div>
					</div>

					<table>
						<thead>
							<tr>
								<th>Migration</th>
								<th>Generated</th>
								<th>Status</th>
								<th>Applied At</th>
							</tr>
						</thead>
						<tbody>
							${migrations.map(
								(m) => html`
									<tr>
										<td>${m.tag}</td>
										<td>${m.generatedAt}</td>
										<td>
											<span class="badge ${m.applied ? "badge-applied" : "badge-pending"}">
												${m.applied ? "Applied" : "Pending"}
											</span>
										</td>
										<td>${m.appliedAt ?? "-"}</td>
									</tr>
								`,
							)}
						</tbody>
					</table>

					${
						pendingCount > 0
							? html`
						<form method="POST" action="/admin/maintenance/migrate" style="margin-top:1rem;">
							<button type="submit">Apply Pending Migrations</button>
						</form>
					`
							: ""
					}
				</div>
			</body>
		</html>
	`);
});

adminRoutes.post("/maintenance/migrate", async (c) => {
	await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
	return c.redirect("/admin/maintenance");
});

// JSON API (kept for programmatic access)
adminRoutes.get("/maintenance/api", async (c) => {
	const journal = readJournal();
	const applied = await getAppliedMigrations();

	const migrations = journal.entries.map((entry) => ({
		tag: entry.tag,
		generatedAt: new Date(entry.when).toISOString(),
		applied: applied.has(entry.when),
		appliedAt: applied.get(entry.when)?.toISOString() ?? null,
	}));

	return c.json({
		summary: {
			total: migrations.length,
			applied: migrations.filter((m) => m.applied).length,
			pending: migrations.filter((m) => !m.applied).length,
		},
		migrations,
	});
});
