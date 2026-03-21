import { and, eq, exists, not, sql } from "drizzle-orm";
import { db } from "./db";
import {
	clients,
	eventClients,
	eventReminders,
	events,
	sentReminders,
} from "./db/schema";
import { sendEmail } from "./email";

interface PendingReminder {
	eventId: number;
	eventTitle: string;
	eventDate: string;
	reminderId: number;
	daysBefore: number;
	clientId: number;
	clientEmail: string;
	clientName: string | null;
}

/**
 * Find all reminders that should be sent today and haven't been sent yet.
 */
export async function getPendingReminders(): Promise<PendingReminder[]> {
	const today = new Date().toISOString().split("T")[0];

	const results = await db
		.select({
			eventId: events.id,
			eventTitle: events.title,
			eventDate: events.eventDate,
			reminderId: eventReminders.id,
			daysBefore: eventReminders.daysBefore,
			clientId: clients.id,
			clientEmail: clients.email,
			clientName: clients.name,
		})
		.from(eventReminders)
		.innerJoin(events, eq(eventReminders.eventId, events.id))
		.innerJoin(eventClients, eq(eventClients.eventId, events.id))
		.innerJoin(clients, eq(eventClients.clientId, clients.id))
		.where(
			and(
				// event_date - days_before = today
				sql`${events.eventDate}::date - ${eventReminders.daysBefore} = ${today}::date`,
				// not already sent
				not(
					exists(
						db
							.select({ id: sentReminders.id })
							.from(sentReminders)
							.where(
								and(
									eq(sentReminders.eventReminderId, eventReminders.id),
									eq(sentReminders.clientId, clients.id),
								),
							),
					),
				),
			),
		);

	return results;
}

/**
 * Mark a reminder as sent for a client.
 */
export async function markReminderSent(
	eventReminderId: number,
	clientId: number,
) {
	await db.insert(sentReminders).values({ eventReminderId, clientId });
}

/**
 * Process all pending reminders for today.
 * Clients with daily summary enabled get one grouped email.
 * Others get individual emails per reminder.
 */
export async function processReminders() {
	const pending = await getPendingReminders();

	if (pending.length === 0) {
		console.log("No pending reminders for today.");
		return { individual: 0, summaries: 0 };
	}

	// Separate summary vs individual clients
	const summaryClients = new Map<
		number,
		{ email: string; name: string | null; reminders: PendingReminder[] }
	>();
	const individualReminders: PendingReminder[] = [];

	// Check which clients want daily summaries
	const clientIds = [...new Set(pending.map((r) => r.clientId))];
	const clientPrefs = await db
		.select({ id: clients.id, wantsDailySummary: clients.wantsDailySummary })
		.from(clients)
		.where(sql`${clients.id} IN ${clientIds}`);

	const summarySet = new Set(
		clientPrefs.filter((c) => c.wantsDailySummary).map((c) => c.id),
	);

	for (const reminder of pending) {
		if (summarySet.has(reminder.clientId)) {
			if (!summaryClients.has(reminder.clientId)) {
				summaryClients.set(reminder.clientId, {
					email: reminder.clientEmail,
					name: reminder.clientName,
					reminders: [],
				});
			}
			summaryClients.get(reminder.clientId)?.reminders.push(reminder);
		} else {
			individualReminders.push(reminder);
		}
	}

	// Send individual reminder emails
	for (const r of individualReminders) {
		const subject = `Reminder: "${r.eventTitle}" is in ${r.daysBefore} day(s)`;
		const html = `
			<p>Hi${r.clientName ? ` ${r.clientName}` : ""},</p>
			<p>This is a reminder that <strong>${r.eventTitle}</strong> is coming up in <strong>${r.daysBefore} day(s)</strong> on ${r.eventDate}.</p>
		`.trim();
		console.log(`[EMAIL] To: ${r.clientEmail} | ${subject}`);
		await sendEmail(r.clientEmail, subject, html);
		await markReminderSent(r.reminderId, r.clientId);
	}

	// Send summary emails
	for (const [clientId, data] of summaryClients) {
		const itemsHtml = data.reminders
			.map(
				(r) =>
					`<li><strong>${r.eventTitle}</strong> — in ${r.daysBefore} day(s) (${r.eventDate})</li>`,
			)
			.join("\n");
		const subject = `Your daily reminder summary (${data.reminders.length} upcoming)`;
		const html = `
			<p>Hi${data.name ? ` ${data.name}` : ""},</p>
			<p>Here is your daily reminder summary:</p>
			<ul>${itemsHtml}</ul>
		`.trim();
		console.log(
			`[SUMMARY EMAIL] To: ${data.email} | ${data.reminders.length} reminder(s)`,
		);
		await sendEmail(data.email, subject, html);
		for (const r of data.reminders) {
			await markReminderSent(r.reminderId, clientId);
		}
	}

	return {
		individual: individualReminders.length,
		summaries: summaryClients.size,
	};
}
