type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

const currentLevel: LogLevel =
	(process.env.LOG_LEVEL as LogLevel | undefined) ?? "info";

function shouldLog(level: LogLevel): boolean {
	return LEVELS[level] >= LEVELS[currentLevel];
}

function formatMessage(level: LogLevel, message: string): string {
	return `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`;
}

function log(level: LogLevel, message: string, ...args: unknown[]): void {
	if (!shouldLog(level)) return;
	const formatted = formatMessage(level, message);
	if (level === "error") {
		console.error(formatted, ...args);
	} else if (level === "warn") {
		console.warn(formatted, ...args);
	} else {
		console.log(formatted, ...args);
	}
}

export const logger = {
	debug: (message: string, ...args: unknown[]) =>
		log("debug", message, ...args),
	info: (message: string, ...args: unknown[]) => log("info", message, ...args),
	warn: (message: string, ...args: unknown[]) => log("warn", message, ...args),
	error: (message: string, ...args: unknown[]) =>
		log("error", message, ...args),
};
