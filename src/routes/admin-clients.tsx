import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { Layout } from "../components/Layout";
import { db } from "../db";
import { clients, updateClientSchema } from "../db/schema";
import { parseIntParam } from "../lib/params";

export const adminClientRoutes = new Hono();

// GET /admin/clients — list all clients
adminClientRoutes.get("/", async (c) => {
	const rows = await db.select().from(clients).orderBy(clients.createdAt);

	return c.html(
		<Layout title="Clients - sql-email">
			<div class="flex items-center justify-between mb-6">
				<h1 class="text-2xl font-bold text-white">Clients</h1>
			</div>

			<div class="bg-slate-800 rounded-lg p-6">
				<h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
					All Clients
				</h2>
				{rows.length === 0 ? (
					<p class="text-slate-500 text-sm">No clients yet.</p>
				) : (
					<table class="w-full border-collapse">
						<thead>
							<tr>
								<th class="text-left text-xs text-slate-500 uppercase tracking-wide px-4 py-2 border-b border-slate-700">
									Name
								</th>
								<th class="text-left text-xs text-slate-500 uppercase tracking-wide px-4 py-2 border-b border-slate-700">
									Email
								</th>
								<th class="text-left text-xs text-slate-500 uppercase tracking-wide px-4 py-2 border-b border-slate-700">
									Daily Summary
								</th>
								<th class="text-left text-xs text-slate-500 uppercase tracking-wide px-4 py-2 border-b border-slate-700">
									Joined
								</th>
								<th class="px-4 py-2 border-b border-slate-700" />
							</tr>
						</thead>
						<tbody>
							{rows.map((cl) => (
								<tr key={cl.id}>
									<td class="px-4 py-2 border-b border-slate-700 text-sm">
										<a
											href={`/admin/clients/${cl.id}`}
											class="text-blue-400 hover:text-blue-300 transition-colors"
										>
											{cl.name ?? <span class="text-slate-500 italic">—</span>}
										</a>
									</td>
									<td class="px-4 py-2 border-b border-slate-700 text-sm text-slate-400">
										{cl.email}
									</td>
									<td class="px-4 py-2 border-b border-slate-700 text-sm">
										{cl.wantsDailySummary ? (
											<span class="px-2 py-0.5 rounded text-xs font-semibold bg-green-950 text-green-400">
												Yes
											</span>
										) : (
											<span class="px-2 py-0.5 rounded text-xs font-semibold bg-slate-700 text-slate-400">
												No
											</span>
										)}
									</td>
									<td class="px-4 py-2 border-b border-slate-700 text-sm text-slate-400">
										{new Date(cl.createdAt).toISOString().slice(0, 10)}
									</td>
									<td class="px-4 py-2 border-b border-slate-700 text-sm text-right">
										<a
											href={`/admin/clients/${cl.id}/edit`}
											class="text-slate-400 hover:text-white transition-colors mr-4"
										>
											Edit
										</a>
										<form
											method="post"
											action={`/admin/clients/${cl.id}/delete`}
											class="inline"
											onsubmit="return confirm('Delete this client?')"
										>
											<button
												type="submit"
												class="text-red-400 hover:text-red-300 transition-colors cursor-pointer bg-transparent border-none p-0"
											>
												Delete
											</button>
										</form>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		</Layout>,
	);
});

// GET /admin/clients/:id — client detail
adminClientRoutes.get("/:id", async (c) => {
	const id = parseIntParam(c.req.param("id"));
	if (id === null)
		return c.html(
			<Layout title="Not Found - sql-email">
				<p class="text-slate-400">Client not found.</p>
			</Layout>,
			404,
		);
	const client = await db.query.clients.findFirst({
		where: eq(clients.id, id),
		with: { eventClients: { with: { event: true } } },
	});

	if (!client) {
		return c.html(
			<Layout title="Not Found - sql-email">
				<p class="text-slate-400">Client not found.</p>
			</Layout>,
			404,
		);
	}

	return c.html(
		<Layout title={`${client.email} - sql-email`}>
			<div class="flex items-center justify-between mb-6">
				<h1 class="text-2xl font-bold text-white">
					{client.name ?? client.email}
				</h1>
				<a
					href={`/admin/clients/${client.id}/edit`}
					class="bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
				>
					Edit
				</a>
			</div>

			<div class="bg-slate-800 rounded-lg p-6 mb-4">
				<h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
					Details
				</h2>
				<dl class="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2">
					<dt class="text-sm text-slate-500">Email</dt>
					<dd class="text-sm">{client.email}</dd>
					<dt class="text-sm text-slate-500">Name</dt>
					<dd class="text-sm">
						{client.name ?? <span class="text-slate-500 italic">—</span>}
					</dd>
					<dt class="text-sm text-slate-500">Daily Summary</dt>
					<dd class="text-sm">
						{client.wantsDailySummary ? (
							<span class="px-2 py-0.5 rounded text-xs font-semibold bg-green-950 text-green-400">
								Yes
							</span>
						) : (
							<span class="px-2 py-0.5 rounded text-xs font-semibold bg-slate-700 text-slate-400">
								No
							</span>
						)}
					</dd>
					<dt class="text-sm text-slate-500">Joined</dt>
					<dd class="text-sm text-slate-400">
						{new Date(client.createdAt).toISOString()}
					</dd>
				</dl>
			</div>

			<div class="bg-slate-800 rounded-lg p-6 mb-4">
				<h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
					Assigned Events
				</h2>
				{client.eventClients.length === 0 ? (
					<p class="text-slate-500 text-sm">Not assigned to any events.</p>
				) : (
					<table class="w-full border-collapse">
						<thead>
							<tr>
								<th class="text-left text-xs text-slate-500 uppercase tracking-wide px-4 py-2 border-b border-slate-700">
									Event
								</th>
								<th class="text-left text-xs text-slate-500 uppercase tracking-wide px-4 py-2 border-b border-slate-700">
									Date
								</th>
							</tr>
						</thead>
						<tbody>
							{client.eventClients.map((ec) => (
								<tr key={ec.id}>
									<td class="px-4 py-2 border-b border-slate-700 text-sm">
										<a
											href={`/admin/events/${ec.event.id}`}
											class="text-blue-400 hover:text-blue-300 transition-colors"
										>
											{ec.event.title}
										</a>
									</td>
									<td class="px-4 py-2 border-b border-slate-700 text-sm text-slate-400">
										{ec.event.eventDate}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>

			<div class="bg-slate-800 rounded-lg p-6">
				<h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
					Actions
				</h2>
				<form
					method="post"
					action={`/admin/clients/${client.id}/delete`}
					onsubmit="return confirm('Delete this client and all their reminder records?')"
				>
					<button
						type="submit"
						class="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors cursor-pointer"
					>
						Delete Client
					</button>
				</form>
			</div>
		</Layout>,
	);
});

// GET /admin/clients/:id/edit — edit form
adminClientRoutes.get("/:id/edit", async (c) => {
	const id = parseIntParam(c.req.param("id"));
	if (id === null)
		return c.html(
			<Layout title="Not Found - sql-email">
				<p class="text-slate-400">Client not found.</p>
			</Layout>,
			404,
		);
	const client = await db
		.select()
		.from(clients)
		.where(eq(clients.id, id))
		.then((r) => r[0]);

	if (!client) {
		return c.html(
			<Layout title="Not Found - sql-email">
				<p class="text-slate-400">Client not found.</p>
			</Layout>,
			404,
		);
	}

	const error = c.req.query("error");

	return c.html(
		<Layout title={`Edit ${client.email} - sql-email`}>
			<h1 class="text-2xl font-bold text-white mb-6">Edit Client</h1>

			{error && (
				<div class="bg-red-950 border border-red-500 text-red-300 rounded-lg px-4 py-3 mb-6 text-sm">
					{decodeURIComponent(error)}
				</div>
			)}

			<div class="bg-slate-800 rounded-lg p-6">
				<form method="post" action={`/admin/clients/${client.id}/edit`}>
					<div class="mb-4">
						<label for="name" class="block text-sm text-slate-400 mb-1">
							Name (optional)
						</label>
						<input
							type="text"
							id="name"
							name="name"
							value={client.name ?? ""}
							placeholder="Client name"
							class="w-full bg-slate-900 border border-slate-600 rounded-md text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
						/>
					</div>

					<div class="mb-4">
						<label for="email" class="block text-sm text-slate-400 mb-1">
							Email
						</label>
						<input
							type="email"
							id="email"
							name="email"
							required
							value={client.email}
							class="w-full bg-slate-900 border border-slate-600 rounded-md text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
						/>
					</div>

					<div class="flex items-center gap-2 mb-6">
						<input
							type="checkbox"
							id="wantsDailySummary"
							name="wantsDailySummary"
							value="on"
							checked={client.wantsDailySummary}
							class="w-4 h-4"
						/>
						<label for="wantsDailySummary" class="text-sm text-slate-200">
							Receive a daily summary instead of individual reminders
						</label>
					</div>

					<div class="flex gap-3">
						<button
							type="submit"
							class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors cursor-pointer"
						>
							Save Changes
						</button>
						<a
							href={`/admin/clients/${client.id}`}
							class="bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
						>
							Cancel
						</a>
					</div>
				</form>
			</div>
		</Layout>,
	);
});

// POST /admin/clients/:id/edit — handle edit form submission
adminClientRoutes.post("/:id/edit", async (c) => {
	const id = parseIntParam(c.req.param("id"));
	if (id === null) return c.redirect("/admin/clients");
	const form = await c.req.formData();

	const nameRaw = (form.get("name") as string | null)?.trim() || null;
	const email = (form.get("email") as string | null)?.trim() ?? "";
	const wantsDailySummary = form.get("wantsDailySummary") === "on";

	const parsed = updateClientSchema.safeParse({
		name: nameRaw,
		email,
		wantsDailySummary,
	});
	if (!parsed.success) {
		const msg = encodeURIComponent(
			parsed.error.issues.map((i) => i.message).join(", "),
		);
		return c.redirect(`/admin/clients/${id}/edit?error=${msg}`);
	}

	try {
		const [updated] = await db
			.update(clients)
			.set(parsed.data)
			.where(eq(clients.id, id))
			.returning();
		if (!updated) return c.redirect("/admin/clients");
	} catch {
		const msg = encodeURIComponent("That email address is already in use.");
		return c.redirect(`/admin/clients/${id}/edit?error=${msg}`);
	}

	return c.redirect(`/admin/clients/${id}`);
});

// POST /admin/clients/:id/delete — delete client
adminClientRoutes.post("/:id/delete", async (c) => {
	const id = parseIntParam(c.req.param("id"));
	if (id === null) return c.redirect("/admin/clients");
	await db.delete(clients).where(eq(clients.id, id));
	return c.redirect("/admin/clients");
});
