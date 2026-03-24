import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";

import { Layout } from "../components/Layout";
import { db } from "../db";
import { clients, eventClients, eventReminders, events } from "../db/schema";
import { sendEmail } from "../email";

export const adminEventRoutes = new Hono();

// ── Helpers ──────────────────────────────────────────────

/** Parse and validate the shared event form fields. Returns data or an error string. */
function parseEventForm(form: FormData):
	| {
			success: true;
			data: {
				title: string;
				description: string | null;
				eventDate: string;
				daysBefore: number[];
				clientIds: number[];
			};
	  }
	| {
			success: false;
			error: string;
	  } {
	const title = (form.get("title") as string | null)?.trim() ?? "";
	const description =
		(form.get("description") as string | null)?.trim() || null;
	const eventDate = (form.get("eventDate") as string | null)?.trim() ?? "";
	const daysBeforeRaw = (form.get("daysBefore") as string | null)?.trim() ?? "";
	const clientIdValues = form.getAll("clientIds") as string[];

	if (!title || title.length > 500) {
		return {
			success: false,
			error: "Title is required and must be at most 500 characters.",
		};
	}
	if (!eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
		return {
			success: false,
			error: "A valid event date (YYYY-MM-DD) is required.",
		};
	}

	const daysBefore: number[] = [];
	if (daysBeforeRaw) {
		for (const part of daysBeforeRaw.split(",")) {
			const n = Number(part.trim());
			if (!Number.isInteger(n) || n < 0) {
				return {
					success: false,
					error: `Invalid reminder day: "${part.trim()}". Must be non-negative integers.`,
				};
			}
			daysBefore.push(n);
		}
	}

	const clientIds = clientIdValues
		.map((v) => Number(v))
		.filter((n) => Number.isInteger(n) && n > 0);

	return {
		success: true,
		data: { title, description, eventDate, daysBefore, clientIds },
	};
}

// ── Routes ───────────────────────────────────────────────

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
					<EventFormFields allClients={allClients} />
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

// POST /admin/events — handle create form submission
adminEventRoutes.post("/", async (c) => {
	const form = await c.req.formData();
	const parsed = parseEventForm(form);

	if (!parsed.success) {
		return c.redirect(
			`/admin/events/new?error=${encodeURIComponent(parsed.error)}`,
		);
	}

	const { title, description, eventDate, daysBefore, clientIds } = parsed.data;

	const event = await db.transaction(async (tx) => {
		const [created] = await tx
			.insert(events)
			.values({ title, description, eventDate })
			.returning();

		if (daysBefore.length > 0) {
			await tx.insert(eventReminders).values(
				daysBefore.map((days: number) => ({
					eventId: created.id,
					daysBefore: days,
				})),
			);
		}

		if (clientIds.length > 0) {
			await tx.insert(eventClients).values(
				clientIds.map((clientId: number) => ({
					eventId: created.id,
					clientId,
				})),
			);
		}

		return created;
	});

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

	const notified = c.req.query("notified");

	return c.html(
		<Layout title={`${event.title} - sql-email`}>
			{notified && (
				<div class="bg-green-950 border border-green-500 text-green-300 rounded-lg px-4 py-3 mb-6 text-sm">
					Notification sent to {notified} client(s).
				</div>
			)}
			<div class="flex items-center justify-between mb-6">
				<h1 class="text-2xl font-bold text-white">{event.title}</h1>
				<a
					href={`/admin/events/${event.id}/edit`}
					class="bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
				>
					Edit
				</a>
			</div>

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
				<div class="flex gap-3">
					<form method="post" action={`/admin/events/${event.id}/notify`}>
						<button
							type="submit"
							class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors cursor-pointer"
						>
							Send Notification Now
						</button>
					</form>
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
			</div>
		</Layout>,
	);
});

// GET /admin/events/:id/edit — edit form
adminEventRoutes.get("/:id/edit", async (c) => {
	const id = Number(c.req.param("id"));

	const event = await db.query.events.findFirst({
		where: eq(events.id, id),
		with: { reminders: true, eventClients: true },
	});

	if (!event) {
		return c.html(
			<Layout title="Not Found - sql-email">
				<p class="text-slate-400">Event not found.</p>
			</Layout>,
			404,
		);
	}

	const allClients = await db
		.select({ id: clients.id, name: clients.name, email: clients.email })
		.from(clients)
		.orderBy(clients.email);

	const assignedClientIds = new Set(
		event.eventClients.map((ec) => ec.clientId),
	);
	const daysBeforeValue = event.reminders
		.map((r) => r.daysBefore)
		.sort((a, b) => b - a)
		.join(",");

	const error = c.req.query("error");

	return c.html(
		<Layout title={`Edit ${event.title} - sql-email`}>
			<h1 class="text-2xl font-bold text-white mb-6">Edit Event</h1>

			{error && (
				<div class="bg-red-950 border border-red-500 text-red-300 rounded-lg px-4 py-3 mb-6 text-sm">
					{decodeURIComponent(error)}
				</div>
			)}

			<div class="bg-slate-800 rounded-lg p-6">
				<form method="post" action={`/admin/events/${event.id}/edit`}>
					<EventFormFields
						allClients={allClients}
						defaults={{
							title: event.title,
							description: event.description ?? "",
							eventDate: event.eventDate,
							daysBeforeValue,
							assignedClientIds,
						}}
					/>
					<div class="flex gap-3">
						<button
							type="submit"
							class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors cursor-pointer"
						>
							Save Changes
						</button>
						<a
							href={`/admin/events/${event.id}`}
							class="bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
						>
							Cancel
						</a>
					</div>
				</form>
			</div>
		</Layout>,
	);
});

// POST /admin/events/:id/edit — handle edit form submission
adminEventRoutes.post("/:id/edit", async (c) => {
	const id = Number(c.req.param("id"));
	const form = await c.req.formData();
	const parsed = parseEventForm(form);

	if (!parsed.success) {
		return c.redirect(
			`/admin/events/${id}/edit?error=${encodeURIComponent(parsed.error)}`,
		);
	}

	const { title, description, eventDate, daysBefore, clientIds } = parsed.data;

	await db.transaction(async (tx) => {
		await tx
			.update(events)
			.set({ title, description, eventDate })
			.where(eq(events.id, id));

		// Replace reminders: delete all, re-insert
		await tx.delete(eventReminders).where(eq(eventReminders.eventId, id));
		if (daysBefore.length > 0) {
			await tx
				.insert(eventReminders)
				.values(
					daysBefore.map((days: number) => ({ eventId: id, daysBefore: days })),
				);
		}

		// Replace client assignments: delete all, re-insert
		await tx.delete(eventClients).where(eq(eventClients.eventId, id));
		if (clientIds.length > 0) {
			await tx
				.insert(eventClients)
				.values(
					clientIds.map((clientId: number) => ({ eventId: id, clientId })),
				);
		}
	});

	return c.redirect(`/admin/events/${id}`);
});

// POST /admin/events/:id/notify — send immediate notification to all assigned clients
adminEventRoutes.post("/:id/notify", async (c) => {
	const id = Number(c.req.param("id"));

	const event = await db.query.events.findFirst({
		where: eq(events.id, id),
		with: { eventClients: { with: { client: true } } },
	});

	if (!event) {
		return c.redirect("/admin/events");
	}

	const subject = `Reminder: ${event.title}`;
	const html = [
		`<h1>${event.title}</h1>`,
		`<p><strong>Date:</strong> ${event.eventDate}</p>`,
		event.description ? `<p>${event.description}</p>` : "",
	].join("\n");

	await Promise.all(
		event.eventClients.map((ec) => sendEmail(ec.client.email, subject, html)),
	);

	return c.redirect(
		`/admin/events/${id}?notified=${event.eventClients.length}`,
	);
});

// POST /admin/events/:id/delete — delete event
adminEventRoutes.post("/:id/delete", async (c) => {
	const id = Number(c.req.param("id"));
	await db.delete(events).where(eq(events.id, id));
	return c.redirect("/admin/events");
});

// ── Shared form component ────────────────────────────────

interface ClientOption {
	id: number;
	name: string | null;
	email: string;
}

interface FormDefaults {
	title: string;
	description: string;
	eventDate: string;
	daysBeforeValue: string;
	assignedClientIds: Set<number>;
}

function EventFormFields({
	allClients,
	defaults,
}: {
	allClients: ClientOption[];
	defaults?: FormDefaults;
}) {
	return (
		<>
			<div class="mb-4">
				<label for="title" class="block text-sm text-slate-400 mb-1">
					Title
				</label>
				<input
					type="text"
					id="title"
					name="title"
					required
					value={defaults?.title ?? ""}
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
				>
					{defaults?.description ?? ""}
				</textarea>
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
					value={defaults?.eventDate ?? ""}
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
					value={defaults?.daysBeforeValue ?? ""}
					placeholder="7,3,1"
					class="w-full bg-slate-900 border border-slate-600 rounded-md text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
				/>
			</div>

			{allClients.length > 0 && (
				<div class="mb-6">
					<label htmlFor="clientIds" class="block text-sm text-slate-400 mb-2">
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
									checked={defaults?.assignedClientIds.has(cl.id) ?? false}
									class="w-4 h-4"
								/>
								{cl.name ? `${cl.name} (${cl.email})` : cl.email}
							</label>
						))}
					</div>
				</div>
			)}
		</>
	);
}
