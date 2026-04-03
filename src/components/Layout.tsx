import type { Child, FC } from "hono/jsx";
import { PublicLayout } from "./PublicLayout";

interface LayoutProps {
	title: string;
	children: Child;
	userRole?: string;
}

export const Layout: FC<LayoutProps> = ({ title, children, userRole }) => (
	<PublicLayout
		title={title}
		bodyClass="bg-slate-900 text-slate-200 min-h-screen"
	>
		<div class="max-w-5xl mx-auto px-6 py-8">
			<nav class="flex gap-6 mb-8 text-sm items-center">
				<a
					href="/admin"
					class="text-slate-400 hover:text-white transition-colors"
				>
					Admin
				</a>
				<a
					href="/admin/clients"
					class="text-slate-400 hover:text-white transition-colors"
				>
					Clients
				</a>
				<a
					href="/admin/events"
					class="text-slate-400 hover:text-white transition-colors"
				>
					Events
				</a>
				<a
					href="/admin/categories"
					class="text-slate-400 hover:text-white transition-colors"
				>
					Categories
				</a>
				<a
					href="/admin/reminders"
					class="text-slate-400 hover:text-white transition-colors"
				>
					Reminders
				</a>
				{userRole === "admin" && (
					<a
						href="/admin/users"
						class="text-slate-400 hover:text-white transition-colors"
					>
						Users
					</a>
				)}
				<a
					href="/admin/maintenance"
					class="text-slate-400 hover:text-white transition-colors"
				>
					Maintenance
				</a>
				<span class="flex-1" />
				<form method="post" action="/auth/logout">
					<button
						type="submit"
						class="text-slate-400 hover:text-white transition-colors cursor-pointer bg-transparent border-none p-0"
					>
						Sign out
					</button>
				</form>
			</nav>
			{children}
		</div>
	</PublicLayout>
);
