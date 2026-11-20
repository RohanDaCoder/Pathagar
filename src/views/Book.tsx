/* views/Book.tsx — chapter list of one book + the download toolbar.
   Chapters arrive pre-parsed & ordered by the adapter (lib/titles.ts via
   catalog.ts): num/label/display/pages/kind. Row state re-renders through
   useDlVersion (the queue is external to React). */

import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  Check,
  ChevronLeft,
  Download,
  RotateCcw,
  Sparkles,
  WifiOff,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ErrorState";
import { toast } from "sonner";
import { S } from "@/config";
import { loadSnapshot, getChapters } from "@/catalog";
import { DB } from "@/db";
import { DL } from "@/dlqueue";
import { useDlVersion } from "@/hooks/useDlVersion";
import { fmtMB } from "@/lib/format";
import { errMessage } from "@/lib/errors";
import type { Chapter, ListResult } from "@/types";

function SectionLabel({ text }: { text: string }) {
  return (
    <p className="px-1 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {text}
    </p>
  );
}

export function Book() {
  const { bookId = "" } = useParams();
  const navigate = useNavigate();
  useDlVersion(); // re-render on download-queue updates

  const snap = loadSnapshot();
  const ctx = S.bookCtx.get(bookId);
  let bookName = ctx?.name;
  let branchId = ctx?.branchId;
  if (!bookName) {
    for (const b of snap.branches) {
      const f = b.books.find((x) => String(x.id) === bookId);
      if (f) {
        bookName = f.name;
        branchId = b.id;
        break;
      }
    }
  }
  const branchLabel = snap.branches.find((b) => b.id === branchId)?.label || "";

  const [data, setData] = useState<ListResult<Chapter> | null>(null);
  const [error, setError] = useState<{ title: string; detail?: string } | null>(
    null,
  );
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [sizes, setSizes] = useState<Record<string, number>>({});

  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [chapters, metas] = await Promise.all([
          getChapters(bookId),
          DB.allMeta(),
        ]);
        if (cancelled) return;
        const mine = metas.filter((m) => m.bookId === bookId);
        setSaved(new Set(mine.map((m) => m.id)));
        setSizes(Object.fromEntries(mine.map((m) => [m.id, m.size || 0])));
        setData(chapters);
      } catch (e) {
        if (!cancelled)
          setError({
            title: "Couldn't load the chapter list",
            detail: errMessage(e),
          });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-effect-dependencies -- reload is an intentional refetch trigger
  }, [bookId, reload]);

  const book = { id: bookId, name: bookName || "Book", branchId };
  const items = data?.items ?? [];
  const done = items.filter(
    (ch) =>
      saved.has(String(ch.id)) || S.dl.get(String(ch.id))?.status === "done",
  ).length;
  const total = items.length;
  /* the meter counts in-flight byte progress too — a "finished chapters only"
     bar sits at 0% for minutes on slow networks (the reported broken meter) */
  let units = done;
  for (const [id, st] of S.dl) {
    if (
      st.bookId === bookId &&
      !saved.has(id) &&
      st.status === "downloading" &&
      st.total
    )
      units += st.loaded / st.total;
  }
  const pct = total ? Math.min(100, Math.round((units / total) * 100)) : 0;
  const speed = [...S.dl.values()]
    .filter((st) => st.status === "downloading" && st.bookId === bookId)
    .reduce((a, st) => a + (st.speed ?? 0), 0);
  const fronts = items.filter((c) => c.kind === "front");
  const chapters = items.filter((c) => c.kind !== "front" && c.kind !== "back");
  const extras = items.filter((c) => c.kind === "back");

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6">
      <nav className="mb-1 flex items-center gap-1 text-sm text-muted-foreground">
        {branchId ? (
          <Link
            to={`/branch/${branchId}`}
            className="inline-flex items-center gap-1 hover:underline"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />{" "}
            {branchLabel || "Back"}
          </Link>
        ) : (
          <Link
            to="/"
            className="inline-flex items-center gap-1 hover:underline"
          >
            <ChevronLeft className="size-4" aria-hidden="true" /> Home
          </Link>
        )}
      </nav>
      <h1 className="text-xl font-bold">{bookName || "Book"}</h1>
      {branchLabel ? (
        <p className="mb-4 text-sm text-muted-foreground">{branchLabel}</p>
      ) : (
        <div className="mb-4" />
      )}

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
                if (!saved.has(id) && !S.dl.has(id)) {
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

      {error ? (
        <ErrorState
          title={error.title}
          detail={error.detail}
          onRetry={() => {
            setData(null);
            setError(null);
            setReload((n) => n + 1);
          }}
        />
      ) : !data ? (
        <div className="grid gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-2">
          {data.stale ? (
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
              {fronts.map((ch) => chapterRow(ch))}
              {chapters.length ? <SectionLabel text="Chapters" /> : null}
              {chapters.map((ch) => chapterRow(ch))}
              {extras.length ? <SectionLabel text="Exam & practice" /> : null}
              {extras.map((ch) => chapterRow(ch))}
            </>
          )}
        </div>
      )}
    </div>
  );

  function chapterRow(ch: Chapter) {
    const id = String(ch.id);
    const st = S.dl.get(id);
    const isSaved = saved.has(id);
    const isDownloading = st?.status === "downloading";
    const isQueued = st?.status === "queued";
    const isError = st?.status === "error";
    const title = ch.display || ch.title || "Chapter";
    return (
      <Card
        key={id}
        className={
          "flex items-center gap-3 p-3 transition-colors " +
          (isSaved || st?.status === "done"
            ? "cursor-pointer hover:bg-muted/50"
            : isError
              ? "border-destructive/40"
              : "")
        }
        onClick={() => {
          if (isSaved || st?.status === "done") {
            void navigate(`/read/${id}`);
          } else if (!isDownloading && !isQueued) {
            DL.enqueue(ch, book, { autoOpen: true });
          }
        }}
      >
        <span
          className="flex h-9 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary"
          aria-hidden="true"
        >
          {ch.label ? (
            <>
              <span className="text-[10px] font-medium leading-none opacity-80">
                {ch.label.split(" ")[0]}
              </span>
              <span className="text-sm font-bold leading-tight">
                {ch.label.split(" ").slice(1).join(" ") || "·"}
              </span>
            </>
          ) : (
            <Sparkles className="size-4" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{title}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {ch.pages ? (
              <span className="text-xs tabular-nums text-muted-foreground">
                pp. {ch.pages[0]}–{ch.pages[1]}
              </span>
            ) : null}
            {isDownloading ? (
              <div className="flex w-full items-center gap-2">
                <Progress value={st?.pct ?? 0} className="h-1.5 flex-1" />
                <span className="text-xs tabular-nums text-muted-foreground">
                  {st?.pct ?? 0}%
                </span>
              </div>
            ) : isQueued ? (
              <span className="text-xs text-muted-foreground">Queued…</span>
            ) : isError ? (
              <span className="text-xs text-destructive">{st?.error}</span>
            ) : isSaved || st?.status === "done" ? (
              <Badge variant="secondary">
                ✓ Offline{sizes[id] ? ` · ${fmtMB(sizes[id])}` : ""}
              </Badge>
            ) : null}
          </div>
        </div>
        {isDownloading || isQueued ? (
          <Button
            size="icon"
            variant="ghost"
            aria-label="Cancel download"
            onClick={(e) => {
              e.stopPropagation();
              DL.cancel(id);
            }}
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        ) : isSaved || st?.status === "done" ? (
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Check className="size-4" aria-hidden="true" />
          </span>
        ) : isError ? (
          <span className="flex size-8 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <RotateCcw className="size-4" aria-hidden="true" />
          </span>
        ) : (
          <span className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Download className="size-4" aria-hidden="true" />
          </span>
        )}
      </Card>
    );
  }
}
