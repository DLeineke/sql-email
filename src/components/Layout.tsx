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
				<script src="https://cdn.tailwindcss.com"></script>
			</head>
			<body class="bg-slate-900 text-slate-200 min-h-screen">
				<div class="max-w-5xl mx-auto px-6 py-8">
					<nav class="flex gap-6 mb-8 text-sm">
						<a
							href="/admin"
							class="text-slate-400 hover:text-white transition-colors"
						>
							Admin
						</a>
						<a
							href="/admin/events"
							class="text-slate-400 hover:text-white transition-colors"
						>
							Events
						</a>
						<a
							href="/admin/maintenance"
							class="text-slate-400 hover:text-white transition-colors"
						>
							Maintenance
						</a>
					</nav>
					{children}
				</div>
			</body>
		</html>
	);
};
