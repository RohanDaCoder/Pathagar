/* utils.test.ts — pure string/number helpers */
import { describe, expect, test } from "bun:test";
import { bn, esc, fmtMB } from "./utils";

describe("esc", () => {
  test("escapes HTML-significant characters", () => {
    expect(esc("<script>\"a\"&'b'</script>")).toBe(
      "&lt;script&gt;&quot;a&quot;&amp;&#39;b&#39;&lt;/script&gt;",
    );
  });
  test("passes plain text through", () => {
    expect(esc("বাংলা ১ম পত্র গাইড")).toBe("বাংলা ১ম পত্র গাইড");
  });
  test("null/undefined become empty strings", () => {
    expect(esc(null)).toBe("");
    expect(esc(undefined)).toBe("");
  });
});

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
