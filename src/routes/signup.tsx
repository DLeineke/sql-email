import { Hono } from "hono";
import { db } from "../db";
import { clients, insertClientSchema } from "../db/schema";

export const signupRoutes = new Hono();

// Minimal layout without the admin nav bar
const SignupLayout = ({
	title,
	children,
}: {
	title: string;
	children: unknown;
}) => (
	<html lang="en">
		<head>
			<meta charset="UTF-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1.0" />
			<title>{title}</title>
			<script src="https://cdn.tailwindcss.com"></script>
		</head>
		<body class="bg-slate-900 text-slate-200 min-h-screen flex items-start justify-center pt-16 px-4">
			<div class="w-full max-w-md">{children}</div>
		</body>
	</html>
);

interface FormProps {
	nameValue?: string;
	emailValue?: string;
	summaryChecked?: boolean;
	errors?: string[];
}

const SignupForm = ({
	nameValue = "",
	emailValue = "",
	summaryChecked = false,
	errors,
}: FormProps) => (
	<SignupLayout title="Sign Up - sql-email">
		<h1 class="text-2xl font-bold text-white mb-1">Sign Up for Reminders</h1>
		<p class="text-slate-500 text-sm mb-6">
			Subscribe to receive calendar event reminders by email.
		</p>

		{errors && errors.length > 0 && (
			<div class="bg-red-950 border border-red-500 text-red-300 rounded-lg px-4 py-3 mb-6 text-sm">
				<strong class="block mb-1">Please fix the following:</strong>
				<ul class="list-disc list-inside space-y-0.5">
					{errors.map((m) => (
						<li key={m}>{m}</li>
					))}
				</ul>
			</div>
		)}

		<div class="bg-slate-800 rounded-lg p-6">
			<form method="post" action="/signup">
				<div class="mb-4">
					<label for="name" class="block text-sm text-slate-400 mb-1">
						Name (optional)
					</label>
					<input
						type="text"
						id="name"
						name="name"
						value={nameValue}
						placeholder="Your name"
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
						value={emailValue}
						placeholder="you@example.com"
						class="w-full bg-slate-900 border border-slate-600 rounded-md text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
					/>
				</div>

				<div class="flex items-center gap-2 mb-6">
					<input
						type="checkbox"
						id="wantsDailySummary"
						name="wantsDailySummary"
						value="on"
						checked={summaryChecked}
						class="w-4 h-4"
					/>
					<label for="wantsDailySummary" class="text-sm text-slate-200">
						Receive a daily summary instead of individual reminders
					</label>
				</div>

				<button
					type="submit"
					class="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-md transition-colors cursor-pointer"
				>
					Sign Up
				</button>
			</form>
		</div>
	</SignupLayout>
);

// GET /signup — signup form
signupRoutes.get("/", (c) => {
	return c.html(<SignupForm />);
});

// POST /signup — handle form submission
signupRoutes.post("/", async (c) => {
	const form = await c.req.formData();

	const nameRaw = (form.get("name") as string | null)?.trim() || undefined;
	const email = (form.get("email") as string | null)?.trim() ?? "";
	const wantsDailySummary = form.get("wantsDailySummary") === "on";

	const parsed = insertClientSchema.safeParse({
		name: nameRaw,
		email,
		wantsDailySummary,
	});

	if (!parsed.success) {
		const errors = parsed.error.issues.map((i) => i.message);
		return c.html(
			<SignupForm
				nameValue={nameRaw ?? ""}
				emailValue={email}
				summaryChecked={wantsDailySummary}
				errors={errors}
			/>,
			400,
		);
	}

	try {
		const unsubscribeToken = crypto.randomUUID();
		await db.insert(clients).values({ ...parsed.data, unsubscribeToken });
	} catch {
		return c.html(
			<SignupForm
				nameValue={nameRaw ?? ""}
				emailValue={email}
				summaryChecked={wantsDailySummary}
				errors={["That email address is already registered."]}
			/>,
			409,
		);
	}

	return c.html(
		<SignupLayout title="Signed Up - sql-email">
			<div class="bg-slate-800 rounded-lg p-8 text-center">
				<div class="text-5xl mb-4">&#10003;</div>
				<h2 class="text-xl font-bold text-green-400 mb-2">You're signed up!</h2>
				<p class="text-slate-400 text-sm">
					We'll send reminders to{" "}
					<strong class="text-slate-200">{email}</strong>.
				</p>
			</div>
		</SignupLayout>,
	);
});
