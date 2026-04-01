import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { db } from "../db";
import { sessions, users } from "../db/schema";
import { SESSION_COOKIE } from "../middleware/auth";

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function generateSessionId(): string {
	return (
		crypto.randomUUID().replace(/-/g, "") +
		crypto.randomUUID().replace(/-/g, "")
	);
}

export const authRoutes = new Hono();

authRoutes.get("/login", (c) => {
	const error = c.req.query("error");
	return c.html(
		<html lang="en">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>Login - sql-email</title>
				<link rel="stylesheet" href="/styles.css" />
			</head>
			<body class="bg-slate-900 text-slate-200 min-h-screen flex items-center justify-center">
				<div class="w-full max-w-sm">
					<h1 class="text-2xl font-bold text-white mb-6 text-center">
						sql-email
					</h1>
					<div class="bg-slate-800 rounded-lg p-6">
						<h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
							Sign in
						</h2>
						{error && (
							<div class="mb-4 text-sm text-red-400 bg-red-950 rounded px-3 py-2">
								{error === "invalid"
									? "Invalid username or password."
									: "An error occurred."}
							</div>
						)}
						<form method="post" action="/auth/login" class="space-y-4">
							<div>
								<label
									for="username"
									class="block text-xs text-slate-400 uppercase tracking-wide mb-1"
								>
									Username
								</label>
								<input
									id="username"
									name="username"
									type="text"
									required
									autocomplete="username"
									class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
								/>
							</div>
							<div>
								<label
									for="password"
									class="block text-xs text-slate-400 uppercase tracking-wide mb-1"
								>
									Password
								</label>
								<input
									id="password"
									name="password"
									type="password"
									required
									autocomplete="current-password"
									class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
								/>
							</div>
							<button
								type="submit"
								class="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors cursor-pointer"
							>
								Sign in
							</button>
						</form>
					</div>
				</div>
			</body>
		</html>,
	);
});

authRoutes.post("/login", async (c) => {
	const body = await c.req.parseBody();
	const username = String(body.username ?? "").trim();
	const password = String(body.password ?? "");

	if (!username || !password) {
		return c.redirect("/auth/login?error=invalid");
	}

	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.username, username));

	if (!user) {
		return c.redirect("/auth/login?error=invalid");
	}

	const valid = await Bun.password.verify(password, user.passwordHash);
	if (!valid) {
		return c.redirect("/auth/login?error=invalid");
	}

	const sessionId = generateSessionId();
	const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

	await db.insert(sessions).values({
		id: sessionId,
		userId: user.id,
		expiresAt,
	});

	setCookie(c, SESSION_COOKIE, sessionId, {
		httpOnly: true,
		sameSite: "Lax",
		path: "/",
		expires: expiresAt,
	});

	return c.redirect("/admin");
});

authRoutes.post("/logout", async (c) => {
	const sessionId = getCookie(c, SESSION_COOKIE);
	if (sessionId) {
		await db.delete(sessions).where(eq(sessions.id, sessionId));
	}
	deleteCookie(c, SESSION_COOKIE, { path: "/" });
	return c.redirect("/auth/login");
});
