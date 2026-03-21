import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";

import { Layout } from "../components/Layout";
import { db } from "../db";
import { clients, eventClients, eventReminders, events } from "../db/schema";

export const adminEventRoutes = new Hono();

// GET /admin/events — list all events
adminEventRoutes.get("/", async (c) => {
	const rows = await db
		.select({
			id: events.id,
			title: events.title,
			eventDate: events.eventDate,
			reminderCount: sql<number>`COUNT(DISTINCT ${eventReminders.id})`,
			clientCount: sql<number>`COUNT(DISTINCT ${eventClients.id})`,
		})
		.from(events)
		.leftJoin(eventReminders, eq(eventReminders.eventId, events.id))
		.leftJoin(eventClients, eq(eventClients.eventId, events.id))
		.groupBy(events.id, events.title, events.eventDate)
		.orderBy(events.eventDate);

	return c.html(
		<Layout title="Events - sql-email">
			<div class="flex items-center justify-between mb-6">
				<h1 class="text-2xl font-bold text-white">Events</h1>
				<a
					href="/admin/events/new"
					class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
				>
					New Event
				</a>
			</div>

			<div class="bg-slate-800 rounded-lg p-6">
				<h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
					All Events
				</h2>
				{rows.length === 0 ? (
					<p class="text-slate-500 text-sm">No events yet.</p>
				) : (
					<table class="w-full border-collapse">
						<thead>
							<tr>
								<th class="text-left text-xs text-slate-500 uppercase tracking-wide px-4 py-2 border-b border-slate-700">
									Title
								</th>
								<th class="text-left text-xs text-slate-500 uppercase tracking-wide px-4 py-2 border-b border-slate-700">
									Event Date
								</th>
								<th class="text-left text-xs text-slate-500 uppercase tracking-wide px-4 py-2 border-b border-slate-700">
									Reminders
								</th>
								<th class="text-left text-xs text-slate-500 uppercase tracking-wide px-4 py-2 border-b border-slate-700">
									Clients
								</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((e) => (
								<tr key={e.id}>
									<td class="px-4 py-2 border-b border-slate-700 text-sm">
										<a
											href={`/admin/events/${e.id}`}
											class="text-blue-400 hover:text-blue-300 transition-colors"
										>
											{e.title}
										</a>
									</td>
									<td class="px-4 py-2 border-b border-slate-700 text-sm text-slate-400">
										{e.eventDate}
									</td>
									<td class="px-4 py-2 border-b border-slate-700 text-sm text-slate-400">
										{e.reminderCount}
									</td>
									<td class="px-4 py-2 border-b border-slate-700 text-sm text-slate-400">
										{e.clientCount}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		</Layout>,
	);
});

// GET /admin/events/new — create form
adminEventRoutes.get("/new", async (c) => {
	const allClients = await db
		.select({ id: clients.id, name: clients.name, email: clients.email })
		.from(clients)
		.orderBy(clients.email);

	const error = c.req.query("error");

	return c.html(
		<Layout title="New Event - sql-email">
			<h1 class="text-2xl font-bold text-white mb-6">New Event</h1>

			{error && (
				<div class="bg-red-950 border border-red-500 text-red-300 rounded-lg px-4 py-3 mb-6 text-sm">
					{decodeURIComponent(error)}
				</div>
			)}

			<div class="bg-slate-800 rounded-lg p-6">
				<form method="post" action="/admin/events">
					<div class="mb-4">
						<label for="title" class="block text-sm text-slate-400 mb-1">
							Title
						</label>
						<input
							type="text"
							id="title"
							name="title"
							required
							placeholder="Event title"
							class="w-full bg-slate-900 border border-slate-600 rounded-md text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
						/>
					</div>

					<div class="mb-4">
						<label for="description" class="block text-sm text-slate-400 mb-1">
							Description
						</label>
						<textarea
							id="description"
							name="description"
							placeholder="Optional description"
							class="w-full bg-slate-900 border border-slate-600 rounded-md text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500 min-h-24 resize-y"
						/>
					</div>

					<div class="mb-4">
						<label for="eventDate" class="block text-sm text-slate-400 mb-1">
							Event Date
						</label>
						<input
							type="date"
							id="eventDate"
							name="eventDate"
							required
							class="w-full bg-slate-900 border border-slate-600 rounded-md text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
						/>
					</div>

					<div class="mb-4">
						<label for="daysBefore" class="block text-sm text-slate-400 mb-1">
							Reminder Days Before (comma-separated, e.g. 1,3,7)
						</label>
						<input
							type="text"
							id="daysBefore"
							name="daysBefore"
							placeholder="7,3,1"
							class="w-full bg-slate-900 border border-slate-600 rounded-md text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
						/>
					</div>

					{allClients.length > 0 && (
						<div class="mb-6">
							<label
								htmlFor="clientIds"
								class="block text-sm text-slate-400 mb-2"
							>
								Assign Clients
							</label>
							<div id="clientIds" class="flex flex-wrap gap-2">
								{allClients.map((cl) => (
									<label
										key={cl.id}
										class="flex items-center gap-2 bg-slate-900 border border-slate-600 rounded-md px-3 py-1.5 text-sm cursor-pointer hover:border-slate-500 transition-colors"
									>
										<input
											type="checkbox"
											name="clientIds"
											value={String(cl.id)}
											class="w-4 h-4"
										/>
										{cl.name ? `${cl.name} (${cl.email})` : cl.email}
									</label>
								))}
							</div>
						</div>
					)}

					<button
						type="submit"
						class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors cursor-pointer"
					>
						Create Event
					</button>
				</form>
			</div>
		</Layout>,
	);
});

// POST /admin/events — handle form submission
adminEventRoutes.post("/", async (c) => {
	const form = await c.req.formData();

	const title = (form.get("title") as string | null)?.trim() ?? "";
	const description =
		(form.get("description") as string | null)?.trim() || null;
	const eventDate = (form.get("eventDate") as string | null)?.trim() ?? "";
	const daysBeforeRaw = (form.get("daysBefore") as string | null)?.trim() ?? "";
	const clientIdValues = form.getAll("clientIds") as string[];

	if (!title || title.length < 1 || title.length > 500) {
		const msg = encodeURIComponent(
			"Title is required and must be at most 500 characters.",
		);
		return c.redirect(`/admin/events/new?error=${msg}`);
	}
	if (!eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
		const msg = encodeURIComponent(
			"A valid event date (YYYY-MM-DD) is required.",
		);
		return c.redirect(`/admin/events/new?error=${msg}`);
	}

	const daysBefore: number[] = [];
	if (daysBeforeRaw) {
		for (const part of daysBeforeRaw.split(",")) {
			const n = Number(part.trim());
			if (!Number.isInteger(n) || n < 0) {
				const msg = encodeURIComponent(
					`Invalid reminder day: "${part.trim()}". Must be non-negative integers.`,
				);
				return c.redirect(`/admin/events/new?error=${msg}`);
			}
			daysBefore.push(n);
		}
	}

	const clientIds: number[] = clientIdValues
		.map((v) => Number(v))
		.filter((n) => Number.isInteger(n) && n > 0);

	const [event] = await db
		.insert(events)
		.values({ title, description, eventDate })
		.returning();

	if (daysBefore.length > 0) {
		await db
			.insert(eventReminders)
			.values(
				daysBefore.map((days) => ({ eventId: event.id, daysBefore: days })),
			);
	}

	if (clientIds.length > 0) {
		await db
			.insert(eventClients)
			.values(clientIds.map((clientId) => ({ eventId: event.id, clientId })));
	}

	return c.redirect(`/admin/events/${event.id}`);
});

// GET /admin/events/:id — event detail
adminEventRoutes.get("/:id", async (c) => {
	const id = Number(c.req.param("id"));

	const event = await db.query.events.findFirst({
		where: eq(events.id, id),
		with: { reminders: true, eventClients: { with: { client: true } } },
	});

	if (!event) {
		return c.html(
			<Layout title="Not Found - sql-email">
				<p class="text-slate-400">Event not found.</p>
			</Layout>,
			404,
		);
	}

	return c.html(
		<Layout title={`${event.title} - sql-email`}>
			<h1 class="text-2xl font-bold text-white mb-6">{event.title}</h1>

			<div class="bg-slate-800 rounded-lg p-6 mb-4">
				<h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
					Details
				</h2>
				<dl class="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2">
					<dt class="text-sm text-slate-500">Title</dt>
					<dd class="text-sm">{event.title}</dd>
					<dt class="text-sm text-slate-500">Event Date</dt>
					<dd class="text-sm">{event.eventDate}</dd>
					{event.description && (
						<>
							<dt class="text-sm text-slate-500">Description</dt>
							<dd class="text-sm">{event.description}</dd>
						</>
					)}
					<dt class="text-sm text-slate-500">Created</dt>
					<dd class="text-sm text-slate-400">
						{new Date(event.createdAt).toISOString()}
					</dd>
				</dl>
			</div>

			<div class="bg-slate-800 rounded-lg p-6 mb-4">
				<h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
					Reminder Schedule
				</h2>
				{event.reminders.length === 0 ? (
					<p class="text-slate-500 text-sm">No reminders configured.</p>
				) : (
					<div class="flex flex-wrap gap-2">
						{event.reminders.map((r) => (
							<span
								key={r.id}
								class="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm"
							>
								{r.daysBefore} day(s) before
							</span>
						))}
					</div>
				)}
			</div>

			<div class="bg-slate-800 rounded-lg p-6 mb-4">
				<h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
					Assigned Clients
				</h2>
				{event.eventClients.length === 0 ? (
					<p class="text-slate-500 text-sm">No clients assigned.</p>
				) : (
					<table class="w-full border-collapse">
						<thead>
							<tr>
								<th class="text-left text-xs text-slate-500 uppercase tracking-wide px-4 py-2 border-b border-slate-700">
									Name
								</th>
								<th class="text-left text-xs text-slate-500 uppercase tracking-wide px-4 py-2 border-b border-slate-700">
									Email
								</th>
							</tr>
						</thead>
						<tbody>
							{event.eventClients.map((ec) => (
								<tr key={ec.id}>
									<td class="px-4 py-2 border-b border-slate-700 text-sm">
										{ec.client.name ?? "-"}
									</td>
									<td class="px-4 py-2 border-b border-slate-700 text-sm text-slate-400">
										{ec.client.email}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>

			<div class="bg-slate-800 rounded-lg p-6">
				<h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
					Actions
				</h2>
				<form
					method="post"
					action={`/admin/events/${event.id}/delete`}
					onsubmit="return confirm('Delete this event and all its reminders?')"
				>
					<button
						type="submit"
						class="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors cursor-pointer"
					>
						Delete Event
					</button>
				</form>
			</div>
		</Layout>,
	);
});

// POST /admin/events/:id/delete — delete event
adminEventRoutes.post("/:id/delete", async (c) => {
	const id = Number(c.req.param("id"));
	await db.delete(events).where(eq(events.id, id));
	return c.redirect("/admin/events");
});
