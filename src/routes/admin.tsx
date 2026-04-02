import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { Hono } from "hono";
import { Layout } from "../components/Layout";
import { Badge, Button, Card, Table, Td, TdPlain, Th } from "../components/ui";
import { db } from "../db";
import { adminClientRoutes } from "./admin-clients";
import { adminEventRoutes } from "./admin-events";
import { adminReminderRoutes } from "./admin-reminders";
import { adminUserRoutes } from "./admin-users";

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

adminRoutes.route("/clients", adminClientRoutes);
adminRoutes.route("/events", adminEventRoutes);
adminRoutes.route("/reminders", adminReminderRoutes);
adminRoutes.route("/users", adminUserRoutes);

adminRoutes.get("/", (c) => {
	return c.html(
		<Layout title="Admin - sql-email">
			<h1 class="text-2xl font-bold text-white mb-6">Admin Dashboard</h1>
			<Card title="Quick Links">
				<ul class="space-y-2">
					<li>
						<a
							href="/admin/clients"
							class="text-blue-400 hover:text-blue-300 transition-colors"
						>
							Clients
						</a>
					</li>
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
			</Card>
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

			<Card title="Migrations">
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

				<Table>
					<thead>
						<tr>
							<Th>Migration</Th>
							<Th>Generated</Th>
							<Th>Status</Th>
							<Th>Applied At</Th>
						</tr>
					</thead>
					<tbody>
						{migrations.map((m) => (
							<tr key={m.tag}>
								<TdPlain>{m.tag}</TdPlain>
								<Td>{m.generatedAt}</Td>
								<TdPlain>
									{m.applied ? (
										<Badge variant="green">Applied</Badge>
									) : (
										<Badge variant="yellow">Pending</Badge>
									)}
								</TdPlain>
								<Td>{m.appliedAt ?? "-"}</Td>
							</tr>
						))}
					</tbody>
				</Table>

				{pendingCount > 0 && (
					<form method="post" action="/admin/maintenance/migrate" class="mt-4">
						<Button>Apply Pending Migrations</Button>
					</form>
				)}
			</Card>
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
