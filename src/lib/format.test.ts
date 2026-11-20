/* format.test.ts — pure display formatting */
import { describe, expect, test } from "bun:test";
import { bn, fmtMB } from "./format";

describe("bn", () => {
  test("passes values through unchanged (English UI)", () => {
    expect(bn(42)).toBe("42");
    expect(bn("1.10.0")).toBe("1.10.0");
  });
});

describe("fmtMB", () => {
  test("formats megabytes with one decimal", () => {
    expect(fmtMB(1048576)).toBe("1.0 MB");
    expect(fmtMB(55574528)).toBe("53.0 MB");
    expect(fmtMB(0)).toBe("0.0 MB");
  });
});
