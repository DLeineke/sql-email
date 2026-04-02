import { describe, expect, test } from "bun:test";
import { parseIntParam } from "./params";

describe("parseIntParam", () => {
	test("returns the number for valid positive integers", () => {
		expect(parseIntParam("1")).toBe(1);
		expect(parseIntParam("42")).toBe(42);
		expect(parseIntParam("100")).toBe(100);
	});

	test("returns null for non-numeric strings", () => {
		expect(parseIntParam("abc")).toBeNull();
		expect(parseIntParam("")).toBeNull();
		expect(parseIntParam("1abc")).toBeNull();
	});

	test("returns null for undefined", () => {
		expect(parseIntParam(undefined)).toBeNull();
	});

	test("returns null for non-integers", () => {
		expect(parseIntParam("1.5")).toBeNull();
		expect(parseIntParam("2.7")).toBeNull();
	});

	test("returns null for non-positive values", () => {
		expect(parseIntParam("0")).toBeNull();
		expect(parseIntParam("-1")).toBeNull();
		expect(parseIntParam("-5")).toBeNull();
	});
});
