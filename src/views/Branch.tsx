/* views/Branch.tsx — book list of one guide branch */

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ChevronLeft, ChevronRight, WifiOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ErrorState";
import { S } from "@/config";
import { loadSnapshot, getBooks } from "@/catalog";
import { DB } from "@/db";
import { errMessage, errStatus } from "@/lib/errors";
import type { Book, ListResult } from "@/types";

export function Branch() {
  const { branchId = "" } = useParams();
  const id = Number.parseInt(branchId, 10);
  const snap = loadSnapshot();
  const meta = snap.branches.find((b) => b.id === id);
  const label = meta?.label || "Guide";

  const [data, setData] = useState<ListResult<Book> | null>(null);
  const [error, setError] = useState<{ title: string; detail?: string } | null>(
    null,
  );
  const [reload, setReload] = useState(0);
  const [savedByBook, setSavedByBook] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [books, metas] = await Promise.all([getBooks(id), DB.allMeta()]);
        if (cancelled) return;
        const saved: Record<string, number> = {};
        for (const m of metas) saved[m.bookId] = (saved[m.bookId] || 0) + 1;
        setSavedByBook(saved);
        setData(books);
      } catch (e) {
        if (!cancelled)
          setError({
            title: "Couldn't load the book list",
            detail:
              errStatus(e) === 403
                ? "The API key seems to be revoked — set a new one in Settings."
                : errMessage(e),
          });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-effect-dependencies -- reload is an intentional refetch trigger
  }, [id, reload]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6">
      <nav className="mb-1 flex items-center gap-1 text-sm text-muted-foreground">
        <Link to="/" className="inline-flex items-center gap-1 hover:underline">
          <ChevronLeft className="size-4" aria-hidden="true" /> Home
        </Link>
      </nav>
      <h1 className="mb-4 text-xl font-bold">{label}</h1>

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
        <div className="grid gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3">
          {data.stale ? (
            <Card className="flex items-center gap-2 border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <WifiOff className="size-4 shrink-0" aria-hidden="true" />
              Offline — showing the saved list
            </Card>
          ) : null}
          {data.items.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">
              No books in this branch.
            </p>
          ) : (
            data.items.map((bk) => (
              <Card
                key={bk.id}
                className="flex cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-muted/50"
                onClick={() => {
                  S.bookCtx.set(String(bk.id), {
                    id: String(bk.id),
                    name: bk.name,
                    branchId: id,
                  });
                  window.location.hash = `#/book/${bk.id}`;
                }}
              >
                {bk.image ? (
                  <img
                    src={bk.image}
                    alt=""
                    loading="lazy"
                    className="size-14 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xl font-semibold text-primary">
                    {(bk.name || "B").trim().charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 font-semibold">{bk.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {meta?.books.find((x) => x.id === bk.id)?.chapters ?? "…"}{" "}
                    chapters
                  </p>
                  {savedByBook[String(bk.id)] ? (
                    <Badge variant="secondary" className="mt-1">
                      ✓ {savedByBook[String(bk.id)]} saved
                    </Badge>
                  ) : null}
                </div>
                <ChevronRight
                  className="size-5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
