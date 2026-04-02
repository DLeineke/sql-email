import { describe, expect, mock, test } from "bun:test";
import { Hono } from "hono";

const sampleEvent = {
	id: 1,
	title: "Annual Review",
	description: null,
	eventDate: "2026-06-15",
	createdAt: new Date().toISOString(),
	reminders: [],
	eventClients: [],
};

function makeReturning(result: unknown[]) {
	return { returning: mock(async () => result) };
}

const mockDb = {
	insert: mock(() => ({
		values: mock(() => makeReturning([sampleEvent])),
	})),
	delete: mock(() => ({
		where: mock(() => makeReturning([sampleEvent])),
	})),
	query: {
		events: {
			findMany: mock(async () => [sampleEvent]),
			findFirst: mock(async () => sampleEvent),
		},
	},
};

mock.module("../db", () => ({ db: mockDb }));

const { eventRoutes } = await import("./events");

function makeApp() {
	const app = new Hono();
	app.route("/events", eventRoutes);
	return app;
}

describe("GET /events", () => {
	test("returns 200 with array of events", async () => {
		const res = await makeApp().request("/events");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(Array.isArray(body)).toBe(true);
	});
});

describe("POST /events", () => {
	test("returns 201 with created event", async () => {
		const res = await makeApp().request("/events", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "Annual Review", eventDate: "2026-06-15" }),
		});
		expect(res.status).toBe(201);
	});

	test("returns 400 when title is missing", async () => {
		const res = await makeApp().request("/events", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ eventDate: "2026-06-15" }),
		});
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body).toHaveProperty("error");
	});

	test("returns 400 when eventDate is invalid", async () => {
		const res = await makeApp().request("/events", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "Test", eventDate: "not-a-date" }),
		});
		expect(res.status).toBe(400);
	});
});

describe("GET /events/:id", () => {
	test("returns 404 for non-numeric id", async () => {
		const res = await makeApp().request("/events/abc");
		expect(res.status).toBe(404);
	});

	test("returns 404 when event not found", async () => {
		mockDb.query.events.findFirst.mockImplementationOnce(async () => undefined);
		const res = await makeApp().request("/events/999");
		expect(res.status).toBe(404);
	});

	test("returns 200 with event when found", async () => {
		const res = await makeApp().request("/events/1");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.title).toBe("Annual Review");
	});
});

describe("DELETE /events/:id", () => {
	test("returns 404 for non-numeric id", async () => {
		const res = await makeApp().request("/events/abc", { method: "DELETE" });
		expect(res.status).toBe(404);
	});

	test("returns 404 when event not found in db", async () => {
		mockDb.delete.mockImplementationOnce(() => ({
			where: mock(() => makeReturning([])),
		}));
		const res = await makeApp().request("/events/999", { method: "DELETE" });
		expect(res.status).toBe(404);
	});

	test("returns 200 with deleted event", async () => {
		const res = await makeApp().request("/events/1", { method: "DELETE" });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.title).toBe("Annual Review");
	});
});
