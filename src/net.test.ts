/* net.test.ts — pdfFetchUrl proxy rewriting (pure logic, no network).
   The proxy prefix is a build constant (config.PDF_PROXY_PREFIX); tests mock
   the constants module so both the default and a custom port target work. */
import { describe, expect, test } from "bun:test";
import { pdfFetchUrl } from "./net";

const PDF = "https://pdf.tetashweb.xyz/pdfr2files/files/some/chapter.pdf";

describe("pdfFetchUrl (web — NATIVE is false under bun test)", () => {
  test("rewrites to the same-origin proxy path", () => {
    expect(pdfFetchUrl(PDF)).toBe("/pdf/pdfr2files/files/some/chapter.pdf");
  });

  test("non-http(s) values pass through untouched", () => {
    expect(pdfFetchUrl("blob:whatever")).toBe("blob:whatever");
  });

  test("keeps the query string when present", () => {
    expect(pdfFetchUrl(PDF + "?x=1")).toBe(
      "/pdf/pdfr2files/files/some/chapter.pdf?x=1",
    );
  });
});
