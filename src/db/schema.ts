import { relations } from "drizzle-orm";
import {
	boolean,
	date,
	integer,
	pgTable,
	serial,
	text,
	timestamp,
	unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Users ────────────────────────────────────────────────

export type UserRole = "admin" | "viewer";

export const users = pgTable("users", {
	id: serial("id").primaryKey(),
	username: text("username").notNull().unique(),
	passwordHash: text("password_hash").notNull(),
	role: text("role").$type<UserRole>().notNull().default("viewer"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users, {
	username: z.string().min(1).max(100),
	passwordHash: z.string().min(1),
});
export type InsertUser = z.infer<typeof insertUserSchema>;

// ── Sessions ─────────────────────────────────────────────

export const sessions = pgTable("sessions", {
	id: text("id").primaryKey(),
	userId: integer("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	expiresAt: timestamp("expires_at").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
	sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id],
	}),
}));

// ── Clients ─────────────────────────────────────────────

export const clients = pgTable("clients", {
	id: serial("id").primaryKey(),
	email: text("email").notNull().unique(),
	name: text("name"),
	wantsDailySummary: boolean("wants_daily_summary").default(false).notNull(),
	unsubscribeToken: text("unsubscribe_token").unique(),
	unsubscribedAt: timestamp("unsubscribed_at"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertClientSchema = createInsertSchema(clients, {
	email: z.email(),
	name: z.string().min(1).max(200).optional(),
});
export type InsertClient = z.infer<typeof insertClientSchema>;

export const updateClientSchema = insertClientSchema.partial().omit({
	id: true,
	createdAt: true,
});
export type UpdateClient = z.infer<typeof updateClientSchema>;

// ── Categories ───────────────────────────────────────────

export const categories = pgTable("categories", {
	id: serial("id").primaryKey(),
	name: text("name").notNull().unique(),
	color: text("color").notNull().default("#3b82f6"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCategorySchema = createInsertSchema(categories, {
	name: z.string().min(1).max(100),
	color: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color like #rrggbb"),
});
export type InsertCategory = z.infer<typeof insertCategorySchema>;

// ── Events ──────────────────────────────────────────────

export type RecurrencePattern = "daily" | "weekly" | "monthly";

export const events = pgTable("events", {
	id: serial("id").primaryKey(),
	title: text("title").notNull(),
	description: text("description"),
	eventDate: date("event_date", { mode: "string" }).notNull(),
	categoryId: integer("category_id").references(() => categories.id, {
		onDelete: "set null",
	}),
	recurrencePattern: text("recurrence_pattern").$type<RecurrencePattern>(),
	recurrenceInterval: integer("recurrence_interval").default(1),
	recurrenceEndDate: date("recurrence_end_date", { mode: "string" }),
	parentEventId: integer("parent_event_id"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEventSchema = createInsertSchema(events, {
	title: z.string().min(1).max(500),
	eventDate: z.iso.date(),
	recurrencePattern: z
		.enum(["daily", "weekly", "monthly"])
		.nullable()
		.optional(),
	recurrenceInterval: z.int().min(1).max(365).optional(),
	recurrenceEndDate: z.iso.date().nullable().optional(),
}).extend({
	daysBefore: z.array(z.int().min(0)).optional(),
	clientIds: z.array(z.int().positive()).optional(),
});
export type InsertEvent = z.infer<typeof insertEventSchema>;

// ── Reminders ───────────────────────────────────────────

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
	(t) => [unique().on(t.eventId, t.clientId)],
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
export const categoriesRelations = relations(categories, ({ many }) => ({
	events: many(events),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
	eventClients: many(eventClients),
	sentReminders: many(sentReminders),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
	category: one(categories, {
		fields: [events.categoryId],
		references: [categories.id],
	}),
	parent: one(events, {
		fields: [events.parentEventId],
		references: [events.id],
		relationName: "eventInstances",
	}),
	instances: many(events, { relationName: "eventInstances" }),
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
	}),
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
