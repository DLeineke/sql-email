import { escapeHtml } from "../email";

const appBaseUrl = (
	process.env.APP_BASE_URL ?? "http://localhost:3001"
).replace(/\/$/, "");

// ── Layout ────────────────────────────────────────────────

/**
 * Wraps email body content in a responsive, branded HTML email layout.
 * `unsubscribeToken` is optional; when provided a footer unsubscribe link
 * is appended.
 */
export function emailLayout(
	bodyHtml: string,
	unsubscribeToken: string | null = null,
): string {
	const unsubscribeSection = unsubscribeToken
		? `
    <tr>
      <td style="padding:24px 40px;border-top:1px solid #334155;text-align:center;">
        <p style="margin:0;font-size:12px;color:#64748b;font-family:system-ui,sans-serif;">
          You received this email because you signed up for event reminders.<br>
          <a href="${escapeHtml(`${appBaseUrl}/unsubscribe/${encodeURIComponent(unsubscribeToken)}`)}"
             style="color:#3b82f6;text-decoration:underline;">Unsubscribe</a>
        </p>
      </td>
    </tr>`
		: "";

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>sql-email</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:600px;background:#1e293b;border-radius:8px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding:32px 40px;background:#0f172a;border-bottom:1px solid #334155;">
              <p style="margin:0;font-size:20px;font-weight:700;color:#f1f5f9;letter-spacing:-0.02em;">
                sql-email
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;color:#cbd5e1;font-size:15px;line-height:1.6;">
              ${bodyHtml}
            </td>
          </tr>
          ${unsubscribeSection}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Templates ─────────────────────────────────────────────

export interface ReminderEmailOptions {
	clientName: string | null;
	eventTitle: string;
	eventDate: string;
	daysBefore: number;
	unsubscribeToken: string | null;
}

/** Single-event reminder email. */
export function reminderEmail(opts: ReminderEmailOptions): string {
	const greeting = opts.clientName
		? `Hi ${escapeHtml(opts.clientName)},`
		: "Hi,";

	const body = `
    <p style="margin:0 0 16px;color:#f1f5f9;font-size:16px;">${greeting}</p>
    <p style="margin:0 0 24px;">
      This is a reminder that
      <strong style="color:#f1f5f9;">${escapeHtml(opts.eventTitle)}</strong>
      is coming up in
      <strong style="color:#f1f5f9;">${opts.daysBefore} day${opts.daysBefore === 1 ? "" : "s"}</strong>
      on <strong style="color:#f1f5f9;">${escapeHtml(opts.eventDate)}</strong>.
    </p>
    <table cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:#334155;border-radius:6px;padding:12px 20px;">
          <p style="margin:0;font-size:13px;color:#94a3b8;">Event</p>
          <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#f1f5f9;">${escapeHtml(opts.eventTitle)}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#94a3b8;">${escapeHtml(opts.eventDate)}</p>
        </td>
      </tr>
    </table>`;

	return emailLayout(body, opts.unsubscribeToken);
}

export interface SummaryEmailOptions {
	clientName: string | null;
	reminders: Array<{
		eventTitle: string;
		eventDate: string;
		daysBefore: number;
	}>;
	unsubscribeToken: string | null;
}

/** Daily summary email (multiple events). */
export function summaryEmail(opts: SummaryEmailOptions): string {
	const greeting = opts.clientName
		? `Hi ${escapeHtml(opts.clientName)},`
		: "Hi,";

	const rows = opts.reminders
		.map(
			(r) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #334155;">
          <p style="margin:0;font-size:15px;font-weight:600;color:#f1f5f9;">${escapeHtml(r.eventTitle)}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#94a3b8;">
            In ${r.daysBefore} day${r.daysBefore === 1 ? "" : "s"} &mdash; ${escapeHtml(r.eventDate)}
          </p>
        </td>
      </tr>`,
		)
		.join("");

	const body = `
    <p style="margin:0 0 16px;color:#f1f5f9;font-size:16px;">${greeting}</p>
    <p style="margin:0 0 24px;">Here is your daily reminder summary:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #334155;">
      ${rows}
    </table>`;

	return emailLayout(body, opts.unsubscribeToken);
}

export interface NotifyEmailOptions {
	eventTitle: string;
	eventDate: string;
	eventDescription: string | null;
	unsubscribeToken: string | null;
}

/** Admin "send notification now" email. */
export function notifyEmail(opts: NotifyEmailOptions): string {
	const descriptionRow = opts.eventDescription
		? `<p style="margin:16px 0 0;color:#94a3b8;">${escapeHtml(opts.eventDescription)}</p>`
		: "";

	const body = `
    <p style="margin:0 0 24px;">You have an upcoming event:</p>
    <table cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td style="background:#334155;border-radius:6px;padding:16px 20px;">
          <p style="margin:0;font-size:18px;font-weight:700;color:#f1f5f9;">${escapeHtml(opts.eventTitle)}</p>
          <p style="margin:6px 0 0;font-size:13px;color:#94a3b8;">${escapeHtml(opts.eventDate)}</p>
          ${descriptionRow}
        </td>
      </tr>
    </table>`;

	return emailLayout(body, opts.unsubscribeToken);
}
