/* ordinals.ts — Bengali ordinal words ("প্রথম" → 1) and suffixes. */

import { nz } from "./bengali";

/** Ordinal suffixes: ম / য় (both forms) / র্থ / ষ্ঠ / ষ্ট / শ. */
export const ORD_SFX = "(?:ম|\\u09AF\\u09BC|\\u09DF|র্থ|ষ্ঠ|ষ্ট|শ)";

export const ORD_WORDS_RAW: Record<string, number> = {
  প্রথম: 1,
  দ্বিতীয়: 2,
  তৃতীয়: 3,
  চতুর্থ: 4,
  পঞ্চম: 5,
  ষষ্ঠ: 6,
  সপ্তম: 7,
  অষ্টম: 8,
  নবম: 9,
  দশম: 10,
  একাদশ: 11,
  দ্বাদশ: 12,
  ত্রয়োদশ: 13,
  চতুর্দশ: 14,
  পঞ্চদশ: 15,
  ষোড়শ: 16,
  ষোলতম: 16,
  সপ্তদশ: 17,
  অষ্টাদশ: 18,
  ঊনিশতম: 19,
  বিংশতম: 20,
  বিশতম: 20,
  একবিংশতম: 21,
  একুশতম: 21,
  দ্বাবিংশতম: 22,
  ত্রয়োবিংশতম: 23,
  চতুর্বিংশতম: 24,
  পঞ্চবিংশতম: 25,
  পঁচিশতম: 25,
  ছাব্বিশতম: 26,
  সপ্তবিংশতম: 27,
  অষ্টাবিংশতম: 28,
  ঊনত্রিংশতম: 29,
  ত্রিংশতম: 30,
  ত্রিশতম: 30,
  একত্রিশতম: 31,
  দ্বাত্রিংশতম: 32,
  তেত্রিশতম: 33,
  চৌঁত্রিশতম: 34,
  পঁয়ত্রিশতম: 35,
  ছত্রিশতম: 36,
  সাঁইত্রিশতম: 37,
  আটত্রিশতম: 38,
  ঊনচল্লিশতম: 39,
  চল্লিশতম: 40,
  পঞ্চাশতম: 50,
  ষাটতম: 60,
};

/** Keys normalized so lookups never depend on which য় form a literal uses. */
export const ORD_WORDS: Record<string, number> = Object.fromEntries(
  Object.entries(ORD_WORDS_RAW).map(([k, v]) => [nz(k), v]),
);
