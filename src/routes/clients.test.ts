import { describe, expect, mock, test } from "bun:test";
import { Hono } from "hono";

const sampleClient = {
	id: 1,
	email: "alice@example.com",
	name: "Alice",
	wantsDailySummary: false,
	unsubscribeToken: "tok",
	unsubscribedAt: null,
	createdAt: new Date().toISOString(),
};

// Drizzle chains look like:
//   select().from(t).where(...)           -> awaitable array
//   insert(t).values(...).returning()     -> awaitable array
//   update(t).set(...).where(...).returning() -> awaitable array
//   delete(t).where(...).returning()      -> awaitable array
//
// Each builder step returns an object with the next step's method.
// The terminal step is a thenable so `await` resolves it.

function makeReturning(result: unknown[]) {
	return { returning: mock(async () => result) };
}

function makeWhereReturning(result: unknown[]) {
	return { where: mock(() => makeReturning(result)) };
}

// Controls the result for the next select().from().where() call.
let selectWhereResult: unknown[] = [sampleClient];

const mockDb = {
	select: mock(() => ({
		from: mock(() => ({
			where: mock(async () => selectWhereResult),
		})),
	})),
	insert: mock(() => ({
		values: mock(() => makeReturning([sampleClient])),
	})),
	update: mock(() => ({
		set: mock(() => makeWhereReturning([sampleClient])),
	})),
	delete: mock(() => ({
		where: mock(() => makeReturning([sampleClient])),
	})),
};

mock.module("../db", () => ({ db: mockDb }));

const { clientRoutes } = await import("./clients");

function makeApp() {
	const app = new Hono();
	app.route("/clients", clientRoutes);
	return app;
}

describe("GET /clients", () => {
	test("returns 200 with array of clients", async () => {
		// GET / uses select().from() without .where - make from() thenable
		mockDb.select.mockImplementationOnce(() => ({
			from: mock(async () => [sampleClient]),
		}));
		const res = await makeApp().request("/clients");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(Array.isArray(body)).toBe(true);
	});
});

describe("POST /clients", () => {
	test("returns 201 with created client", async () => {
		const res = await makeApp().request("/clients", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: "alice@example.com", name: "Alice" }),
		});
		expect(res.status).toBe(201);
	});

	test("returns 400 for invalid body", async () => {
		const res = await makeApp().request("/clients", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: "not-an-email" }),
		});
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body).toHaveProperty("error");
	});
});

describe("GET /clients/:id", () => {
	test("returns 404 for non-numeric id", async () => {
		const res = await makeApp().request("/clients/abc");
		expect(res.status).toBe(404);
	});

	test("returns 404 when client not found in db", async () => {
		selectWhereResult = [];
		const res = await makeApp().request("/clients/999");
		selectWhereResult = [sampleClient];
		expect(res.status).toBe(404);
	});

	test("returns 200 with client when found", async () => {
		const res = await makeApp().request("/clients/1");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.email).toBe("alice@example.com");
	});
});

describe("PATCH /clients/:id", () => {
	test("returns 404 for non-numeric id", async () => {
		const res = await makeApp().request("/clients/abc", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "Bob" }),
		});
		expect(res.status).toBe(404);
	});

	test("returns 404 when client not found in db", async () => {
		mockDb.update.mockImplementationOnce(() => ({
			set: mock(() => makeWhereReturning([])),
		}));
		const res = await makeApp().request("/clients/999", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "Bob" }),
		});
		expect(res.status).toBe(404);
	});

	test("returns 200 with updated client", async () => {
		const updated = { ...sampleClient, name: "Bob" };
		mockDb.update.mockImplementationOnce(() => ({
			set: mock(() => makeWhereReturning([updated])),
		}));
		const res = await makeApp().request("/clients/1", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "Bob" }),
		});
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.name).toBe("Bob");
	});
});

describe("DELETE /clients/:id", () => {
	test("returns 404 for non-numeric id", async () => {
		const res = await makeApp().request("/clients/abc", { method: "DELETE" });
		expect(res.status).toBe(404);
	});

	test("returns 404 when client not found in db", async () => {
		mockDb.delete.mockImplementationOnce(() => ({
			where: mock(() => makeReturning([])),
		}));
		const res = await makeApp().request("/clients/999", { method: "DELETE" });
		expect(res.status).toBe(404);
	});

	test("returns 200 with deleted client", async () => {
		const res = await makeApp().request("/clients/1", { method: "DELETE" });
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.id).toBe(1);
	});
});
