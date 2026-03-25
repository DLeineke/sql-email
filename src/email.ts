import nodemailer from "nodemailer";

const htmlEscapes: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#39;",
};

export function escapeHtml(str: string): string {
	return str.replace(/[&<>"']/g, (ch) => htmlEscapes[ch]);
}

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT) || 587;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const emailFrom = process.env.EMAIL_FROM ?? "noreply@example.com";

const isConfigured = Boolean(smtpHost && smtpUser && smtpPass);

if (!isConfigured) {
	console.warn(
		"[email] SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASS). Emails will be logged but not sent.",
	);
}

const transport = isConfigured
	? nodemailer.createTransport({
			host: smtpHost,
			port: smtpPort,
			secure: smtpPort === 465,
			auth: {
				user: smtpUser,
				pass: smtpPass,
			},
		})
	: null;

export interface Email {
	to: string;
	subject: string;
	html: string;
}

export async function sendEmail(
	to: string,
	subject: string,
	html: string,
): Promise<void> {
	if (!transport) {
		console.log(`[email] To: ${to} | Subject: ${subject}`);
		return;
	}
	await transport.sendMail({ from: emailFrom, to, subject, html });
}

export async function sendBulkEmails(emails: Email[]): Promise<void> {
	for (const email of emails) {
		await sendEmail(email.to, email.subject, email.html);
	}
}
