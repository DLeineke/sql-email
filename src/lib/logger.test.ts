import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { logger } from "./logger";

describe("logger", () => {
	let logSpy: ReturnType<typeof spyOn>;
	let warnSpy: ReturnType<typeof spyOn>;
	let errorSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		logSpy = spyOn(console, "log").mockImplementation(() => {});
		warnSpy = spyOn(console, "warn").mockImplementation(() => {});
		errorSpy = spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		logSpy.mockRestore();
		warnSpy.mockRestore();
		errorSpy.mockRestore();
	});

	test("logger.info() calls console.log with [INFO]", () => {
		logger.info("test info");
		expect(logSpy).toHaveBeenCalledTimes(1);
		expect(logSpy.mock.calls[0][0]).toContain("[INFO]");
		expect(logSpy.mock.calls[0][0]).toContain("test info");
	});

	test("logger.error() calls console.error with [ERROR]", () => {
		logger.error("test error");
		expect(errorSpy).toHaveBeenCalledTimes(1);
		expect(errorSpy.mock.calls[0][0]).toContain("[ERROR]");
	});

	test("logger.warn() calls console.warn with [WARN]", () => {
		logger.warn("test warn");
		expect(warnSpy).toHaveBeenCalledTimes(1);
		expect(warnSpy.mock.calls[0][0]).toContain("[WARN]");
	});
});
