/* views/Branch.tsx — book list of one guide branch */

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ChevronLeft, WifiOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ErrorState";
import { S } from "@/config";
import { loadSnapshot, getBooks } from "@/catalog";
import {
  bookCore,
  isMcqBook,
  parseBookName,
  streamOf,
  STREAM_LABEL,
  type Stream,
} from "@/lib/titles";
import { DB } from "@/db";
import { errMessage } from "@/lib/errors";
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
            detail: errMessage(e),
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
        <div className="grid gap-4">
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
            renderGrouped()
          )}
        </div>
      )}
    </div>
  );

  function bookCard(bk: Book): React.JSX.Element {
    const bp = parseBookName(bk.name);
    /* the MCQ/CQ twin of this subject — same core name, opposite variant */
    const twin = data?.items.find(
      (x) =>
        String(x.id) !== String(bk.id) &&
        bookCore(x.name) === bookCore(bk.name) &&
        isMcqBook(x.name) !== isMcqBook(bk.name),
    );
    return (
      /* names are centred: the old avatar + chevron layout left short names
         drifting off-centre to the left */
      <Card
        key={bk.id}
        className="flex cursor-pointer flex-col items-center gap-1.5 p-4 text-center transition-colors hover:bg-muted/50"
        onClick={() => {
          S.bookCtx.set(String(bk.id), {
            id: String(bk.id),
            name: bk.name,
            branchId: id,
          });
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
          {savedByBook[String(bk.id)] ? (
            <Badge variant="outline">
              ✓ {savedByBook[String(bk.id)]} saved
            </Badge>
          ) : null}
        </div>
      </Card>
    );
  }

  function renderGrouped() {
    /* MCQ twins merge into their CQ book's chapter list — hide their cards */
    const visible = data!.items.filter((bk) => {
      if (!isMcqBook(bk.name)) return true;
      return !data!.items.some(
        (x) =>
          String(x.id) !== String(bk.id) &&
          !isMcqBook(x.name) &&
          bookCore(x.name) === bookCore(bk.name),
      );
    });
    const byStream = new Map<Stream, Book[]>();
    for (const g of [
      "compulsory",
      "science",
      "business",
      "humanities",
      "religion",
      "extra",
    ] as Stream[])
      byStream.set(
        g,
        visible.filter((bk) => streamOf(bk.name) === g),
      );
    const present = [...byStream.entries()].filter(([, v]) => v.length > 0);
    const single = present.length === 1; // don't label a one-group branch

    const only = single ? present[0] : undefined;
    if (only) {
      const [, books] = only;
      return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {books.map(bookCard)}
        </div>
      );
    }
    return (
      <div className="grid gap-5">
        {present.map(([g, books]) => (
          <section key={g}>
            <h2 className="mb-2 px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {STREAM_LABEL[g]}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {books.map(bookCard)}
            </div>
          </section>
        ))}
      </div>
    );
  }
}
