/* views/Book.tsx — chapter list of one book + the download toolbar.
   Row state re-renders through useDlVersion (the queue is external to React). */

import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  Check,
  ChevronLeft,
  Download,
  RotateCcw,
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
import { errMessage, errStatus } from "@/lib/errors";
import type { Chapter, ListResult } from "@/types";

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
            detail:
              errStatus(e) === 403
                ? "API key revoked — set a new one in Settings."
                : errMessage(e),
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
  const pct = total ? Math.round((done / total) * 100) : 0;

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
          <Progress value={pct} className="h-2 flex-1" />
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
            items.map((ch, i) => {
              const id = String(ch.id);
              const st = S.dl.get(id);
              const isSaved = saved.has(id);
              const isDownloading = st?.status === "downloading";
              const isQueued = st?.status === "queued";
              const isError = st?.status === "error";
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
                  <span className="w-7 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {ch.title || "Chapter"}
                    </p>
                    {isDownloading ? (
                      <div className="mt-1 flex items-center gap-2">
                        <Progress
                          value={st?.pct ?? 0}
                          className="h-1.5 flex-1"
                        />
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {st?.pct ?? 0}%
                        </span>
                      </div>
                    ) : isQueued ? (
                      <p className="text-xs text-muted-foreground">Queued…</p>
                    ) : isError ? (
                      <p className="text-xs text-destructive">{st?.error}</p>
                    ) : isSaved || st?.status === "done" ? (
                      <Badge variant="secondary" className="mt-0.5">
                        ✓ Offline{sizes[id] ? ` · ${fmtMB(sizes[id])}` : ""}
                      </Badge>
                    ) : null}
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
            })
          )}
        </div>
      )}
    </div>
  );
}
