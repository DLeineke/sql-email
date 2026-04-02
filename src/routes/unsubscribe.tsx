import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { PublicLayout } from "../components/PublicLayout";
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
			<PublicLayout title="Unsubscribe - sql-email">
				<div class="w-full max-w-sm">
					<div class="bg-slate-800 rounded-lg p-8 text-center">
						<div class="text-5xl mb-4 text-red-400">&#10007;</div>
						<h1 class="text-xl font-bold text-red-400 mb-2">Invalid link</h1>
						<p class="text-slate-400 text-sm">
							This unsubscribe link is invalid or has already expired.
						</p>
					</div>
				</div>
			</PublicLayout>,
			404,
		);
	}

	if (client.unsubscribedAt) {
		return c.html(
			<PublicLayout title="Already Unsubscribed - sql-email">
				<div class="w-full max-w-sm">
					<div class="bg-slate-800 rounded-lg p-8 text-center">
						<div class="text-5xl mb-4 text-slate-400">&#8211;</div>
						<h1 class="text-xl font-bold text-slate-300 mb-2">
							Already unsubscribed
						</h1>
						<p class="text-slate-400 text-sm">
							You have already been unsubscribed from reminder emails.
						</p>
					</div>
				</div>
			</PublicLayout>,
		);
	}

	await db
		.update(clients)
		.set({ unsubscribedAt: new Date() })
		.where(eq(clients.unsubscribeToken, token));

	return c.html(
		<PublicLayout title="Unsubscribed - sql-email">
			<div class="w-full max-w-sm">
				<div class="bg-slate-800 rounded-lg p-8 text-center">
					<div class="text-5xl mb-4 text-green-400">&#10003;</div>
					<h1 class="text-xl font-bold text-green-400 mb-2">
						You have been unsubscribed
					</h1>
					<p class="text-slate-400 text-sm">
						You will no longer receive reminder emails from us.
					</p>
				</div>
			</div>
		</PublicLayout>,
	);
});
