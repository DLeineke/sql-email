import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { clients } from "../db/schema";

export const unsubscribeRoutes = new Hono();

unsubscribeRoutes.get("/:token", async (c) => {
	const token = c.req.param("token");

	const [client] = await db
		.select({ id: clients.id, unsubscribedAt: clients.unsubscribedAt })
		.from(clients)
		.where(eq(clients.unsubscribeToken, token))
		.limit(1);

	if (!client) {
		return c.html(
			<html lang="en">
				<head>
					<meta charset="UTF-8" />
					<title>Unsubscribe</title>
				</head>
				<body>
					<h1>Invalid link</h1>
					<p>This unsubscribe link is invalid or has already expired.</p>
				</body>
			</html>,
			404,
		);
	}

	if (client.unsubscribedAt) {
		return c.html(
			<html lang="en">
				<head>
					<meta charset="UTF-8" />
					<title>Already unsubscribed</title>
				</head>
				<body>
					<h1>Already unsubscribed</h1>
					<p>You have already been unsubscribed from reminder emails.</p>
				</body>
			</html>,
		);
	}

	await db
		.update(clients)
		.set({ unsubscribedAt: new Date() })
		.where(eq(clients.unsubscribeToken, token));

	return c.html(
		<html lang="en">
			<head>
				<meta charset="UTF-8" />
				<title>Unsubscribed</title>
			</head>
			<body>
				<h1>You have been unsubscribed</h1>
				<p>You will no longer receive reminder emails from us.</p>
			</body>
		</html>,
	);
});
