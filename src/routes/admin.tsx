import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { and, eq, gte, lte } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { Hono } from "hono";
import { Layout } from "../components/Layout";
import { Badge, Button, Card, Table, Td, TdPlain, Th } from "../components/ui";
import { db } from "../db";
import { categories, events } from "../db/schema";
import { todayInTimezone } from "../lib/date";
import { requireAdmin } from "../middleware/auth";
import { adminCategoryRoutes } from "./admin-categories";
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
adminRoutes.use("/users/*", requireAdmin);
adminRoutes.route("/users", adminUserRoutes);
adminRoutes.route("/categories", adminCategoryRoutes);

adminRoutes.get("/", async (c) => {
	const currentUser = c.get("user") as { role: string };
	const isAdmin = currentUser.role === "admin";

	// Determine which month to display
	const today = todayInTimezone();
	const monthParam = c.req.query("month"); // expected: YYYY-MM
	const monthMatch = monthParam?.match(/^(\d{4})-(\d{2})$/);
	const year = monthMatch ? Number(monthMatch[1]) : new Date().getUTCFullYear();
	const month = monthMatch
		? Number(monthMatch[2]) - 1
		: new Date().getUTCMonth(); // 0-based

	// First and last day of this month (YYYY-MM-DD)
	const firstOfMonth = new Date(Date.UTC(year, month, 1));
	const lastOfMonth = new Date(Date.UTC(year, month + 1, 0));
	const firstDateStr = firstOfMonth.toISOString().slice(0, 10);
	const lastDateStr = lastOfMonth.toISOString().slice(0, 10);

	// Fetch all events (including instances) for this month with category info
	const monthEvents = await db
		.select({
			id: events.id,
			title: events.title,
			eventDate: events.eventDate,
			categoryColor: categories.color,
			categoryName: categories.name,
		})
		.from(events)
		.leftJoin(categories, eq(events.categoryId, categories.id))
		.where(
			and(
				gte(events.eventDate, firstDateStr),
				lte(events.eventDate, lastDateStr),
			),
		)
		.orderBy(events.eventDate);

	// Group events by date string
	const eventsByDate = new Map<string, typeof monthEvents>();
	for (const ev of monthEvents) {
		const list = eventsByDate.get(ev.eventDate) ?? [];
		list.push(ev);
		eventsByDate.set(ev.eventDate, list);
	}

	// Collect unique categories for legend
	const legendCategories = new Map<string, string>(); // color -> name
	for (const ev of monthEvents) {
		if (ev.categoryColor && ev.categoryName) {
			legendCategories.set(ev.categoryColor, ev.categoryName);
		}
	}

	// Build calendar grid — start from the Sunday on or before the 1st
	const startDow = firstOfMonth.getUTCDay(); // 0=Sun
	const gridStart = new Date(Date.UTC(year, month, 1 - startDow));
	// Enough rows to cover the month (5 or 6 weeks)
	const totalDays = startDow + lastOfMonth.getUTCDate();
	const numWeeks = Math.ceil(totalDays / 7);
	const cells: string[] = [];
	for (let i = 0; i < numWeeks * 7; i++) {
		const d = new Date(gridStart);
		d.setUTCDate(gridStart.getUTCDate() + i);
		cells.push(d.toISOString().slice(0, 10));
	}

	// Prev / next month nav
	const prevMonthDate = new Date(Date.UTC(year, month - 1, 1));
	const nextMonthDate = new Date(Date.UTC(year, month + 1, 1));
	const prevParam = `${prevMonthDate.getUTCFullYear()}-${String(prevMonthDate.getUTCMonth() + 1).padStart(2, "0")}`;
	const nextParam = `${nextMonthDate.getUTCFullYear()}-${String(nextMonthDate.getUTCMonth() + 1).padStart(2, "0")}`;

	const monthLabel = firstOfMonth.toLocaleDateString("en-US", {
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	});

	const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	const MAX_PILLS = 3;

	return c.html(
		<Layout title="Admin - sql-email" userRole={currentUser.role}>
			{/* Month navigation */}
			<div class="flex items-center gap-3 mb-4">
				<h1 class="text-2xl font-bold text-white mr-2">{monthLabel}</h1>
				<a
					href={`/admin?month=${prevParam}`}
					class="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-md transition-colors"
				>
					&#8592; Prev
				</a>
				<a
					href={`/admin?month=${nextParam}`}
					class="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-md transition-colors"
				>
					Next &#8594;
				</a>
				<a
					href="/admin"
					class="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-400 text-sm rounded-md transition-colors"
				>
					Today
				</a>
			</div>

			{/* Calendar grid */}
			<div class="rounded-lg overflow-hidden">
				{/* Day-of-week headers */}
				<div class="grid grid-cols-7 gap-px bg-slate-700">
					{DOW_LABELS.map((d) => (
						<div
							key={d}
							class="bg-slate-800 text-slate-400 text-xs text-center py-2 uppercase tracking-wide font-semibold"
						>
							{d}
						</div>
					))}
				</div>

				{/* Date cells */}
				<div class="grid grid-cols-7 gap-px bg-slate-700">
					{cells.map((dateStr) => {
						const isCurrentMonth =
							dateStr >= firstDateStr && dateStr <= lastDateStr;
						const isToday = dateStr === today;
						const dayNum = Number(dateStr.slice(8));
						const dayEvents = eventsByDate.get(dateStr) ?? [];
						const shown = dayEvents.slice(0, MAX_PILLS);
						const overflow = dayEvents.length - shown.length;

						return (
							<div
								key={dateStr}
								class={`bg-slate-800 min-h-[100px] p-2${isToday ? " ring-2 ring-blue-500 ring-inset" : ""}`}
							>
								<div class="mb-1 flex justify-start">
									{isAdmin && isCurrentMonth ? (
										<a
											href={`/admin/events/new?date=${dateStr}`}
											class={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-600 transition-colors ${isCurrentMonth ? "text-slate-200" : "text-slate-600"}`}
										>
											{dayNum}
										</a>
									) : (
										<span
											class={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${isCurrentMonth ? "text-slate-400" : "text-slate-600"}`}
										>
											{dayNum}
										</span>
									)}
								</div>
								<div>
									{shown.map((ev) => (
										<a
											key={ev.id}
											href={`/admin/events/${ev.id}`}
											title={ev.title}
											class="text-xs rounded px-1.5 py-0.5 mb-1 truncate block text-white hover:opacity-80 transition-opacity"
											style={
												ev.categoryColor
													? `background:${ev.categoryColor}`
													: "background:#475569"
											}
										>
											{ev.title.length > 15
												? `${ev.title.slice(0, 15)}…`
												: ev.title}
										</a>
									))}
									{overflow > 0 && (
										<a
											href={`/admin/events?date=${dateStr}`}
											class="text-xs text-slate-400 hover:text-slate-200 transition-colors"
										>
											+{overflow} more
										</a>
									)}
								</div>
							</div>
						);
					})}
				</div>
			</div>

			{/* Category legend */}
			{legendCategories.size > 0 && (
				<div class="mt-4 flex flex-wrap gap-3">
					{[...legendCategories.entries()].map(([color, name]) => (
						<span
							key={color}
							class="flex items-center gap-1.5 text-xs text-slate-400"
						>
							<span
								class="inline-block w-3 h-3 rounded-sm flex-shrink-0"
								style={`background:${color}`}
							/>
							{name}
						</span>
					))}
				</div>
			)}
		</Layout>,
	);
});

adminRoutes.get("/maintenance", async (c) => {
	const currentUser = c.get("user") as { role: string };
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
		<Layout title="Maintenance - sql-email" userRole={currentUser.role}>
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
