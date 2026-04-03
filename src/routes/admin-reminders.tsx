import { asc, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { Layout } from "../components/Layout";
import { Card, Table, Td, TdPlain, Th } from "../components/ui";
import { db } from "../db";
import { clients, eventReminders, events, sentReminders } from "../db/schema";

export const adminReminderRoutes = new Hono();

// GET /admin/reminders — audit log of sent reminders
adminReminderRoutes.get("/", async (c) => {
	const currentUser = c.get("user") as { role: string };
	const sortParam = c.req.query("sort");
	const sortAsc = sortParam === "asc";
	const order = sortAsc
		? asc(sentReminders.sentAt)
		: desc(sentReminders.sentAt);

	const rows = await db
		.select({
			id: sentReminders.id,
			sentAt: sentReminders.sentAt,
			clientId: clients.id,
			clientName: clients.name,
			clientEmail: clients.email,
			eventTitle: events.title,
			daysBefore: eventReminders.daysBefore,
		})
		.from(sentReminders)
		.innerJoin(clients, eq(sentReminders.clientId, clients.id))
		.innerJoin(
			eventReminders,
			eq(sentReminders.eventReminderId, eventReminders.id),
		)
		.innerJoin(events, eq(eventReminders.eventId, events.id))
		.orderBy(order);

	const toggleSort = sortAsc ? "desc" : "asc";
	const sortLabel = sortAsc ? "Oldest first" : "Newest first";

	return c.html(
		<Layout title="Reminders - sql-email" userRole={currentUser.role}>
			<div class="flex items-center justify-between mb-6">
				<h1 class="text-2xl font-bold text-white">Sent Reminders</h1>
				<a
					href={`/admin/reminders?sort=${toggleSort}`}
					class="text-sm text-slate-400 hover:text-white transition-colors"
				>
					{sortLabel} ↕
				</a>
			</div>

			<Card title={`${rows.length} record${rows.length === 1 ? "" : "s"}`}>
				{rows.length === 0 ? (
					<p class="text-slate-500 text-sm">No reminders have been sent yet.</p>
				) : (
					<Table>
						<thead>
							<tr>
								<Th>Client</Th>
								<Th>Event</Th>
								<Th>Days Before</Th>
								<Th>Sent At</Th>
							</tr>
						</thead>
						<tbody>
							{rows.map((r) => (
								<tr key={r.id}>
									<TdPlain>
										<a
											href={`/admin/clients/${r.clientId}`}
											class="text-blue-400 hover:text-blue-300 transition-colors"
										>
											{r.clientName ?? r.clientEmail}
										</a>
										{r.clientName && (
											<span class="block text-xs text-slate-500">
												{r.clientEmail}
											</span>
										)}
									</TdPlain>
									<Td>{r.eventTitle}</Td>
									<Td>{r.daysBefore === -1 ? "Manual" : r.daysBefore}</Td>
									<Td>
										{new Date(r.sentAt)
											.toISOString()
											.replace("T", " ")
											.slice(0, 19)}
									</Td>
								</tr>
							))}
						</tbody>
					</Table>
				)}
			</Card>
		</Layout>,
	);
});
