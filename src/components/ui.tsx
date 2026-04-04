import type { Child, FC } from "hono/jsx";

// ── Card ─────────────────────────────────────────────────

interface CardProps {
	title?: string;
	children: Child;
	class?: string;
}

export const Card: FC<CardProps> = ({ title, children, class: cls }) => (
	<div class={`bg-slate-800 rounded-lg p-6${cls ? ` ${cls}` : ""}`}>
		{title && (
			<h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
				{title}
			</h2>
		)}
		{children}
	</div>
);

// ── Table ────────────────────────────────────────────────

export const Table: FC<{ children: Child }> = ({ children }) => (
	<table class="w-full border-collapse">{children}</table>
);

export const Th: FC<{ children: Child }> = ({ children }) => (
	<th class="text-left text-xs text-slate-500 uppercase tracking-wide px-4 py-2 border-b border-slate-700">
		{children}
	</th>
);

interface TdProps {
	children: Child;
	muted?: boolean;
}

export const Td: FC<TdProps> = ({ children, muted }) => (
	<td
		class={`px-4 py-2 border-b border-slate-700 text-sm${muted ? " text-slate-500" : " text-slate-400"}`}
	>
		{children}
	</td>
);

// A Td without any default text colour — lets the caller control colour.
export const TdPlain: FC<{ children: Child }> = ({ children }) => (
	<td class="px-4 py-2 border-b border-slate-700 text-sm">{children}</td>
);

// ── Badge ────────────────────────────────────────────────

type BadgeVariant = "green" | "yellow" | "red" | "gray" | "blue";

const badgeClasses: Record<BadgeVariant, string> = {
	green: "bg-green-950 text-green-400",
	yellow: "bg-yellow-950 text-yellow-400",
	red: "bg-red-950 text-red-400",
	gray: "bg-slate-700 text-slate-400",
	blue: "bg-blue-950 text-blue-400",
};

interface BadgeProps {
	variant?: BadgeVariant;
	color?: string;
	children: Child;
	class?: string;
}

export const Badge: FC<BadgeProps> = ({
	variant,
	color,
	children,
	class: cls,
}) => {
	if (color) {
		return (
			<span
				class={`px-2 py-0.5 rounded text-xs font-semibold text-white${cls ? ` ${cls}` : ""}`}
				style={`background-color:${color}`}
			>
				{children}
			</span>
		);
	}
	const variantClass = badgeClasses[variant ?? "gray"];
	return (
		<span
			class={`px-2 py-0.5 rounded text-xs font-semibold ${variantClass}${cls ? ` ${cls}` : ""}`}
		>
			{children}
		</span>
	);
};

// ── Button ───────────────────────────────────────────────

type ButtonVariant = "primary" | "danger" | "secondary";

const buttonClasses: Record<ButtonVariant, string> = {
	primary: "bg-blue-600 hover:bg-blue-700 text-white",
	danger: "bg-red-600 hover:bg-red-700 text-white",
	secondary: "bg-slate-700 hover:bg-slate-600 text-white",
};

interface ButtonProps {
	variant?: ButtonVariant;
	type?: "submit" | "button" | "reset";
	children: Child;
	class?: string;
}

export const Button: FC<ButtonProps> = ({
	variant = "primary",
	type = "submit",
	children,
	class: cls,
}) => (
	<button
		type={type}
		class={`${buttonClasses[variant]} text-sm font-medium px-4 py-2 rounded-md transition-colors cursor-pointer${cls ? ` ${cls}` : ""}`}
	>
		{children}
	</button>
);

// ── LinkButton ───────────────────────────────────────────

interface LinkButtonProps {
	href: string;
	variant?: ButtonVariant;
	children: Child;
	class?: string;
}

export const LinkButton: FC<LinkButtonProps> = ({
	href,
	variant = "secondary",
	children,
	class: cls,
}) => (
	<a
		href={href}
		class={`${buttonClasses[variant]} text-sm font-medium px-4 py-2 rounded-md transition-colors${cls ? ` ${cls}` : ""}`}
	>
		{children}
	</a>
);
