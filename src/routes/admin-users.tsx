import { desc, eq } from "drizzle-orm";
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
import { users } from "../db/schema";
import { parseIntParam } from "../lib/params";

export const adminUserRoutes = new Hono();

adminUserRoutes.get("/", async (c) => {
	const currentUser = c.get("user") as { id: number; username: string };
	const error = c.req.query("error");
	const rows = await db.select().from(users).orderBy(desc(users.createdAt));

	return c.html(
		<Layout title="Users - sql-email">
			<div class="flex items-center justify-between mb-6">
				<h1 class="text-2xl font-bold text-white">Users</h1>
				<LinkButton href="/admin/users/new" variant="primary">
					New User
				</LinkButton>
			</div>

			{error === "self" && (
				<div class="mb-4 text-sm text-red-400 bg-red-950 rounded px-4 py-3">
					You cannot delete your own account.
				</div>
			)}

			<Card title="Admin Users">
				{rows.length === 0 ? (
					<p class="text-slate-500 text-sm">No users.</p>
				) : (
					<Table>
						<thead>
							<tr>
								<Th>Username</Th>
								<Th>Created</Th>
								<th class="px-4 py-2 border-b border-slate-700" />
							</tr>
						</thead>
						<tbody>
							{rows.map((u) => (
								<tr key={u.id}>
									<TdPlain>
										<span class="text-slate-200">{u.username}</span>
										{u.id === currentUser.id && (
											<Badge variant="gray" class="ml-2">
												you
											</Badge>
										)}
									</TdPlain>
									<Td>{new Date(u.createdAt).toISOString().slice(0, 10)}</Td>
									<td class="px-4 py-2 border-b border-slate-700 text-sm text-right">
										{u.id !== currentUser.id ? (
											<form
												method="post"
												action={`/admin/users/${u.id}/delete`}
												class="inline"
												onsubmit={`return confirm('Delete user ${u.username}?')`}
											>
												<Button variant="danger" type="submit">
													Delete
												</Button>
											</form>
										) : (
											<span class="text-slate-600 text-xs">
												cannot delete self
											</span>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</Table>
				)}
			</Card>
		</Layout>,
	);
});

interface NewUserFormProps {
	errors?: string[];
	usernameValue?: string;
}

const NewUserForm = ({ errors, usernameValue = "" }: NewUserFormProps) => (
	<Layout title="New User - sql-email">
		<div class="flex items-center justify-between mb-6">
			<h1 class="text-2xl font-bold text-white">New User</h1>
			<LinkButton href="/admin/users" variant="secondary">
				Cancel
			</LinkButton>
		</div>

		<Card title="Create Admin User">
			{errors && errors.length > 0 && (
				<div class="mb-4 text-sm text-red-400 bg-red-950 rounded px-4 py-3">
					{errors.map((e) => (
						<div key={e}>{e}</div>
					))}
				</div>
			)}
			<form method="post" action="/admin/users" class="space-y-4 max-w-sm">
				<div>
					<label
						for="username"
						class="block text-xs text-slate-400 uppercase tracking-wide mb-1"
					>
						Username
					</label>
					<input
						id="username"
						name="username"
						type="text"
						required
						value={usernameValue}
						class="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
					/>
				</div>
				<div>
					<label
						for="password"
						class="block text-xs text-slate-400 uppercase tracking-wide mb-1"
					>
						Password
					</label>
					<input
						id="password"
						name="password"
						type="password"
						required
						class="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
					/>
				</div>
				<Button type="submit">Create User</Button>
			</form>
		</Card>
	</Layout>
);

adminUserRoutes.get("/new", (c) => c.html(<NewUserForm />));

adminUserRoutes.post("/", async (c) => {
	const body = await c.req.parseBody();
	const username = String(body.username ?? "").trim();
	const password = String(body.password ?? "");

	const errors: string[] = [];
	if (!username) errors.push("Username is required.");
	if (password.length < 8)
		errors.push("Password must be at least 8 characters.");

	if (errors.length > 0) {
		return c.html(
			<NewUserForm errors={errors} usernameValue={username} />,
			400,
		);
	}

	const passwordHash = await Bun.password.hash(password);

	try {
		await db.insert(users).values({ username, passwordHash });
	} catch {
		return c.html(
			<NewUserForm
				errors={["That username is already taken."]}
				usernameValue={username}
			/>,
			409,
		);
	}

	return c.redirect("/admin/users");
});

adminUserRoutes.post("/:id/delete", async (c) => {
	const currentUser = c.get("user") as { id: number; username: string };
	const id = parseIntParam(c.req.param("id"));
	if (id === null) return c.redirect("/admin/users");

	if (id === currentUser.id) {
		return c.redirect("/admin/users?error=self");
	}

	await db.delete(users).where(eq(users.id, id));
	return c.redirect("/admin/users");
});
