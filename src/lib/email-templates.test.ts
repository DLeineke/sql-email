import { describe, expect, test } from "bun:test";
import {
	emailLayout,
	notifyEmail,
	reminderEmail,
	summaryEmail,
} from "./email-templates";

describe("emailLayout", () => {
	test("includes unsubscribe link when token provided", () => {
		const html = emailLayout("<p>body</p>", "tok-123");
		expect(html).toContain("/unsubscribe/tok-123");
		expect(html).toContain("Unsubscribe");
	});

	test("omits unsubscribe section when token is null", () => {
		const html = emailLayout("<p>body</p>", null);
		expect(html).not.toContain("unsubscribe");
	});
});

describe("reminderEmail", () => {
	const base = {
		clientName: null,
		eventTitle: "Team Meetup",
		eventDate: "2026-06-15",
		daysBefore: 3,
		unsubscribeToken: null,
	};

	test("contains event title, date, and daysBefore", () => {
		const html = reminderEmail(base);
		expect(html).toContain("Team Meetup");
		expect(html).toContain("2026-06-15");
		expect(html).toContain("3 day");
	});

	test("with clientName includes greeting with name", () => {
		const html = reminderEmail({ ...base, clientName: "Alice" });
		expect(html).toContain("Hi Alice,");
	});

	test("without clientName uses 'Hi,'", () => {
		const html = reminderEmail(base);
		expect(html).toContain("Hi,");
	});

	test("HTML-escapes title containing <script>", () => {
		const html = reminderEmail({ ...base, eventTitle: "<script>xss</script>" });
		expect(html).toContain("&lt;script&gt;xss&lt;/script&gt;");
		expect(html).not.toContain("<script>xss</script>");
	});
});

describe("summaryEmail", () => {
	const reminders = [
		{ eventTitle: "Alpha", eventDate: "2026-06-01", daysBefore: 7 },
		{ eventTitle: "Beta", eventDate: "2026-06-10", daysBefore: 1 },
	];

	test("contains all event titles in the reminders array", () => {
		const html = summaryEmail({
			clientName: null,
			reminders,
			unsubscribeToken: null,
		});
		expect(html).toContain("Alpha");
		expect(html).toContain("Beta");
	});

	test("HTML-escapes event titles containing <script>", () => {
		const unsafe = [
			{
				eventTitle: "<script>bad</script>",
				eventDate: "2026-06-01",
				daysBefore: 2,
			},
		];
		const html = summaryEmail({
			clientName: null,
			reminders: unsafe,
			unsubscribeToken: null,
		});
		expect(html).toContain("&lt;script&gt;bad&lt;/script&gt;");
		expect(html).not.toContain("<script>bad</script>");
	});
});

describe("notifyEmail", () => {
	const base = {
		eventTitle: "Conference",
		eventDate: "2026-09-01",
		eventDescription: null,
		unsubscribeToken: null,
	};

	test("contains event title and date", () => {
		const html = notifyEmail(base);
		expect(html).toContain("Conference");
		expect(html).toContain("2026-09-01");
	});

	test("includes description when provided", () => {
		const html = notifyEmail({
			...base,
			eventDescription: "Bring your laptop",
		});
		expect(html).toContain("Bring your laptop");
	});

	test("HTML-escapes description containing <script>", () => {
		const html = notifyEmail({
			...base,
			eventDescription: "<script>bad</script>",
		});
		expect(html).toContain("&lt;script&gt;bad&lt;/script&gt;");
		expect(html).not.toContain("<script>bad</script>");
	});
});
