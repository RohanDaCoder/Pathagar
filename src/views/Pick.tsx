/* views/Pick.tsx — MCQ/CQ chooser for subjects that ship as two uploads. */

import { Link, useParams } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { catalog } from "@/catalog";
import { isMcqBook, isTwin, parseBookName } from "@/lib/titles";
import type { Book } from "@/types";

export function Pick() {
  const { bookId = "" } = useParams();
  const ref = catalog.findBook(bookId);
  const base = ref?.book ?? null;

  /* the sibling upload: same branch, same subject core, opposite variant */
  const sibling =
    base && ref
      ? (catalog.snapshot.branches
          .find((b) => b.id === ref.branchId)
          ?.books.find((x) => isTwin(base, x)) ?? null)
      : null;

  const options = [base, sibling]
    .filter((b): b is Book => b !== null)
    .toSorted((a, b) => Number(isMcqBook(b.name)) - Number(isMcqBook(a.name))); // MCQ first

  if (!base || !ref) {
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
          to={`/branch/${ref.branchId}`}
          className="inline-flex items-center gap-1 hover:underline"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />{" "}
          {ref.branchLabel || "Back"}
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
              catalog.rememberBook({ ...bk, branchId: ref.branchId });
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
                {catalog.chapterCountOf(bk.id) || "…"} chapters
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
