import { and, eq, gt } from "drizzle-orm";
import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { db } from "../db";
import { sessions, users } from "../db/schema";

export const SESSION_COOKIE = "session_id";

export async function requireAuth(c: Context, next: Next) {
	const sessionId = getCookie(c, SESSION_COOKIE);
	if (!sessionId) {
		return c.redirect("/auth/login");
	}

	const [row] = await db
		.select({ session: sessions, user: users })
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())));

	if (!row) {
		return c.redirect("/auth/login");
	}

	c.set("user", { id: row.user.id, username: row.user.username });
	await next();
}
