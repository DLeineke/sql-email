import type { Child, FC } from "hono/jsx";

interface PublicLayoutProps {
	title: string;
	children: Child;
	bodyClass?: string;
}

export const PublicLayout: FC<PublicLayoutProps> = ({
	title,
	children,
	bodyClass = "bg-slate-900 text-slate-200 min-h-screen flex items-center justify-center",
}) => (
	<html lang="en">
		<head>
			<meta charset="UTF-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1.0" />
			<title>{title}</title>
			<link rel="stylesheet" href="/styles.css" />
		</head>
		<body class={bodyClass}>{children}</body>
	</html>
);
