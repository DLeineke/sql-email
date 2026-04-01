import type { Child, FC } from "hono/jsx";

interface LayoutProps {
	title: string;
	children: Child;
}

export const Layout: FC<LayoutProps> = ({ title, children }) => {
	return (
		<html lang="en">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>{title}</title>
				<link rel="stylesheet" href="/styles.css" />
			</head>
			<body class="bg-slate-900 text-slate-200 min-h-screen">
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
							href="/admin/reminders"
							class="text-slate-400 hover:text-white transition-colors"
						>
							Reminders
						</a>
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
			</body>
		</html>
	);
};
