/* streams.ts — SSC academic-stream classification of subject names
   (বিজ্ঞান counts as Business per the SSC curriculum grouping). */

import { nz } from "./bengali";

/* ── Academic streams ───────────────────────────────────────────────────
   The General branch mixes compulsory subjects with the three SSC streams.
   Grouping follows the user's mapping (বিজ্ঞান = Business per the SSC
   curriculum, where general science belongs to the non-science groups). */
export type Stream =
  "compulsory" | "science" | "business" | "humanities" | "religion" | "extra";

/* every y-like char in a stream pattern accepts all three data forms
   (precomposed য়, decomposed য+়, bare য — uploaders mix them, e.g.
   ব্যবসায়/উদ্যোগ vs গার্হস্থ্য) and whitespace runs are tolerated */
const ANY_Y = "(?:\u09df|\u09af\u09bc|\u09af)";
function streamPat(src: string): RegExp {
  const body = nz(src)
    .replace(/[\u09df\u09af]/g, ANY_Y)
    .replace(/\s+/g, "\\s+");
  return new RegExp("^" + body);
}

const STREAM_MATCHERS: [Stream, RegExp][] = (
  [
    [
      "science",
      "^(পদার্থবিজ্ঞান|রসায়ন|জীববিজ্ঞান|উচ্চতর গণিত|Physics|Chemistry|Biology|Higher Math)",
    ],
    [
      "business",
      "^(হিসাববিজ্ঞান|ব্যবসায় উদ্যোগ|ফিন্যান্স|বিজ্ঞান|Finance|Accounting|Entrepreneurship)",
    ],
    [
      "humanities",
      "^(অর্থনীতি|বাংলাদেশের ইতিহাস|বাংলাদেশ ও বিশ্বপরিচয়|ভূগোল|পৌরনীতি|Economics|Geography|History|Civics)",
    ],
    ["religion", "^(ইসলাম|হিন্দু|বৌদ্ধ|খ্রিস্ট|ধর্ম|Islam|Hindu|Buddh|Christ)"],
    ["extra", "^(গার্হস্থ্যবিজ্ঞান|কৃষিশিক্ষা|Home Science|Agriculture)"],
  ] as [Stream, string][]
).map(([st, src]) => [st, streamPat(src)]);

export function streamOf(bookName: string): Stream {
  const n = nz(bookName.trim());
  for (const [stream, re] of STREAM_MATCHERS) if (re.test(n)) return stream;
  return "compulsory";
}

export const STREAM_LABEL: Record<Stream, string> = {
  compulsory: "Compulsory",
  science: "Science",
  business: "Business Studies",
  humanities: "Humanities",
  religion: "Religion",
  extra: "Extra",
};
