/* views/Book.tsx — chapter list of one book + the download toolbar.
   Chapters arrive pre-parsed & ordered by the catalog (lib/titles via
   CatalogService). Rows live in views/book/rows.tsx. */

import { useCallback } from "react";
import { Link, useParams } from "react-router";
import { ChevronLeft, Download, WifiOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ErrorState";
import { toast } from "sonner";
import { catalog } from "@/catalog";
import { DB } from "@/db";
import { DL } from "@/downloads";
import { useDlVersion } from "@/hooks/useDlVersion";
import { useAsyncData } from "@/hooks/useAsyncData";
import { bnNum, parseBookName } from "@/lib/titles";
import {
  buildRows,
  ChapterRow,
  GroupRow,
  PartRow,
  SectionLabel,
} from "./book/rows";

export function Book() {
  const { bookId = "", major: majorParam } = useParams<{
    bookId: string;
    major?: string;
  }>();
  useDlVersion(); // re-render on download-queue updates

  const ref = catalog().findBook(bookId);
  const bookName = ref?.book.name;
  const branchId = ref?.branchId;
  const branchLabel = ref?.branchLabel ?? "";
  const majorNum = majorParam !== undefined ? Number(majorParam) : null;

  const fetchList = useCallback(async () => {
    const [chapters, metas] = await Promise.all([
      catalog().getChapters(bookId),
      DB.allMeta(),
    ]);
    const mine = metas.filter((m) => m.bookId === bookId);
    return {
      chapters,
      saved: new Set(mine.map((m) => m.id)),
      sizes: Object.fromEntries(mine.map((m) => [m.id, m.size || 0])),
    };
  }, [bookId]);
  const { data, error, reload } = useAsyncData(fetchList);

  const saved = data?.saved ?? new Set<string>();
  const sizes = data?.sizes ?? {};
  const items = data?.chapters.items ?? [];
  const book = { id: bookId, name: bookName || "Book", branchId };

  /* the meter counts in-flight byte progress too — a "finished chapters only"
     bar sits at 0% for minutes on slow networks */
  const done = items.filter(
    (ch) =>
      saved.has(String(ch.id)) || DL.stateOf(String(ch.id))?.status === "done",
  ).length;
  const total = items.length;
  let units = done;
  for (const [id, st] of DL.entries()) {
    if (
      st.bookId === bookId &&
      !saved.has(id) &&
      st.status === "downloading" &&
      st.total
    )
      units += st.loaded / st.total;
  }
  const pct = total ? Math.min(100, Math.round((units / total) * 100)) : 0;
  const speed = DL.states()
    .filter((st) => st.status === "downloading" && st.bookId === bookId)
    .reduce((a, st) => a + (st.speed ?? 0), 0);

  const fronts = items.filter((c) => c.kind === "front");
  const chapters = items.filter((c) => c.kind !== "front" && c.kind !== "back");
  const extras = items.filter((c) => c.kind === "back");
  const mainRows = buildRows(chapters, book);
  const parts =
    majorNum !== null
      ? chapters.filter(
          (c) => typeof c.num === "number" && Math.floor(c.num) === majorNum,
        )
      : [];
  const bp = parseBookName(bookName || "Book");
  const stale = data?.chapters.stale ?? false;

  const backLink = (
    <nav className="mb-1 flex items-center gap-1 text-sm text-muted-foreground">
      {majorNum !== null ? (
        <Link
          to={`/book/${bookId}`}
          className="inline-flex items-center gap-1 hover:underline"
        >
          <ChevronLeft className="size-4" aria-hidden="true" /> {bp.name}
        </Link>
      ) : branchId ? (
        <Link
          to={`/branch/${branchId}`}
          className="inline-flex items-center gap-1 hover:underline"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />{" "}
          {branchLabel || "Back"}
        </Link>
      ) : (
        <Link to="/" className="inline-flex items-center gap-1 hover:underline">
          <ChevronLeft className="size-4" aria-hidden="true" /> Home
        </Link>
      )}
    </nav>
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6">
      {backLink}
      <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold">
        {majorNum !== null ? `অধ্যায় ${bnNum(String(majorNum))}` : bp.name}
        {majorNum === null && bp.tags.length
          ? bp.tags.map((tg) => (
              <Badge key={tg} variant="secondary">
                {tg}
              </Badge>
            ))
          : null}
      </h1>
      {majorNum === null ? (
        branchLabel ? (
          <p className="mb-4 text-sm text-muted-foreground">{branchLabel}</p>
        ) : (
          <div className="mb-4" />
        )
      ) : (
        <div className="mb-4" />
      )}

      {error ? (
        <ErrorState
          title="Couldn't load the chapter list"
          detail={error}
          onRetry={reload}
        />
      ) : !data ? (
        <div className="grid gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : majorNum !== null ? (
        /* parts view — bare part numbers, nothing else */
        parts.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">
            No parts found for this chapter.
          </p>
        ) : (
          <div className="grid gap-2">
            {parts.map((ch) => (
              <PartRow
                key={String(ch.id)}
                ch={ch}
                book={book}
                saved={saved.has(String(ch.id))}
              />
            ))}
          </div>
        )
      ) : (
        <>
          {total > 0 ? (
            <div className="mb-4 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <Progress
                  value={pct}
                  className="h-2"
                  aria-label="Book download progress"
                />
                {speed > 0 ? (
                  <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                    {speed < 1024 * 1024
                      ? `${Math.round(speed / 1024)} KB/s`
                      : `${(speed / (1024 * 1024)).toFixed(1)} MB/s`}
                  </p>
                ) : null}
              </div>
              <Button
                size="sm"
                disabled={done >= total}
                onClick={() => {
                  let n = 0;
                  for (const ch of items) {
                    const id = String(ch.id);
                    if (!saved.has(id) && !DL.has(id)) {
                      DL.enqueue(ch, book);
                      n++;
                    }
                  }
                  if (n) toast(`Started downloading ${n} chapters`);
                }}
              >
                <Download className="size-4" aria-hidden="true" />
                {done >= total ? "Done" : `Download all (${done}/${total})`}
              </Button>
            </div>
          ) : null}

          <div className="grid gap-2">
            {stale ? (
              <Card className="flex items-center gap-2 border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <WifiOff className="size-4 shrink-0" aria-hidden="true" />
                Offline — saved list
              </Card>
            ) : null}
            {items.length === 0 ? (
              <p className="py-10 text-center text-muted-foreground">
                No chapters found for this book.
              </p>
            ) : (
              <>
                {fronts.length ? <SectionLabel text="Contents" /> : null}
                {fronts.map((ch) => (
                  <ChapterRow
                    key={String(ch.id)}
                    ch={ch}
                    book={book}
                    saved={saved.has(String(ch.id))}
                    size={sizes[String(ch.id)]}
                  />
                ))}
                {mainRows.length ? <SectionLabel text="Chapters" /> : null}
                {mainRows.map((r) =>
                  r.t === "grp" ? (
                    <GroupRow
                      key={`g-${r.book.id}-${r.major}`}
                      group={r}
                      savedIds={saved}
                    />
                  ) : (
                    <ChapterRow
                      key={String(r.ch.id)}
                      ch={r.ch}
                      book={r.book}
                      saved={saved.has(String(r.ch.id))}
                      size={sizes[String(r.ch.id)]}
                    />
                  ),
                )}
                {extras.length ? <SectionLabel text="Exam & practice" /> : null}
                {extras.map((ch) => (
                  <ChapterRow
                    key={String(ch.id)}
                    ch={ch}
                    book={book}
                    saved={saved.has(String(ch.id))}
                    size={sizes[String(ch.id)]}
                  />
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
