/* views/branch/BookCard.tsx — one subject card in a branch grid. */

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { catalog } from "@/catalog";
import { STREAM_STYLE } from "@/lib/streamStyle";
import type { Stream } from "@/lib/titles";
import { isTwin, parseBookName } from "@/lib/titles";
import type { Book } from "@/types";

export function BookCard({
  bk,
  branchId,
  books,
  stream,
  savedCount,
}: {
  bk: Book;
  branchId: number;
  books: Book[];
  stream: Stream;
  savedCount: number;
}) {
  const st = STREAM_STYLE[stream];
  const bp = parseBookName(bk.name);
  /* the MCQ/CQ twin of this subject — same core name, opposite variant */
  const twin = books.find(
    (x) => isTwin(bk, x) && String(x.id) !== String(bk.id),
  );
  return (
    <Card
      className="relative cursor-pointer overflow-hidden pt-5 text-center transition-all hover:-translate-y-0.5 hover:shadow-md"
      onClick={() => {
        catalog().rememberBook({ ...bk, branchId });
        /* subjects that ship as MCQ + CQ uploads open the version chooser */
        window.location.hash = twin
          ? `#/book/${bk.id}/pick`
          : `#/book/${bk.id}`;
      }}
    >
      {/* stream accent strip */}
      <span
        className={`absolute inset-x-0 top-0 h-1.5 ${st.strip}`}
        aria-hidden="true"
      />
      <span
        className={`mx-auto mb-1.5 flex size-9 items-center justify-center rounded-xl ${st.chip}`}
      >
        <st.icon className="size-4" aria-hidden="true" />
      </span>
      <p className="px-2 font-semibold leading-snug">{bp.name}</p>
      <div className="flex flex-wrap items-center justify-center gap-1 p-4 pt-2">
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
          <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300">
            ✓ {savedCount} saved
          </Badge>
        ) : null}
      </div>
    </Card>
  );
}
