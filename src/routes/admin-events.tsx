import { and, eq, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";

import { Layout } from "../components/Layout";
import {
	Badge,
	Button,
	Card,
	LinkButton,
	Table,
	Td,
	TdPlain,
	Th,
} from "../components/ui";
import { db } from "../db";
import {
	categories,
	clients,
	eventClients,
	eventReminders,
	events,
	type RecurrencePattern,
	sentReminders,
} from "../db/schema";
import { sendEmail } from "../lib/email";
import { notifyEmail } from "../lib/email-templates";
import { parseIntParam } from "../lib/params";
import { syncEventInstances } from "../lib/recurrence";

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
				categoryId: number | null;
				daysBefore: number[];
				clientIds: number[];
				recurrencePattern: RecurrencePattern | null;
				recurrenceInterval: number;
				recurrenceEndDate: string | null;
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
	const categoryIdRaw = (form.get("categoryId") as string | null)?.trim() ?? "";
	const daysBeforeRaw = (form.get("daysBefore") as string | null)?.trim() ?? "";
	const clientIdValues = form.getAll("clientIds") as string[];
	const recurrencePatternRaw =
		(form.get("recurrencePattern") as string | null)?.trim() || null;
	const recurrenceIntervalRaw =
		(form.get("recurrenceInterval") as string | null)?.trim() ?? "1";
	const recurrenceEndDateRaw =
		(form.get("recurrenceEndDate") as string | null)?.trim() || null;

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

	const validPatterns = ["daily", "weekly", "monthly"] as const;
	const recurrencePattern: RecurrencePattern | null =
		recurrencePatternRaw &&
		(validPatterns as readonly string[]).includes(recurrencePatternRaw)
			? (recurrencePatternRaw as RecurrencePattern)
			: null;

	const recurrenceInterval = Math.max(
		1,
		Math.min(365, Number.parseInt(recurrenceIntervalRaw, 10) || 1),
	);

	const recurrenceEndDate =
		recurrenceEndDateRaw &&
		/^\d{4}-\d{2}-\d{2}$/.test(recurrenceEndDateRaw) &&
		recurrenceEndDateRaw > eventDate
			? recurrenceEndDateRaw
			: null;

	const categoryId = categoryIdRaw
		? Number.isInteger(Number(categoryIdRaw))
			? Number(categoryIdRaw)
			: null
		: null;

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
		data: {
			title,
			description,
			eventDate,
			categoryId,
			daysBefore,
			clientIds,
			recurrencePattern,
			recurrenceInterval,
			recurrenceEndDate,
		},
	};
}

// ── Routes ───────────────────────────────────────────────

// GET /admin/events — list all events
adminEventRoutes.get("/", async (c) => {
	const currentUser = c.get("user") as { role: string };
	const isAdmin = currentUser.role === "admin";
	const filterCategoryId = parseIntParam(c.req.query("category") ?? "");

	const allCategories = await db
		.select()
		.from(categories)
		.orderBy(categories.name);

	const baseWhere = filterCategoryId
		? and(isNull(events.parentEventId), eq(events.categoryId, filterCategoryId))
		: isNull(events.parentEventId);

	const rows = await db
		.select({
			id: events.id,
			title: events.title,
			eventDate: events.eventDate,
			categoryId: events.categoryId,
			categoryName: categories.name,
			categoryColor: categories.color,
			recurrencePattern: events.recurrencePattern,
			reminderCount: sql<number>`COUNT(DISTINCT ${eventReminders.id})`,
			clientCount: sql<number>`COUNT(DISTINCT ${eventClients.id})`,
		})
		.from(events)
		.leftJoin(categories, eq(categories.id, events.categoryId))
		.leftJoin(eventReminders, eq(eventReminders.eventId, events.id))
		.leftJoin(eventClients, eq(eventClients.eventId, events.id))
		.where(baseWhere)
		.groupBy(
			events.id,
			events.title,
			events.eventDate,
			events.categoryId,
			categories.name,
			categories.color,
		)
		.orderBy(events.eventDate);

	return c.html(
		<Layout title="Events - sql-email" userRole={currentUser.role}>
			<div class="flex items-center justify-between mb-6">
				<h1 class="text-2xl font-bold text-white">Events</h1>
				{isAdmin && (
					<LinkButton href="/admin/events/new" variant="primary">
						New Event
					</LinkButton>
				)}
			</div>

			{allCategories.length > 0 && (
				<div class="flex flex-wrap gap-2 mb-4">
					<a
						href="/admin/events"
						class={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
							!filterCategoryId
								? "bg-slate-600 text-white"
								: "bg-slate-800 text-slate-400 hover:text-white"
						}`}
					>
						All
					</a>
					{allCategories.map((cat) => (
						<a
							key={cat.id}
							href={`/admin/events?category=${cat.id}`}
							class={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
								filterCategoryId === cat.id
									? "text-white"
									: "text-white opacity-60 hover:opacity-100"
							}`}
							style={`background-color:${cat.color}`}
						>
							{cat.name}
						</a>
					))}
				</div>
			)}

			<Card title="All Events">
				{rows.length === 0 ? (
					<p class="text-slate-500 text-sm">No events yet.</p>
				) : (
					<Table>
						<thead>
							<tr>
								<Th>Title</Th>
								<Th>Category</Th>
								<Th>Event Date</Th>
								<Th>Recurrence</Th>
								<Th>Reminders</Th>
								<Th>Clients</Th>
							</tr>
						</thead>
						<tbody>
							{rows.map((e) => (
								<tr key={e.id}>
									<TdPlain>
										<a
											href={`/admin/events/${e.id}`}
											class="text-blue-400 hover:text-blue-300 transition-colors"
										>
											{e.title}
										</a>
									</TdPlain>
									<TdPlain>
										{e.categoryName && e.categoryColor ? (
											<Badge color={e.categoryColor}>{e.categoryName}</Badge>
										) : (
											<span class="text-slate-600">—</span>
										)}
									</TdPlain>
									<Td>{e.eventDate}</Td>
									<TdPlain>
										{e.recurrencePattern ? (
											<Badge variant="blue">{e.recurrencePattern}</Badge>
										) : (
											<span class="text-slate-600">—</span>
										)}
									</TdPlain>
									<Td>{e.reminderCount}</Td>
									<Td>{e.clientCount}</Td>
								</tr>
							))}
						</tbody>
					</Table>
				)}
			</Card>
		</Layout>,
	);
});

// GET /admin/events/new — create form
adminEventRoutes.get("/new", async (c) => {
	const currentUser = c.get("user") as { role: string };
	const [allClients, allCategories] = await Promise.all([
		db
			.select({ id: clients.id, name: clients.name, email: clients.email })
			.from(clients)
			.orderBy(clients.email),
		db.select().from(categories).orderBy(categories.name),
	]);

	const error = c.req.query("error");

	return c.html(
		<Layout title="New Event - sql-email" userRole={currentUser.role}>
			<h1 class="text-2xl font-bold text-white mb-6">New Event</h1>

			{error && (
				<div class="bg-red-950 border border-red-500 text-red-300 rounded-lg px-4 py-3 mb-6 text-sm">
					{decodeURIComponent(error)}
				</div>
			)}

			<Card>
				<form method="post" action="/admin/events">
					<EventFormFields
						allClients={allClients}
						allCategories={allCategories}
					/>
					<Button>Create Event</Button>
				</form>
			</Card>
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

	const {
		title,
		description,
		eventDate,
		categoryId,
		daysBefore,
		clientIds,
		recurrencePattern,
		recurrenceInterval,
		recurrenceEndDate,
	} = parsed.data;

	const event = await db.transaction(async (tx) => {
		const [created] = await tx
			.insert(events)
			.values({
				title,
				description,
				eventDate,
				categoryId,
				recurrencePattern,
				recurrenceInterval,
				recurrenceEndDate,
			})
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

	// Generate instances after the template is fully saved (with reminders/clients)
	if (recurrencePattern) {
		await syncEventInstances(event.id);
	}

	return c.redirect(`/admin/events/${event.id}`);
});

// GET /admin/events/:id — event detail
adminEventRoutes.get("/:id", async (c) => {
	const currentUser = c.get("user") as { role: string };
	const isAdmin = currentUser.role === "admin";
	const id = parseIntParam(c.req.param("id"));
	if (id === null)
		return c.html(
			<Layout title="Not Found - sql-email" userRole={currentUser.role}>
				<p class="text-slate-400">Event not found.</p>
			</Layout>,
			404,
		);

	const event = await db.query.events.findFirst({
		where: eq(events.id, id),
		with: {
			category: true,
			reminders: true,
			eventClients: { with: { client: true } },
			parent: true,
			instances: true,
		},
	});

	if (!event) {
		return c.html(
			<Layout title="Not Found - sql-email" userRole={currentUser.role}>
				<p class="text-slate-400">Event not found.</p>
			</Layout>,
			404,
		);
	}

	const notified = c.req.query("notified");

	return c.html(
		<Layout title={`${event.title} - sql-email`} userRole={currentUser.role}>
			{notified && (
				<div class="bg-green-950 border border-green-500 text-green-300 rounded-lg px-4 py-3 mb-6 text-sm">
					Notification sent to {notified} client(s).
				</div>
			)}
			<div class="flex items-center justify-between mb-6">
				<h1 class="text-2xl font-bold text-white">{event.title}</h1>
				{isAdmin && (
					<LinkButton href={`/admin/events/${event.id}/edit`}>Edit</LinkButton>
				)}
			</div>

			<Card title="Details" class="mb-4">
				<dl class="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2">
					<dt class="text-sm text-slate-500">Title</dt>
					<dd class="text-sm">{event.title}</dd>
					<dt class="text-sm text-slate-500">Event Date</dt>
					<dd class="text-sm">{event.eventDate}</dd>
					<dt class="text-sm text-slate-500">Category</dt>
					<dd class="text-sm">
						{event.category ? (
							<Badge color={event.category.color}>{event.category.name}</Badge>
						) : (
							<span class="text-slate-500 italic">None</span>
						)}
					</dd>
					{event.recurrencePattern && (
						<>
							<dt class="text-sm text-slate-500">Recurrence</dt>
							<dd class="text-sm">
								<Badge variant="blue">{event.recurrencePattern}</Badge>
								{event.recurrenceInterval && event.recurrenceInterval > 1 && (
									<span class="ml-2 text-slate-400 text-xs">
										every {event.recurrenceInterval} units
									</span>
								)}
								{event.recurrenceEndDate && (
									<span class="ml-2 text-slate-400 text-xs">
										until {event.recurrenceEndDate}
									</span>
								)}
							</dd>
						</>
					)}
					{event.parent && (
						<>
							<dt class="text-sm text-slate-500">Part of series</dt>
							<dd class="text-sm">
								<a
									href={`/admin/events/${event.parent.id}`}
									class="text-blue-400 hover:text-blue-300 transition-colors"
								>
									{event.parent.title} (template: {event.parent.eventDate})
								</a>
							</dd>
						</>
					)}
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
			</Card>

			{event.instances && event.instances.length > 0 && (
				<Card title="Recurring Instances" class="mb-4">
					<Table>
						<thead>
							<tr>
								<Th>Date</Th>
								<Th>View</Th>
							</tr>
						</thead>
						<tbody>
							{event.instances
								.slice()
								.sort((a, b) => a.eventDate.localeCompare(b.eventDate))
								.map((inst) => (
									<tr key={inst.id}>
										<Td>{inst.eventDate}</Td>
										<TdPlain>
											<a
												href={`/admin/events/${inst.id}`}
												class="text-blue-400 hover:text-blue-300 transition-colors text-sm"
											>
												View
											</a>
										</TdPlain>
									</tr>
								))}
						</tbody>
					</Table>
				</Card>
			)}

			<Card title="Reminder Schedule" class="mb-4">
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
			</Card>

			<Card title="Assigned Clients" class="mb-4">
				{event.eventClients.length === 0 ? (
					<p class="text-slate-500 text-sm">No clients assigned.</p>
				) : (
					<Table>
						<thead>
							<tr>
								<Th>Name</Th>
								<Th>Email</Th>
							</tr>
						</thead>
						<tbody>
							{event.eventClients.map((ec) => {
								const unsub = ec.client.unsubscribedAt !== null;
								return (
									<tr key={ec.id}>
										<td
											class={`px-4 py-2 border-b border-slate-700 text-sm${unsub ? " text-slate-500" : ""}`}
										>
											{ec.client.name ?? "-"}
											{unsub && (
												<Badge variant="red" class="ml-2">
													Unsubscribed
												</Badge>
											)}
										</td>
										<td
											class={`px-4 py-2 border-b border-slate-700 text-sm${unsub ? " text-slate-500" : " text-slate-400"}`}
										>
											{ec.client.email}
										</td>
									</tr>
								);
							})}
						</tbody>
					</Table>
				)}
			</Card>

			{isAdmin && (
				<Card title="Actions">
					<div class="flex gap-3 flex-wrap">
						<form method="post" action={`/admin/events/${event.id}/notify`}>
							<Button>Send Notification Now</Button>
						</form>
						{event.recurrencePattern && !event.parentEventId && (
							<form method="post" action={`/admin/events/${event.id}/sync`}>
								<Button variant="secondary">Regenerate Instances</Button>
							</form>
						)}
						<form
							method="post"
							action={`/admin/events/${event.id}/delete`}
							onsubmit="return confirm('Delete this event and all its reminders?')"
						>
							<Button variant="danger">Delete Event</Button>
						</form>
					</div>
				</Card>
			)}
		</Layout>,
	);
});

// GET /admin/events/:id/edit — edit form
adminEventRoutes.get("/:id/edit", async (c) => {
	const currentUser = c.get("user") as { role: string };
	const id = parseIntParam(c.req.param("id"));
	if (id === null)
		return c.html(
			<Layout title="Not Found - sql-email" userRole={currentUser.role}>
				<p class="text-slate-400">Event not found.</p>
			</Layout>,
			404,
		);

	const event = await db.query.events.findFirst({
		where: eq(events.id, id),
		with: { reminders: true, eventClients: true },
	});

	if (!event) {
		return c.html(
			<Layout title="Not Found - sql-email" userRole={currentUser.role}>
				<p class="text-slate-400">Event not found.</p>
			</Layout>,
			404,
		);
	}

	const [allClients, allCategories] = await Promise.all([
		db
			.select({ id: clients.id, name: clients.name, email: clients.email })
			.from(clients)
			.orderBy(clients.email),
		db.select().from(categories).orderBy(categories.name),
	]);

	const assignedClientIds = new Set(
		event.eventClients.map((ec) => ec.clientId),
	);
	// Exclude sentinel manual-push reminders (daysBefore = -1) from the edit form
	const daysBeforeValue = event.reminders
		.filter((r) => r.daysBefore >= 0)
		.map((r) => r.daysBefore)
		.sort((a, b) => b - a)
		.join(",");

	const error = c.req.query("error");
	const isInstance = event.parentEventId !== null;

	return c.html(
		<Layout
			title={`Edit ${event.title} - sql-email`}
			userRole={currentUser.role}
		>
			<h1 class="text-2xl font-bold text-white mb-6">Edit Event</h1>

			{isInstance && (
				<div class="bg-amber-950 border border-amber-600 text-amber-300 rounded-lg px-4 py-3 mb-6 text-sm">
					This is a recurring instance. Editing it only changes this occurrence.{" "}
					<a
						href={`/admin/events/${event.parentEventId}`}
						class="underline hover:text-amber-200"
					>
						View series template
					</a>
				</div>
			)}

			{error && (
				<div class="bg-red-950 border border-red-500 text-red-300 rounded-lg px-4 py-3 mb-6 text-sm">
					{decodeURIComponent(error)}
				</div>
			)}

			<Card>
				<form method="post" action={`/admin/events/${event.id}/edit`}>
					<EventFormFields
						allClients={allClients}
						allCategories={allCategories}
						isInstance={isInstance}
						defaults={{
							title: event.title,
							description: event.description ?? "",
							eventDate: event.eventDate,
							categoryId: event.categoryId ?? null,
							daysBeforeValue,
							assignedClientIds,
							recurrencePattern: event.recurrencePattern ?? null,
							recurrenceInterval: event.recurrenceInterval ?? 1,
							recurrenceEndDate: event.recurrenceEndDate ?? null,
						}}
					/>
					<div class="flex gap-3">
						<Button>Save Changes</Button>
						<LinkButton href={`/admin/events/${event.id}`}>Cancel</LinkButton>
					</div>
				</form>
			</Card>
		</Layout>,
	);
});

// POST /admin/events/:id/edit — handle edit form submission
adminEventRoutes.post("/:id/edit", async (c) => {
	const id = parseIntParam(c.req.param("id"));
	if (id === null) return c.redirect("/admin/events");
	const form = await c.req.formData();
	const parsed = parseEventForm(form);

	if (!parsed.success) {
		return c.redirect(
			`/admin/events/${id}/edit?error=${encodeURIComponent(parsed.error)}`,
		);
	}

	const {
		title,
		description,
		eventDate,
		categoryId,
		daysBefore,
		clientIds,
		recurrencePattern,
		recurrenceInterval,
		recurrenceEndDate,
	} = parsed.data;

	// Fetch current parentEventId before update
	const [existing] = await db
		.select({ parentEventId: events.parentEventId })
		.from(events)
		.where(eq(events.id, id));
	const isTemplate = existing && existing.parentEventId === null;

	await db.transaction(async (tx) => {
		await tx
			.update(events)
			.set({
				title,
				description,
				eventDate,
				categoryId,
				recurrencePattern,
				recurrenceInterval,
				recurrenceEndDate,
			})
			.where(eq(events.id, id));

		// Replace reminders: delete non-sentinel, re-insert
		await tx
			.delete(eventReminders)
			.where(
				and(
					eq(eventReminders.eventId, id),
					sql`${eventReminders.daysBefore} >= 0`,
				),
			);
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

	// If template was updated, sync future instances
	if (isTemplate && recurrencePattern) {
		await syncEventInstances(id);
	}

	return c.redirect(`/admin/events/${id}`);
});

// POST /admin/events/:id/notify — send immediate notification to all assigned clients
adminEventRoutes.post("/:id/notify", async (c) => {
	const id = parseIntParam(c.req.param("id"));
	if (id === null) return c.redirect("/admin/events");

	const event = await db.query.events.findFirst({
		where: eq(events.id, id),
		with: { eventClients: { with: { client: true } } },
	});

	if (!event) {
		return c.redirect("/admin/events");
	}

	const subject = `Reminder: ${event.title}`;

	const activeClients = event.eventClients.filter(
		(ec) => ec.client.unsubscribedAt === null,
	);

	await Promise.all(
		activeClients.map((ec) => {
			const html = notifyEmail({
				eventTitle: event.title,
				eventDate: event.eventDate,
				eventDescription: event.description ?? null,
				unsubscribeToken: ec.client.unsubscribeToken,
			});
			return sendEmail(ec.client.email, subject, html);
		}),
	);

	// Find or create the sentinel eventReminder row (daysBefore: -1) for manual pushes
	let [manualReminder] = await db
		.select()
		.from(eventReminders)
		.where(
			and(eq(eventReminders.eventId, id), eq(eventReminders.daysBefore, -1)),
		);

	if (!manualReminder) {
		[manualReminder] = await db
			.insert(eventReminders)
			.values({ eventId: id, daysBefore: -1 })
			.returning();
	}

	// Log each sent notification to sent_reminders
	await Promise.all(
		activeClients.map((ec) =>
			db.insert(sentReminders).values({
				eventReminderId: manualReminder.id,
				clientId: ec.client.id,
			}),
		),
	);

	return c.redirect(`/admin/events/${id}?notified=${activeClients.length}`);
});

// POST /admin/events/:id/sync — regenerate recurring instances
adminEventRoutes.post("/:id/sync", async (c) => {
	const id = parseIntParam(c.req.param("id"));
	if (id === null) return c.redirect("/admin/events");
	await syncEventInstances(id);
	return c.redirect(`/admin/events/${id}`);
});

// POST /admin/events/:id/delete — delete event
adminEventRoutes.post("/:id/delete", async (c) => {
	const id = parseIntParam(c.req.param("id"));
	if (id === null) return c.redirect("/admin/events");
	await db.delete(events).where(eq(events.id, id));
	return c.redirect("/admin/events");
});

// ── Shared form component ────────────────────────────────

interface ClientOption {
	id: number;
	name: string | null;
	email: string;
}

interface CategoryOption {
	id: number;
	name: string;
	color: string;
}

interface FormDefaults {
	title: string;
	description: string;
	eventDate: string;
	categoryId: number | null;
	daysBeforeValue: string;
	assignedClientIds: Set<number>;
	recurrencePattern: RecurrencePattern | null;
	recurrenceInterval: number;
	recurrenceEndDate: string | null;
}

function EventFormFields({
	allClients,
	allCategories = [],
	isInstance = false,
	defaults,
}: {
	allClients: ClientOption[];
	allCategories?: CategoryOption[];
	isInstance?: boolean;
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
				<label for="categoryId" class="block text-sm text-slate-400 mb-1">
					Category (optional)
				</label>
				<select
					id="categoryId"
					name="categoryId"
					class="w-full bg-slate-900 border border-slate-600 rounded-md text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
				>
					<option value="">— None —</option>
					{allCategories.map((cat) => (
						<option
							key={cat.id}
							value={String(cat.id)}
							selected={defaults?.categoryId === cat.id}
						>
							{cat.name}
						</option>
					))}
				</select>
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

			{!isInstance && (
				<div class="mb-6 border border-slate-700 rounded-lg p-4">
					<p class="text-sm font-medium text-slate-300 mb-3">Recurrence</p>
					<div class="flex flex-wrap gap-4">
						<div class="flex-1 min-w-36">
							<label
								for="recurrencePattern"
								class="block text-sm text-slate-400 mb-1"
							>
								Repeats
							</label>
							<select
								id="recurrencePattern"
								name="recurrencePattern"
								class="w-full bg-slate-900 border border-slate-600 rounded-md text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
							>
								<option value="">— None —</option>
								<option
									value="daily"
									selected={defaults?.recurrencePattern === "daily"}
								>
									Daily
								</option>
								<option
									value="weekly"
									selected={defaults?.recurrencePattern === "weekly"}
								>
									Weekly
								</option>
								<option
									value="monthly"
									selected={defaults?.recurrencePattern === "monthly"}
								>
									Monthly
								</option>
							</select>
						</div>
						<div class="w-28">
							<label
								for="recurrenceInterval"
								class="block text-sm text-slate-400 mb-1"
							>
								Every
							</label>
							<input
								type="number"
								id="recurrenceInterval"
								name="recurrenceInterval"
								min="1"
								max="365"
								value={String(defaults?.recurrenceInterval ?? 1)}
								class="w-full bg-slate-900 border border-slate-600 rounded-md text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
							/>
						</div>
						<div class="flex-1 min-w-36">
							<label
								for="recurrenceEndDate"
								class="block text-sm text-slate-400 mb-1"
							>
								Until (optional)
							</label>
							<input
								type="date"
								id="recurrenceEndDate"
								name="recurrenceEndDate"
								value={defaults?.recurrenceEndDate ?? ""}
								class="w-full bg-slate-900 border border-slate-600 rounded-md text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
							/>
						</div>
					</div>
					<p class="text-xs text-slate-500 mt-2">
						Instances are generated up to 90 days out (or the until date, if
						sooner). Editing the template regenerates future instances.
					</p>
				</div>
			)}
		</>
	);
}
