/* views/Pick.tsx — MCQ / CQ chooser. Subjects that ship as two uploads
   (e.g. গণিত গাইড CQ + গণিত গাইড MCQ) open this screen from the branch
   card; picking a version leads to that book's chapter list. */

import { Link, useParams } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { S } from "@/config";
import { loadSnapshot } from "@/catalog";
import { bookCore, isMcqBook, parseBookName } from "@/lib/titles";
import type { Book } from "@/types";

export function Pick() {
  const { bookId = "" } = useParams();
  const snap = loadSnapshot();

  let base: Book | null = null;
  let branchLabel = "";
  for (const b of snap.branches) {
    const f = b.books.find((x) => String(x.id) === bookId);
    if (f) {
      base = { id: String(f.id), name: f.name, branchId: b.id };
      branchLabel = b.label;
      break;
    }
  }

  /* the sibling upload: same branch, same subject core, opposite variant */
  let sibling: Book | null = null;
  if (base) {
    const core = bookCore(base.name);
    for (const b of snap.branches) {
      if (base.branchId && b.id !== base.branchId) continue;
      const f = b.books.find(
        (x) =>
          String(x.id) !== bookId &&
          bookCore(x.name) === core &&
          isMcqBook(x.name) !== isMcqBook(base.name),
      );
      if (f) {
        sibling = { id: String(f.id), name: f.name, branchId: b.id };
        break;
      }
    }
  }

  const options = [base, sibling]
    .filter((b): b is Book => b !== null)
    .toSorted((a, b) => Number(isMcqBook(b.name)) - Number(isMcqBook(a.name))); // MCQ first

  const countOf = (bk: Book): number => {
    for (const b of snap.branches) {
      const f = b.books.find((x) => String(x.id) === bk.id);
      /* the snapshot stores full chapter arrays even though the Book type
         doesn't declare them — read defensively */
      const cl = f ? Reflect.get(f, "chapterList") : undefined;
      if (Array.isArray(cl)) return cl.length;
    }
    return 0;
  };

  if (!base) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm hover:underline"
        >
          <ChevronLeft className="size-4" aria-hidden="true" /> Home
        </Link>
        <p className="py-10 text-center text-muted-foreground">
          Book not found.
        </p>
      </div>
    );
  }

  const bp = parseBookName(base.name);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6">
      <nav className="mb-1 flex items-center gap-1 text-sm text-muted-foreground">
        <Link
          to={`/branch/${base.branchId}`}
          className="inline-flex items-center gap-1 hover:underline"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />{" "}
          {branchLabel || "Back"}
        </Link>
      </nav>
      <h1 className="text-xl font-bold">{bp.name}</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Pick a version — both open the same subject
      </p>

      <div className="grid gap-3">
        {options.map((bk) => (
          <Card
            key={bk.id}
            className="flex cursor-pointer items-center gap-4 p-5 transition-colors hover:bg-muted/50"
            onClick={() => {
              S.bookCtx.set(String(bk.id), {
                id: String(bk.id),
                name: bk.name,
                branchId: bk.branchId,
              });
              window.location.hash = `#/book/${bk.id}`;
            }}
          >
            <span
              className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-lg font-bold text-primary"
              aria-hidden="true"
            >
              {isMcqBook(bk.name) ? "MCQ" : "CQ"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold">
                {isMcqBook(bk.name) ? "MCQ" : "CQ"}
              </p>
              <p className="text-sm text-muted-foreground">
                {countOf(bk) || "…"} chapters
              </p>
            </div>
            <ChevronRight
              className="size-5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </Card>
        ))}
      </div>
    </div>
  );
}
