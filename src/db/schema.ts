import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  boolean,
  date,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Clients who receive reminder emails
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  wantsDailySummary: boolean("wants_daily_summary").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Calendar events
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  eventDate: date("event_date", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Reminder schedule: how many days before an event to send a reminder
export const eventReminders = pgTable("event_reminders", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  daysBefore: integer("days_before").notNull(),
});

// Many-to-many: which clients are assigned to which events
export const eventClients = pgTable(
  "event_clients",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
  },
  (t) => [unique().on(t.eventId, t.clientId)]
);

// Audit log of sent reminders
export const sentReminders = pgTable("sent_reminders", {
  id: serial("id").primaryKey(),
  eventReminderId: integer("event_reminder_id")
    .notNull()
    .references(() => eventReminders.id, { onDelete: "cascade" }),
  clientId: integer("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});

// Relations for Drizzle relational queries
export const clientsRelations = relations(clients, ({ many }) => ({
  eventClients: many(eventClients),
  sentReminders: many(sentReminders),
}));

export const eventsRelations = relations(events, ({ many }) => ({
  reminders: many(eventReminders),
  eventClients: many(eventClients),
}));

export const eventRemindersRelations = relations(
  eventReminders,
  ({ one, many }) => ({
    event: one(events, {
      fields: [eventReminders.eventId],
      references: [events.id],
    }),
    sentReminders: many(sentReminders),
  })
);

export const eventClientsRelations = relations(eventClients, ({ one }) => ({
  event: one(events, {
    fields: [eventClients.eventId],
    references: [events.id],
  }),
  client: one(clients, {
    fields: [eventClients.clientId],
    references: [clients.id],
  }),
}));

export const sentRemindersRelations = relations(sentReminders, ({ one }) => ({
  eventReminder: one(eventReminders, {
    fields: [sentReminders.eventReminderId],
    references: [eventReminders.id],
  }),
  client: one(clients, {
    fields: [sentReminders.clientId],
    references: [clients.id],
  }),
}));
