import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import {
	eventClients,
	eventReminders,
	events,
	insertEventSchema,
} from "../db/schema";

export const eventRoutes = new Hono();

eventRoutes.get("/", async (c) => {
	const result = await db.query.events.findMany({
		with: { reminders: true, eventClients: true },
	});
	return c.json(result);
});

eventRoutes.post("/", async (c) => {
	const parsed = insertEventSchema.safeParse(await c.req.json());
	if (!parsed.success) {
		return c.json({ error: parsed.error.issues }, 400);
	}
	const { daysBefore, clientIds, ...eventData } = parsed.data;

	const [event] = await db.insert(events).values(eventData).returning();

	if (daysBefore?.length) {
		await db.insert(eventReminders).values(
			daysBefore.map((days) => ({
				eventId: event.id,
				daysBefore: days,
			})),
		);
	}

	if (clientIds?.length) {
		await db.insert(eventClients).values(
			clientIds.map((clientId) => ({
				eventId: event.id,
				clientId,
			})),
		);
	}

	const created = await db.query.events.findFirst({
		where: eq(events.id, event.id),
		with: { reminders: true, eventClients: true },
	});

	return c.json(created, 201);
});

eventRoutes.get("/:id", async (c) => {
	const id = Number(c.req.param("id"));
	const event = await db.query.events.findFirst({
		where: eq(events.id, id),
		with: { reminders: true, eventClients: true },
	});
	if (!event) return c.json({ error: "Not found" }, 404);
	return c.json(event);
});

eventRoutes.delete("/:id", async (c) => {
	const id = Number(c.req.param("id"));
	const [deleted] = await db
		.delete(events)
		.where(eq(events.id, id))
		.returning();
	if (!deleted) return c.json({ error: "Not found" }, 404);
	return c.json(deleted);
});
