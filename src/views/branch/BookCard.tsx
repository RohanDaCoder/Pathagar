/* views/branch/BookCard.tsx — one subject card in a branch grid. */

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { catalog } from "@/catalog";
import { isTwin, parseBookName } from "@/lib/titles";
import type { Book } from "@/types";

export function BookCard({
  bk,
  branchId,
  books,
  savedCount,
}: {
  bk: Book;
  branchId: number;
  books: Book[];
  savedCount: number;
}) {
  const bp = parseBookName(bk.name);
  /* the MCQ/CQ twin of this subject — same core name, opposite variant */
  const twin = books.find(
    (x) => isTwin(bk, x) && String(x.id) !== String(bk.id),
  );
  return (
    <Card
      className="flex cursor-pointer flex-col items-center gap-1.5 p-4 text-center transition-colors hover:bg-muted/50"
      onClick={() => {
        catalog().rememberBook({ ...bk, branchId });
        /* subjects that ship as MCQ + CQ uploads open the version chooser */
        window.location.hash = twin
          ? `#/book/${bk.id}/pick`
          : `#/book/${bk.id}`;
      }}
    >
      <p className="line-clamp-2 font-semibold leading-snug">{bp.name}</p>
      <div className="flex flex-wrap items-center justify-center gap-1">
        {twin ? <Badge variant="outline">MCQ / CQ</Badge> : null}
        {/* the chooser badge already says MCQ / CQ — don't repeat the
            variant tag the parser pulls out of the upload name */}
        {(twin
          ? bp.tags.filter((tg) => tg !== "MCQ" && tg !== "CQ")
          : bp.tags
        ).map((tg) => (
          <Badge key={tg} variant="secondary">
            {tg}
          </Badge>
        ))}
        {savedCount ? (
          <Badge variant="outline">✓ {savedCount} saved</Badge>
        ) : null}
      </div>
    </Card>
  );
}
