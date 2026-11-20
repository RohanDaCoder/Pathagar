/* net.test.ts — pdfFetchUrl proxy rewriting (pure logic, no network) */
import { describe, expect, test, beforeEach } from "bun:test";
import { pdfFetchUrl } from "./net";
import { S, DEFAULT_SETTINGS } from "./config";

const PDF = "https://pdf.tetashweb.xyz/pdfr2files/files/some/chapter.pdf";

describe("pdfFetchUrl", () => {
  beforeEach(() => {
    S.settings = {
      ...DEFAULT_SETTINGS,
      proxyEnabled: true,
      proxyPrefix: "/pdf/",
    };
  });

  test("rewrites to the same-origin proxy path on web", () => {
    // NATIVE is false under `bun test`, so the web branch applies
    expect(pdfFetchUrl(PDF)).toBe("/pdf/pdfr2files/files/some/chapter.pdf");
  });

  test("normalizes a prefix without a trailing slash", () => {
    S.settings.proxyPrefix = "/proxy";
    expect(pdfFetchUrl(PDF)).toBe("/proxy/pdfr2files/files/some/chapter.pdf");
  });

  test("keeps the direct URL when the proxy is disabled", () => {
    S.settings.proxyEnabled = false;
    expect(pdfFetchUrl(PDF)).toBe(PDF);
  });

  test("non-http(s) values pass through untouched", () => {
    expect(pdfFetchUrl("blob:whatever")).toBe("blob:whatever");
  });
});
