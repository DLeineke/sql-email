/**
 * Seed an admin user.
 * Usage: bun run src/seed-admin.ts
 */
import { db } from "./db";
import { users } from "./db/schema";
import { logger } from "./lib/logger";

const username = prompt("Username:")?.trim();
const password = prompt("Password:")?.trim();

if (!username || !password) {
	logger.error("Both username and password are required.");
	process.exit(1);
}

const passwordHash = await Bun.password.hash(password);

await db
	.insert(users)
	.values({ username, passwordHash, role: "admin" })
	.onConflictDoUpdate({
		target: users.username,
		set: { passwordHash },
	});

logger.info(`Admin user "${username}" seeded.`);
process.exit(0);
