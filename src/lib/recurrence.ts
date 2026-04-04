import { and, eq, gt, isNotNull, isNull } from "drizzle-orm";
import { db } from "../db";
import {
	eventClients,
	eventReminders,
	events,
	type RecurrencePattern,
} from "../db/schema";
import { logger } from "./logger";

/**
 * Advance a YYYY-MM-DD date by `interval` units of `pattern`.
 * For monthly, if the resulting month is shorter than the source day,
 * returns null (caller should skip this occurrence).
 */
function advanceDate(
	dateStr: string,
	pattern: RecurrencePattern,
	interval: number,
): string | null {
	const d = new Date(`${dateStr}T00:00:00Z`);
	const origDay = d.getUTCDate();

	switch (pattern) {
		case "daily":
			d.setUTCDate(d.getUTCDate() + interval);
			break;
		case "weekly":
			d.setUTCDate(d.getUTCDate() + interval * 7);
			break;
		case "monthly": {
			const targetMonth = d.getUTCMonth() + interval;
			d.setUTCMonth(targetMonth, 1); // set to 1st to avoid day overflow
			const daysInMonth = new Date(
				Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
			).getUTCDate();
			if (origDay > daysInMonth) return null; // skip months where day doesn't exist
			d.setUTCDate(origDay);
			break;
		}
	}
	return d.toISOString().slice(0, 10);
}

/**
 * Generate future occurrence dates for a recurring event template.
 * - Starts advancing from `startDate` (the template's own eventDate)
 * - Skips dates in the past (before today)
 * - Stops at `endDate` or 90 days from today, whichever is sooner
 * - For monthly recurrence, months where the day doesn't exist are skipped
 */
export function generateOccurrences(
	startDate: string,
	pattern: RecurrencePattern,
	interval: number,
	endDate: string | null,
): string[] {
	const today = new Date().toISOString().slice(0, 10);
	const ninetyDaysOut = (() => {
		const d = new Date();
		d.setUTCDate(d.getUTCDate() + 90);
		return d.toISOString().slice(0, 10);
	})();
	const effectiveEnd =
		endDate && endDate < ninetyDaysOut ? endDate : ninetyDaysOut;

	const dates: string[] = [];
	let current = startDate;
	let iterations = 0;
	const maxIterations = 500; // safety cap

	while (iterations < maxIterations) {
		iterations++;
		const next = advanceDate(current, pattern, interval);
		if (next === null) {
			// Skip this month — advance base by one interval unit to keep moving forward
			const d = new Date(`${current}T00:00:00Z`);
			d.setUTCMonth(d.getUTCMonth() + interval, 1);
			current = d.toISOString().slice(0, 10);
			continue;
		}
		current = next;
		if (current > effectiveEnd) break;
		if (current >= today) {
			dates.push(current);
		}
	}

	return dates;
}

/**
 * Sync future instances for one recurring event template.
 * Preserves past instances (so sent_reminders audit history stays intact).
 * Deletes future instances and regenerates them from the current template config.
 * Returns the count of new instances created.
 */
export async function syncEventInstances(
	parentEventId: number,
): Promise<number> {
	const parent = await db.query.events.findFirst({
		where: eq(events.id, parentEventId),
		with: { reminders: true, eventClients: true },
	});

	if (!parent || !parent.recurrencePattern) return 0;

	const today = new Date().toISOString().slice(0, 10);

	// Delete only future instances; past instances stay to preserve reminder audit logs
	await db
		.delete(events)
		.where(
			and(eq(events.parentEventId, parentEventId), gt(events.eventDate, today)),
		);

	const futureDates = generateOccurrences(
		parent.eventDate,
		parent.recurrencePattern,
		parent.recurrenceInterval ?? 1,
		parent.recurrenceEndDate ?? null,
	);

	for (const instanceDate of futureDates) {
		const [instance] = await db
			.insert(events)
			.values({
				title: parent.title,
				description: parent.description,
				eventDate: instanceDate,
				categoryId: parent.categoryId,
				parentEventId,
				// Instances are not themselves recurring
			})
			.returning();

		const scheduledReminders = parent.reminders.filter(
			(r) => r.daysBefore >= 0,
		);
		if (scheduledReminders.length > 0) {
			await db.insert(eventReminders).values(
				scheduledReminders.map((r) => ({
					eventId: instance.id,
					daysBefore: r.daysBefore,
				})),
			);
		}

		if (parent.eventClients.length > 0) {
			await db.insert(eventClients).values(
				parent.eventClients.map((ec) => ({
					eventId: instance.id,
					clientId: ec.clientId,
				})),
			);
		}
	}

	return futureDates.length;
}

/**
 * Sync instances for all active recurring event templates.
 * Called daily before processReminders() in the cron job.
 */
export async function syncAllRecurringEvents(): Promise<void> {
	const templates = await db
		.select({ id: events.id, title: events.title })
		.from(events)
		.where(
			and(isNotNull(events.recurrencePattern), isNull(events.parentEventId)),
		);

	for (const template of templates) {
		try {
			const count = await syncEventInstances(template.id);
			logger.info(
				`[recurrence] Synced "${template.title}" (id=${template.id}): ${count} future instance(s)`,
			);
		} catch (err) {
			logger.error(
				`[recurrence] Failed to sync template id=${template.id}:`,
				err,
			);
		}
	}
}
