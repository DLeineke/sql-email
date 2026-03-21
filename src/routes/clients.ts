import { db } from "../db";
import { clients } from "../db/schema";
import { eq } from "drizzle-orm";

export async function handleClients(
  req: Request,
  url: URL
): Promise<Response | null> {
  // GET /clients
  if (url.pathname === "/clients" && req.method === "GET") {
    const result = await db.select().from(clients);
    return Response.json(result);
  }

  // POST /clients
  if (url.pathname === "/clients" && req.method === "POST") {
    const body = await req.json();
    const [created] = await db
      .insert(clients)
      .values({
        email: body.email,
        name: body.name,
        wantsDailySummary: body.wantsDailySummary ?? false,
      })
      .returning();
    return Response.json(created, { status: 201 });
  }

  // GET /clients/:id
  const clientMatch = url.pathname.match(/^\/clients\/(\d+)$/);
  if (clientMatch && req.method === "GET") {
    const id = Number(clientMatch[1]);
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, id));
    if (!client) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(client);
  }

  // PATCH /clients/:id
  if (clientMatch && req.method === "PATCH") {
    const id = Number(clientMatch[1]);
    const body = await req.json();
    const [updated] = await db
      .update(clients)
      .set(body)
      .where(eq(clients.id, id))
      .returning();
    if (!updated)
      return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(updated);
  }

  // DELETE /clients/:id
  if (clientMatch && req.method === "DELETE") {
    const id = Number(clientMatch[1]);
    const [deleted] = await db
      .delete(clients)
      .where(eq(clients.id, id))
      .returning();
    if (!deleted)
      return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(deleted);
  }

  return null;
}
