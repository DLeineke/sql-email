import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { clients, insertClientSchema, updateClientSchema } from "../db/schema";
import { parseIntParam } from "../lib/params";

export const clientRoutes = new Hono();

clientRoutes.get("/", async (c) => {
	const result = await db.select().from(clients);
	return c.json(result);
});

clientRoutes.post("/", async (c) => {
	const parsed = insertClientSchema.safeParse(await c.req.json());
	if (!parsed.success) {
		return c.json({ error: parsed.error.issues }, 400);
	}
	const unsubscribeToken = crypto.randomUUID();
	const [created] = await db
		.insert(clients)
		.values({ ...parsed.data, unsubscribeToken })
		.returning();
	return c.json(created, 201);
});

clientRoutes.get("/:id", async (c) => {
	const id = parseIntParam(c.req.param("id"));
	if (id === null) return c.json({ error: "Not found" }, 404);
	const [client] = await db.select().from(clients).where(eq(clients.id, id));
	if (!client) return c.json({ error: "Not found" }, 404);
	return c.json(client);
});

clientRoutes.patch("/:id", async (c) => {
	const id = parseIntParam(c.req.param("id"));
	if (id === null) return c.json({ error: "Not found" }, 404);
	const parsed = updateClientSchema.safeParse(await c.req.json());
	if (!parsed.success) {
		return c.json({ error: parsed.error.issues }, 400);
	}
	const [updated] = await db
		.update(clients)
		.set(parsed.data)
		.where(eq(clients.id, id))
		.returning();
	if (!updated) return c.json({ error: "Not found" }, 404);
	return c.json(updated);
});

clientRoutes.delete("/:id", async (c) => {
	const id = parseIntParam(c.req.param("id"));
	if (id === null) return c.json({ error: "Not found" }, 404);
	const [deleted] = await db
		.delete(clients)
		.where(eq(clients.id, id))
		.returning();
	if (!deleted) return c.json({ error: "Not found" }, 404);
	return c.json(deleted);
});
