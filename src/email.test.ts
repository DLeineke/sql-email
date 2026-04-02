import { describe, expect, test } from "bun:test";
import { escapeHtml } from "./email";

describe("escapeHtml", () => {
	test("escapes &", () => {
		expect(escapeHtml("a & b")).toBe("a &amp; b");
	});

	test("escapes <", () => {
		expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
	});

	test("escapes >", () => {
		expect(escapeHtml("1 > 0")).toBe("1 &gt; 0");
	});

	test("escapes double quotes", () => {
		expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;");
	});

	test("escapes single quotes", () => {
		expect(escapeHtml("it's")).toBe("it&#39;s");
	});

	test("handles strings with no special chars", () => {
		expect(escapeHtml("hello world")).toBe("hello world");
	});

	test("handles strings with multiple special chars", () => {
		expect(escapeHtml(`<a href="x" onclick='y'>a & b</a>`)).toBe(
			"&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;a &amp; b&lt;/a&gt;",
		);
	});

	test("handles empty string", () => {
		expect(escapeHtml("")).toBe("");
	});
});
