/* format.test.ts — pure display formatting */
import { describe, expect, test } from "bun:test";
import { fmtMB } from "./format";

describe("fmtMB", () => {
  test("formats megabytes with one decimal", () => {
    expect(fmtMB(1048576)).toBe("1.0 MB");
    expect(fmtMB(55574528)).toBe("53.0 MB");
    expect(fmtMB(0)).toBe("0.0 MB");
  });
});
