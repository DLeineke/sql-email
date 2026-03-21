import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { Hono } from "hono";
import { Layout } from "../components/Layout";
import { db } from "../db";
import { adminEventRoutes } from "./admin-events";

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

adminRoutes.route("/events", adminEventRoutes);

adminRoutes.get("/", (c) => {
	return c.html(
		<Layout title="Admin - sql-email">
			<h1 class="text-2xl font-bold text-white mb-6">Admin Dashboard</h1>
			<div class="bg-slate-800 rounded-lg p-6">
				<h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
					Quick Links
				</h2>
				<ul class="space-y-2">
					<li>
						<a
							href="/admin/events"
							class="text-blue-400 hover:text-blue-300 transition-colors"
						>
							Events
						</a>
					</li>
					<li>
						<a
							href="/admin/maintenance"
							class="text-blue-400 hover:text-blue-300 transition-colors"
						>
							Maintenance &amp; Migrations
						</a>
					</li>
				</ul>
			</div>
		</Layout>,
	);
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

	return c.html(
		<Layout title="Maintenance - sql-email">
			<h1 class="text-2xl font-bold text-white mb-6">Maintenance</h1>

			<div class="bg-slate-800 rounded-lg p-6">
				<h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
					Migrations
				</h2>

				<div class="flex gap-8 mb-6">
					<div class="text-center">
						<div class="text-3xl font-bold text-white">{total}</div>
						<div class="text-xs text-slate-500 uppercase tracking-wide mt-1">
							Total
						</div>
					</div>
					<div class="text-center">
						<div class="text-3xl font-bold text-green-400">{appliedCount}</div>
						<div class="text-xs text-slate-500 uppercase tracking-wide mt-1">
							Applied
						</div>
					</div>
					<div class="text-center">
						<div class="text-3xl font-bold text-yellow-400">{pendingCount}</div>
						<div class="text-xs text-slate-500 uppercase tracking-wide mt-1">
							Pending
						</div>
					</div>
				</div>

				<table class="w-full border-collapse">
					<thead>
						<tr>
							<th class="text-left text-xs text-slate-500 uppercase tracking-wide px-4 py-2 border-b border-slate-700">
								Migration
							</th>
							<th class="text-left text-xs text-slate-500 uppercase tracking-wide px-4 py-2 border-b border-slate-700">
								Generated
							</th>
							<th class="text-left text-xs text-slate-500 uppercase tracking-wide px-4 py-2 border-b border-slate-700">
								Status
							</th>
							<th class="text-left text-xs text-slate-500 uppercase tracking-wide px-4 py-2 border-b border-slate-700">
								Applied At
							</th>
						</tr>
					</thead>
					<tbody>
						{migrations.map((m) => (
							<tr key={m.tag}>
								<td class="px-4 py-2 border-b border-slate-700 text-sm">
									{m.tag}
								</td>
								<td class="px-4 py-2 border-b border-slate-700 text-sm text-slate-400">
									{m.generatedAt}
								</td>
								<td class="px-4 py-2 border-b border-slate-700 text-sm">
									{m.applied ? (
										<span class="px-2 py-0.5 rounded text-xs font-semibold bg-green-950 text-green-400">
											Applied
										</span>
									) : (
										<span class="px-2 py-0.5 rounded text-xs font-semibold bg-yellow-950 text-yellow-400">
											Pending
										</span>
									)}
								</td>
								<td class="px-4 py-2 border-b border-slate-700 text-sm text-slate-400">
									{m.appliedAt ?? "-"}
								</td>
							</tr>
						))}
					</tbody>
				</table>

				{pendingCount > 0 && (
					<form method="post" action="/admin/maintenance/migrate" class="mt-4">
						<button
							type="submit"
							class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors cursor-pointer"
						>
							Apply Pending Migrations
						</button>
					</form>
				)}
			</div>
		</Layout>,
	);
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
