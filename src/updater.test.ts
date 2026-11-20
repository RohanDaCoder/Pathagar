/* updater.test.ts — semver parsing/comparison behind the in-app updater */
import { describe, expect, test } from "bun:test";
import { parseSemver, isNewer } from "./updater";

describe("parseSemver", () => {
  test("parses plain versions", () => {
    expect(parseSemver("1.2.3")).toEqual([1, 2, 3]);
    expect(parseSemver("0.0.1")).toEqual([0, 0, 1]);
  });
  test("strips a leading v", () => {
    expect(parseSemver("v10.20.30")).toEqual([10, 20, 30]);
  });
  test("ignores anything past the third component", () => {
    expect(parseSemver("1.2.3-beta.1")).toEqual([1, 2, 3]);
  });
  test("returns null for garbage", () => {
    expect(parseSemver("latest")).toBeNull();
    expect(parseSemver("")).toBeNull();
    expect(parseSemver(null)).toBeNull();
  });
});

describe("isNewer", () => {
  test("patch/minor/major bumps are newer", () => {
    expect(isNewer("1.0.0", "1.0.1")).toBe(true);
    expect(isNewer("1.0.0", "1.1.0")).toBe(true);
    expect(isNewer("1.0.0", "2.0.0")).toBe(true);
  });
  test("downgrades and equals are not newer", () => {
    expect(isNewer("1.0.1", "1.0.0")).toBe(false);
    expect(isNewer("1.0.0", "1.0.0")).toBe(false);
    expect(isNewer("2.5.0", "1.9.9")).toBe(false);
  });
  test("unparseable candidates are never newer", () => {
    expect(isNewer("1.0.0", "banana")).toBe(false);
    expect(isNewer("banana", "9.9.9")).toBe(false);
  });
  test("numeric compare, not string compare", () => {
    expect(isNewer("1.9.0", "1.10.0")).toBe(true); // 10 > 9 numerically
    expect(isNewer("1.10.0", "1.9.0")).toBe(false);
  });
});
