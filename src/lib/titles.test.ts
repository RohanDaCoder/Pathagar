/* lib/titles.test.ts — parser adapter tests (every format seen in the
   1247-chapter API survey; see scripts/survey output) */
import { describe, expect, test } from "bun:test";
import {
  compareChapters,
  parseBookName,
  parseTitle,
  sortParsed,
} from "./titles";

describe("parseTitle — numbered formats", () => {
  test("physics suffix form strips number, chapter word and pages", () => {
    const p = parseTitle(
      "6. বস্তুর ওপর তাপের প্রভাব -অধ্যায় ৬- -Pages-375-438-",
    );
    expect(p.number).toBe(6);
    expect(p.display).toBe("বস্তুর ওপর তাপের প্রভাব");
    expect(p.pageStart).toBe(375);
    expect(p.pageEnd).toBe(438);
    expect(p.kind).toBe("chapter");
  });

  test("decomposed য+় অধ্যায় matches precomposed", () => {
    // the API mixes য+় (U+09AF U+09BC) and য় (U+09DF) — both must parse
    const a = parseTitle("MCQ - অধ্যায় - 2.1");
    const b = parseTitle("অধ্যায় - 3.4");
    expect(a.number).toBe(2.1);
    expect(b.number).toBe(3.4);
  });

  test("অধ্যায়-০১ prefix form", () => {
    const p = parseTitle(
      "অধ্যায়-০১ গৌতম বুদ্ধের জীবন ও শিক্ষা - এসএসসি বৌদ্ধধর্ম শিক্ষা",
    );
    expect(p.number).toBe(1);
    expect(p.display).toBe("গৌতম বুদ্ধের জীবন ও শিক্ষা");
  });

  test("অধ্যায় ১ - name with spaceless Pages", () => {
    const p = parseTitle(
      "অধ্যায় ১ - তথ্য ও যোগাযোগ প্রযুক্তি ও আমাদের বাংলাদেশ Pages-9-66",
    );
    expect(p.number).toBe(1);
    expect(p.display).toBe("তথ্য ও যোগাযোগ প্রযুক্তি ও আমাদের বাংলাদেশ");
    expect(p.pageStart).toBe(9);
    expect(p.pageEnd).toBe(66);
  });

  test("bare leading number with dot, dash, or bare space", () => {
    expect(parseTitle("1 - The Sentence").number).toBe(1);
    expect(parseTitle("2.1 পদার্থের অবস্থা").number).toBe(2.1);
    expect(parseTitle("11 .অবতার ও আদর্শ জীবনচরিত -অধ্যায় ১১-").number).toBe(
      11,
    );
  });

  test("Unit / Chapter / Lesson labels", () => {
    expect(parseTitle("Unit-01 Sense of Self").number).toBe(1);
    expect(parseTitle("SSC Physics Guide Chapter - 1").number).toBe(1);
    expect(parseTitle("Lesson 5 Parts of Speech").number).toBe(5);
  });

  test("Bengali digit ordinals with labels", () => {
    expect(parseTitle("১ম অধ্যায় -তথ্য ও যোগাযোগ প্রযুক্তি").number).toBe(1);
    expect(parseTitle("৪র্থ পাঠ সুদ(1)").number).toBe(4);
    expect(parseTitle("৬ষ্ট পাঠ আয়াতের প্রকারভেদ(1)").number).toBe(6);
  });

  test("গদ্য-১; prose numbering keeps the author", () => {
    const p = parseTitle("গদ্য-১; প্রত্যুপকার - ঈশ্বরচন্দ্র বিদ্যাসাগর");
    expect(p.number).toBe(1);
    expect(p.display).toContain("প্রত্যুপকার");
    expect(p.display).toContain("ঈশ্বরচন্দ্র");
  });

  test("Bengali word ordinals and ranges", () => {
    expect(parseTitle("একাদশ - পঞ্চদশ (1) (1)").number).toBe(11);
    expect(parseTitle("একত্রিশতম - পঁয়ত্রিশ (1)").number).toBe(31);
    expect(parseTitle("ষোলতম-বিশতম(1) (1)").number).toBe(16);
  });

  test("question-bank prefixes", () => {
    expect(parseTitle("Questions No 1,2,3 (Seen Comprehension)").number).toBe(
      1,
    );
    expect(parseTitle("Question NO -7 Re-Arranging Sentences").number).toBe(7);
    expect(parseTitle("Question -10 Completing Story").number).toBe(10);
  });

  test("Quran sections", () => {
    expect(parseTitle("রুকু ১-৫(1)").number).toBe(1);
    expect(parseTitle("সুরা আল বাকারা,১ম - ৫ম পাঠ(1) (1)").number).toBe(1);
  });

  test("creative-question banks are back matter", () => {
    const p = parseTitle("রচনামূলক প্রশ্নের উত্তর (১-১০)(1)");
    expect(p.kind).toBe("back");
    expect(p.display).toContain("(১-১০)");
  });
});

describe("parseTitle — kinds & noise", () => {
  test("front matter", () => {
    expect(parseTitle("সূচিপত্র Ssc 2028 & Marks Distribution").kind).toBe(
      "front",
    );
    expect(parseTitle("Table of Contents").kind).toBe("front");
  });

  test("back matter", () => {
    expect(
      parseTitle("স্পেশাল মডেল টেস্ট ও উত্তরমালা -Pages-843-853-").kind,
    ).toBe("back");
    expect(parseTitle("ব্যবহারিক অংশ -Pages-323-346-").kind).toBe("back");
    expect(
      parseTitle("বোর্ড পরীক্ষার প্রশ্নপত্র ও উত্তরমালা -Pages-854-880-").kind,
    ).toBe("back");
    expect(parseTitle("Board Questions").kind).toBe("back");
    expect(parseTitle("সাজেশন").kind).toBe("back");
  });

  test("(1) upload noise is stripped, real (2) survives", () => {
    expect(parseTitle("কৌতুক প্রসঙ্গে (1) (1)").display).toBe("কৌতুক প্রসঙ্গে");
    expect(parseTitle("দয়া, অনুগ্রহ প্রসঙ্গে (2) (1)").display).toContain(
      "(2)",
    );
  });

  test("a novel year is not a chapter number", () => {
    expect(parseTitle("উপন্যাস; ১৯৭১").number).toBeNull();
  });

  test("never returns an empty display", () => {
    expect(parseTitle("MCQ - অধ্যায় - 10").display.length).toBeGreaterThan(0);
  });
});

describe("ordering", () => {
  test("physics book sorts 1..13 with extras last", () => {
    const raw = [
      "স্পেশাল মডেল টেস্ট ও উত্তরমালা -Pages-843-853-",
      "6. বস্তুর ওপর তাপের প্রভাব -অধ্যায় ৬- -Pages-375-438-",
      "1. ভৌত রাশি এবং তাদের পরিমাপ -অধ্যায় ১- -Pages-3-56-",
      "3. বল -অধ্যায় ৩- -Pages-145-216-",
      "বোর্ড পরীক্ষার প্রশ্নপত্র ও উত্তরমালা -Pages-854-880-",
    ];
    const sorted = sortParsed(raw.map((title) => ({ title })));
    expect(sorted.map((x) => x.title)).toEqual([
      "1. ভৌত রাশি এবং তাদের পরিমাপ -অধ্যায় ১- -Pages-3-56-",
      "3. বল -অধ্যায় ৩- -Pages-145-216-",
      "6. বস্তুর ওপর তাপের প্রভাব -অধ্যায় ৬- -Pages-375-438-",
      "স্পেশাল মডেল টেস্ট ও উত্তরমালা -Pages-843-853-",
      "বোর্ড পরীক্ষার প্রশ্নপত্র ও উত্তরমালা -Pages-854-880-",
    ]);
  });

  test("decimal sub-chapters order naturally", () => {
    const nums = [10, 2.2, 2.1, 1, 17, 16.4].map((n) => ({
      p: parseTitle(`MCQ - অধ্যায় - ${n}`),
    }));
    const s = nums
      .map((x) => x.p)
      .toSorted(compareChapters)
      .map((p) => p.number);
    expect(s).toEqual([1, 2.1, 2.2, 10, 16.4, 17]);
  });
});

describe("parseBookName", () => {
  test("extracts SSC year and MCQ/CQ tags", () => {
    expect(parseBookName("পদার্থবিজ্ঞান গাইড MCQ (SSC 2028)")).toEqual({
      name: "পদার্থবিজ্ঞান গাইড",
      tags: ["SSC 2028", "MCQ"],
    });
    expect(parseBookName("বাংলা ১ম পত্র গাইড (SSC 2028)")).toEqual({
      name: "বাংলা ১ম পত্র গাইড",
      tags: ["SSC 2028"],
    });
  });
});
