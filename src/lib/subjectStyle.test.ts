/* lib/subjectStyle.test.ts — the per-subject strip palette must resolve for
   every book it names (MCQ/CQ twins share a core name) and leave the rest
   on the stream fallback. Keys are codepoint-exact parseBookName outputs —
   a drifted key silently falls back, so this pins book ids → classes. */
import { describe, expect, test } from "bun:test";
import { nz, parseBookName } from "./titles";
import { SUBJECT_STRIP } from "./subjectStyle";
import snap from "../catalog-snapshot.json";

function stripOf(id: number): string | null {
  for (const br of snap.branches) {
    const b = br.books.find((x) => x.id === id);
    if (b) return SUBJECT_STRIP[nz(parseBookName(b.name).name)] ?? null;
  }
  return null;
}

describe("subject strip palette", () => {
  test("every user-named subject resolves to its exact color", () => {
    const want: [number, string][] = [
      [182405, "bg-[#aa7b52]"], // বাংলা ১ম পত্র
      [182407, "bg-[#e2eff7]"], // বাংলা সহপাঠ
      [182442, "bg-[#68715a]"], // বাংলা ২য় পত্র
      [182408, "bg-[#7d3e60]"], // ইংরেজি ১ম পত্র
      [182412, "bg-[#9ac3cb]"], // গণিত (MCQ + CQ twins share)
      [182413, "bg-[#9ac3cb]"],
      [182414, "bg-[#3f4e8c]"], // তথ্য ও যোগাযোগ প্রযুক্তি
      [182431, "bg-[#ecc6d1]"], // বিজ্ঞান (commerce-group subject)
      [182418, "bg-[#a4c5ec]"], // পদার্থবিজ্ঞান
      [182420, "bg-[#b898c4]"], // রসায়ন
      [182422, "bg-[#bdd779]"], // জীববিজ্ঞান
      [182424, "bg-[#e4bc73]"], // উচ্চতর গণিত
      [182428, "bg-[#7e82ba]"], // ভূগোল ও পরিবেশ
      [182429, "bg-[#786959]"], // অর্থনীতি
      [182432, "bg-[#8e9aa9]"], // কৃষিশিক্ষা
      [182433, "bg-[#4b8a9c]"], // গার্হস্থ্যবিজ্ঞান
      [182430, "bg-[#86845e]"], // পৌরনীতি ও নাগরিকতা
      [182437, "bg-[#fefefe]"], // হিসাববিজ্ঞান
      [182436, "bg-[#e3c592]"], // ফিন্যান্স ও ব্যাংকিং
      [182435, "bg-[#89aab1]"], // ব্যবসায় উদ্যোগ
      [182415, "bg-[#4c6c76]"], // ইসলাম শিক্ষা
      [182416, "bg-[#9b5c49]"], // হিন্দুধর্ম শিক্ষা
      [182417, "bg-[#cead5e]"], // বৌদ্ধধর্ম শিক্ষা
      [182426, "bg-[#8f654b]"], // বাংলাদেশ ও বিশ্বপরিচয়
      [18115, "bg-[#3f4e8c]"], // English Version: ICT Guide
      [18116, "bg-[#e4bc73]"], // Higher Math Solutions
      [18117, "bg-[#bdd779]"], // Biology Guide
      [18118, "bg-[#b898c4]"], // Chemistry Guide
      [18119, "bg-[#a4c5ec]"], // Physics Guide
    ];
    for (const [id, strip] of want) expect(stripOf(id)).toBe(strip);
  });

  test("unmapped subjects keep the stream fallback", () => {
    expect(stripOf(182410)).toBeNull(); // ইংরেজি ২য় পত্র
    expect(stripOf(182427)).toBeNull(); // বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা
    expect(stripOf(17798)).toBeNull(); // Madrasah: আকাইদ ও ফিকহ
  });
});
