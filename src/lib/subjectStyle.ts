/* lib/subjectStyle.ts — per-subject accent-strip colors on subject cards.
   The palette is user-specified (SSC 2028 catalog, 2026-11); keys are
   parseBookName core names so MCQ/CQ twins share one color. Subjects
   without an entry (ইংরেজি ২য় পত্র, বাংলাদেশের ইতিহাস, the Madrasah
   guides) keep their stream strip from STREAM_STYLE. */

import { nz } from "./titles/bengali";

/* raw literals may carry either য় form (editors mix precomposed and
   decomposed the same way uploaders do — see streams.ts), so keys are
   normalized to precomposed once at load and lookups run through nz() */
const RAW: Record<string, string> = {
  /* ── Bangla Version ───────────────────────────────────────────────── */
  "বাংলা ১ম পত্র": "bg-[#aa7b52]",
  "বাংলা সহপাঠ": "bg-[#e2eff7]",
  "বাংলা ২য় পত্র": "bg-[#68715a]",
  "ইংরেজি ১ম পত্র": "bg-[#7d3e60]",
  গণিত: "bg-[#9ac3cb]",
  "তথ্য ও যোগাযোগ প্রযুক্তি": "bg-[#3f4e8c]",
  বিজ্ঞান: "bg-[#ecc6d1]", // general science → commerce-group subject
  পদার্থবিজ্ঞান: "bg-[#a4c5ec]",
  রসায়ন: "bg-[#b898c4]",
  জীববিজ্ঞান: "bg-[#bdd779]",
  "উচ্চতর গণিত": "bg-[#e4bc73]",
  "ভূগোল ও পরিবেশ": "bg-[#7e82ba]",
  অর্থনীতি: "bg-[#786959]",
  কৃষিশিক্ষা: "bg-[#8e9aa9]",
  গার্হস্থ্যবিজ্ঞান: "bg-[#4b8a9c]",
  "পৌরনীতি ও নাগরিকতা": "bg-[#86845e]",
  হিসাববিজ্ঞান: "bg-[#fefefe]",
  "ফিন্যান্স ও ব্যাংকিং": "bg-[#e3c592]",
  "ব্যবসায় উদ্যোগ": "bg-[#89aab1]",
  "ইসলাম শিক্ষা": "bg-[#4c6c76]",
  "হিন্দুধর্ম শিক্ষা": "bg-[#9b5c49]",
  "বৌদ্ধধর্ম শিক্ষা": "bg-[#cead5e]",
  "বাংলাদেশ ও বিশ্বপরিচয়": "bg-[#8f654b]",
  /* ── English Version (same subjects, English uploads) ────────────── */
  "ICT Guide": "bg-[#3f4e8c]",
  "Physics Guide": "bg-[#a4c5ec]",
  "Chemistry Guide": "bg-[#b898c4]",
  "Biology Guide": "bg-[#bdd779]",
  "Higher Math Solutions": "bg-[#e4bc73]",
};

export const SUBJECT_STRIP: Record<string, string> = Object.fromEntries(
  Object.entries(RAW).map(([k, v]) => [nz(k), v]),
);
