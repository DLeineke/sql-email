const reminderTimezone = process.env.TZ_REMINDERS ?? "UTC";

export function todayInTimezone(): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: reminderTimezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(new Date());
}
