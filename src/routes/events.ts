import { db } from "../db";
import { events, eventReminders, eventClients } from "../db/schema";
import { eq } from "drizzle-orm";

export async function handleEvents(
  req: Request,
  url: URL
): Promise<Response | null> {
  // GET /events
  if (url.pathname === "/events" && req.method === "GET") {
    const result = await db.query.events.findMany({
      with: { reminders: true, eventClients: true },
    });
    return Response.json(result);
  }

  // POST /events
  if (url.pathname === "/events" && req.method === "POST") {
    const body = await req.json();

    const [event] = await db
      .insert(events)
      .values({
        title: body.title,
        description: body.description,
        eventDate: body.eventDate,
      })
      .returning();

    // Create reminder schedules (e.g. [7, 3, 1] days before)
    if (body.daysBefore?.length) {
      await db.insert(eventReminders).values(
        body.daysBefore.map((days: number) => ({
          eventId: event.id,
          daysBefore: days,
        }))
      );
    }

    // Assign clients to the event
    if (body.clientIds?.length) {
      await db.insert(eventClients).values(
        body.clientIds.map((clientId: number) => ({
          eventId: event.id,
          clientId,
        }))
      );
    }

    const created = await db.query.events.findFirst({
      where: eq(events.id, event.id),
      with: { reminders: true, eventClients: true },
    });

    return Response.json(created, { status: 201 });
  }

  // GET /events/:id
  const eventMatch = url.pathname.match(/^\/events\/(\d+)$/);
  if (eventMatch && req.method === "GET") {
    const id = Number(eventMatch[1]);
    const event = await db.query.events.findFirst({
      where: eq(events.id, id),
      with: { reminders: true, eventClients: true },
    });
    if (!event) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(event);
  }

  // DELETE /events/:id
  if (eventMatch && req.method === "DELETE") {
    const id = Number(eventMatch[1]);
    const [deleted] = await db
      .delete(events)
      .where(eq(events.id, id))
      .returning();
    if (!deleted)
      return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(deleted);
  }

  return null;
}
