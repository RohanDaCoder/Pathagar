/* bengali.ts — Bengali digit + Unicode-form helpers (precomposed য় is canonical). */

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

/** Bengali digits → ASCII. */
export function bnNum(s: string): string {
  return s.replace(/[০-৯]/g, (c) => String(BN_DIGITS.indexOf(c)));
}

/** ASCII digits → Bengali. */
export function toBn(n: number | string): string {
  return String(n).replace(/[0-9]/g, (c) => BN_DIGITS[Number(c)]);
}

/** Normalize decomposed য+় → precomposed য় (U+09DF). Apply before matching. */
export const nz = (s: string): string => s.replace(/\u09AF\u09BC/g, "\u09DF");
