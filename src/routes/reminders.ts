import { Hono } from "hono";
import { processReminders } from "../reminders";

export const reminderRoutes = new Hono();

reminderRoutes.post("/process", async (c) => c.json(await processReminders()));
