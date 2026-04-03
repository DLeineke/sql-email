import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { Layout } from "../components/Layout";
import {
	Badge,
	Button,
	Card,
	LinkButton,
	Table,
	Td,
	TdPlain,
	Th,
} from "../components/ui";
import { db } from "../db";
import { categories, insertCategorySchema } from "../db/schema";
import { parseIntParam } from "../lib/params";

export const adminCategoryRoutes = new Hono();

// GET /admin/categories — list all categories
adminCategoryRoutes.get("/", async (c) => {
	const currentUser = c.get("user") as { role: string };
	const isAdmin = currentUser.role === "admin";
	const rows = await db.select().from(categories).orderBy(categories.name);

	return c.html(
		<Layout title="Categories - sql-email" userRole={currentUser.role}>
			<div class="flex items-center justify-between mb-6">
				<h1 class="text-2xl font-bold text-white">Categories</h1>
				{isAdmin && (
					<LinkButton href="/admin/categories/new" variant="primary">
						New Category
					</LinkButton>
				)}
			</div>

			<Card title="All Categories">
				{rows.length === 0 ? (
					<p class="text-slate-500 text-sm">No categories yet.</p>
				) : (
					<Table>
						<thead>
							<tr>
								<Th>Name</Th>
								<Th>Color</Th>
								<Th>Created</Th>
								{isAdmin && <th class="px-4 py-2 border-b border-slate-700" />}
							</tr>
						</thead>
						<tbody>
							{rows.map((cat) => (
								<tr key={cat.id}>
									<TdPlain>
										<Badge color={cat.color}>{cat.name}</Badge>
									</TdPlain>
									<Td>{cat.color}</Td>
									<Td>{new Date(cat.createdAt).toISOString().slice(0, 10)}</Td>
									{isAdmin && (
										<td class="px-4 py-2 border-b border-slate-700 text-sm text-right">
											<a
												href={`/admin/categories/${cat.id}/edit`}
												class="text-slate-400 hover:text-white transition-colors mr-4"
											>
												Edit
											</a>
											<form
												method="post"
												action={`/admin/categories/${cat.id}/delete`}
												class="inline"
												onsubmit="return confirm('Delete this category? Events using it will become uncategorized.')"
											>
												<button
													type="submit"
													class="text-red-400 hover:text-red-300 transition-colors cursor-pointer bg-transparent border-none p-0"
												>
													Delete
												</button>
											</form>
										</td>
									)}
								</tr>
							))}
						</tbody>
					</Table>
				)}
			</Card>
		</Layout>,
	);
});

// GET /admin/categories/new — create form
adminCategoryRoutes.get("/new", (c) => {
	const currentUser = c.get("user") as { role: string };
	const error = c.req.query("error");

	return c.html(
		<Layout title="New Category - sql-email" userRole={currentUser.role}>
			<h1 class="text-2xl font-bold text-white mb-6">New Category</h1>

			{error && (
				<div class="bg-red-950 border border-red-500 text-red-300 rounded-lg px-4 py-3 mb-6 text-sm">
					{decodeURIComponent(error)}
				</div>
			)}

			<Card>
				<form
					method="post"
					action="/admin/categories"
					class="space-y-4 max-w-sm"
				>
					<CategoryFormFields />
					<div class="flex gap-3">
						<Button>Create Category</Button>
						<LinkButton href="/admin/categories">Cancel</LinkButton>
					</div>
				</form>
			</Card>
		</Layout>,
	);
});

// POST /admin/categories — handle create
adminCategoryRoutes.post("/", async (c) => {
	const currentUser = c.get("user") as { role: string };
	if (currentUser.role !== "admin") return c.html("Forbidden", 403);
	const form = await c.req.formData();
	const name = (form.get("name") as string | null)?.trim() ?? "";
	const color = (form.get("color") as string | null)?.trim() ?? "#3b82f6";

	const parsed = insertCategorySchema.safeParse({ name, color });
	if (!parsed.success) {
		const msg = encodeURIComponent(
			parsed.error.issues.map((i) => i.message).join(", "),
		);
		return c.redirect(`/admin/categories/new?error=${msg}`);
	}

	try {
		await db.insert(categories).values(parsed.data);
	} catch {
		const msg = encodeURIComponent("That category name is already in use.");
		return c.redirect(`/admin/categories/new?error=${msg}`);
	}

	return c.redirect("/admin/categories");
});

// GET /admin/categories/:id/edit — edit form
adminCategoryRoutes.get("/:id/edit", async (c) => {
	const currentUser = c.get("user") as { role: string };
	const id = parseIntParam(c.req.param("id"));
	if (id === null) return c.redirect("/admin/categories");

	const cat = await db
		.select()
		.from(categories)
		.where(eq(categories.id, id))
		.then((r) => r[0]);
	if (!cat) return c.redirect("/admin/categories");

	const error = c.req.query("error");

	return c.html(
		<Layout title={`Edit ${cat.name} - sql-email`} userRole={currentUser.role}>
			<h1 class="text-2xl font-bold text-white mb-6">Edit Category</h1>

			{error && (
				<div class="bg-red-950 border border-red-500 text-red-300 rounded-lg px-4 py-3 mb-6 text-sm">
					{decodeURIComponent(error)}
				</div>
			)}

			<Card>
				<form
					method="post"
					action={`/admin/categories/${cat.id}/edit`}
					class="space-y-4 max-w-sm"
				>
					<CategoryFormFields defaults={{ name: cat.name, color: cat.color }} />
					<div class="flex gap-3">
						<Button>Save Changes</Button>
						<LinkButton href="/admin/categories">Cancel</LinkButton>
					</div>
				</form>
			</Card>
		</Layout>,
	);
});

// POST /admin/categories/:id/edit — handle edit
adminCategoryRoutes.post("/:id/edit", async (c) => {
	const currentUser = c.get("user") as { role: string };
	if (currentUser.role !== "admin") return c.html("Forbidden", 403);
	const id = parseIntParam(c.req.param("id"));
	if (id === null) return c.redirect("/admin/categories");

	const form = await c.req.formData();
	const name = (form.get("name") as string | null)?.trim() ?? "";
	const color = (form.get("color") as string | null)?.trim() ?? "#3b82f6";

	const parsed = insertCategorySchema.safeParse({ name, color });
	if (!parsed.success) {
		const msg = encodeURIComponent(
			parsed.error.issues.map((i) => i.message).join(", "),
		);
		return c.redirect(`/admin/categories/${id}/edit?error=${msg}`);
	}

	try {
		const [updated] = await db
			.update(categories)
			.set({ name: parsed.data.name, color: parsed.data.color })
			.where(eq(categories.id, id))
			.returning();
		if (!updated) return c.redirect("/admin/categories");
	} catch {
		const msg = encodeURIComponent("That category name is already in use.");
		return c.redirect(`/admin/categories/${id}/edit?error=${msg}`);
	}

	return c.redirect("/admin/categories");
});

// POST /admin/categories/:id/delete — delete category
adminCategoryRoutes.post("/:id/delete", async (c) => {
	const currentUser = c.get("user") as { role: string };
	if (currentUser.role !== "admin") return c.html("Forbidden", 403);
	const id = parseIntParam(c.req.param("id"));
	if (id === null) return c.redirect("/admin/categories");
	await db.delete(categories).where(eq(categories.id, id));
	return c.redirect("/admin/categories");
});

// ── Shared form fields ───────────────────────────────────

function CategoryFormFields({
	defaults,
}: {
	defaults?: { name: string; color: string };
}) {
	return (
		<>
			<div>
				<label for="name" class="block text-sm text-slate-400 mb-1">
					Name
				</label>
				<input
					type="text"
					id="name"
					name="name"
					required
					value={defaults?.name ?? ""}
					placeholder="e.g. Anniversary"
					class="w-full bg-slate-900 border border-slate-600 rounded-md text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
				/>
			</div>
			<div>
				<label for="colorPicker" class="block text-sm text-slate-400 mb-1">
					Color
				</label>
				<div class="flex items-center gap-3">
					<input
						type="color"
						id="colorPicker"
						value={defaults?.color ?? "#3b82f6"}
						class="w-10 h-10 rounded cursor-pointer border border-slate-600 bg-slate-900 p-0.5"
						oninput="document.getElementById('colorText').value=this.value"
					/>
					<input
						type="text"
						id="colorText"
						name="color"
						value={defaults?.color ?? "#3b82f6"}
						placeholder="#3b82f6"
						class="w-28 bg-slate-900 border border-slate-600 rounded-md text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
						oninput="if(/^#[0-9a-fA-F]{6}$/.test(this.value))document.getElementById('colorPicker').value=this.value"
					/>
				</div>
				<p class="text-xs text-slate-500 mt-1">Hex color, e.g. #3b82f6</p>
			</div>
		</>
	);
}
