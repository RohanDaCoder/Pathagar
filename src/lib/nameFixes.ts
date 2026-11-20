/* nameFixes.ts — SSOT for upload-side book-name fixes, applied on every data
   path (API results, localStorage cache, snapshot regeneration). Build য় in
   values with the \u09df escape — hand-typed য় is Unicode-form unreliable. */

export const NAME_FIXES: Readonly<Record<string, string>> = {
  "বাংলা 2nd পত্র গাইড (SSC 2028)": "বাংলা ২\u09df পত্র গাইড (SSC 2028)",
};
