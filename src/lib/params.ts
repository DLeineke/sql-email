/**
 * Parse a route param as a positive integer.
 * Returns the integer on success, or null if the param is missing,
 * non-numeric, not an integer, or not positive (≥ 1).
 */
export function parseIntParam(raw: string | undefined): number | null {
	const n = Number(raw);
	if (!Number.isInteger(n) || n < 1) return null;
	return n;
}
