import { handleClients } from "./routes/clients";
import { handleEvents } from "./routes/events";
import { processReminders } from "./reminders";

const port = Number(process.env.PORT) || 3001;

const server = Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/") {
      return new Response("sql-email reminder service");
    }

    // POST /reminders/process — trigger reminder processing
    if (url.pathname === "/reminders/process" && req.method === "POST") {
      const result = await processReminders();
      return Response.json(result);
    }

    // Route to handlers
    const response =
      (await handleClients(req, url)) ?? (await handleEvents(req, url));

    if (response) return response;

    return Response.json({ error: "Not Found" }, { status: 404 });
  },
});

console.log(`Listening on http://localhost:${server.port}`);
