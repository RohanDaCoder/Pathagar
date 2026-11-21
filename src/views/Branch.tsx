/* views/Branch.tsx — the book grid of one guide branch, grouped by stream. */

import { useCallback } from "react";
import { Link, useParams } from "react-router";
import { ChevronLeft, WifiOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ErrorState";
import { catalog } from "@/catalog";
import { DB } from "@/db";
import { STREAM_STYLE } from "@/lib/streamStyle";
import { useAsyncData } from "@/hooks/useAsyncData";
import {
  isMcqBook,
  isTwin,
  streamOf,
  STREAM_LABEL,
  type Stream,
} from "@/lib/titles";
import type { Book } from "@/types";
import { BookCard } from "./branch/BookCard";

const NO_BOOKS: Book[] = []; // stable fallback identity (perf rule: no fresh arrays as props)

const STREAM_ORDER: Stream[] = [
  "compulsory",
  "science",
  "business",
  "humanities",
  "religion",
  "extra",
];

export function Branch() {
  const { branchId = "" } = useParams();
  const id = Number.parseInt(branchId, 10);
  const meta = catalog().snapshot.branches.find((b) => b.id === id);
  const label = meta?.label || "Guide";

  const fetchList = useCallback(async () => {
    const [books, metas] = await Promise.all([
      catalog().getBooks(id),
      DB.allMeta(),
    ]);
    const saved: Record<string, number> = {};
    for (const m of metas) saved[m.bookId] = (saved[m.bookId] || 0) + 1;
    return { books, saved };
  }, [id]);
  const { data, error, reload } = useAsyncData(fetchList);

  const items = data?.books.items ?? NO_BOOKS;
  const stale = data?.books.stale ?? false;

  /* MCQ twins merge into their CQ book's chapter list — hide their cards */
  const visible = items.filter((bk) => {
    if (!isMcqBook(bk.name)) return true;
    return !items.some((x) => String(x.id) !== String(bk.id) && isTwin(bk, x));
  });
  const groups = STREAM_ORDER.map((g) => ({
    stream: g,
    books: visible.filter((bk) => streamOf(bk.name) === g),
  })).filter((g) => g.books.length > 0);
  const single = groups.length === 1; // don't label a one-group branch

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
          title="Couldn't load the book list"
          detail={error}
          onRetry={reload}
        />
      ) : !data ? (
        <div className="grid gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4">
          {stale ? (
            <Card className="flex items-center gap-2 border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <WifiOff className="size-4 shrink-0" aria-hidden="true" />
              Offline — showing the saved list
            </Card>
          ) : null}
          {items.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">
              No books in this branch.
            </p>
          ) : single ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {groups[0].books.map((bk) => (
                <BookCard
                  key={bk.id}
                  bk={bk}
                  branchId={id}
                  books={items}
                  stream={groups[0].stream}
                  savedCount={data.saved[String(bk.id)] ?? 0}
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-5">
              {groups.map(({ stream, books }) => {
                const st = STREAM_STYLE[stream];
                return (
                  <section key={stream}>
                    <div className="mb-2 flex items-center gap-2 px-1">
                      <span
                        className={`flex size-7 items-center justify-center rounded-lg ${st.chip}`}
                      >
                        <st.icon className="size-4" aria-hidden="true" />
                      </span>
                      <h2
                        className={`text-sm font-semibold uppercase tracking-wide ${st.label}`}
                      >
                        {STREAM_LABEL[stream]}
                      </h2>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {books.map((bk) => (
                        <BookCard
                          key={bk.id}
                          bk={bk}
                          branchId={id}
                          books={items}
                          stream={stream}
                          savedCount={data.saved[String(bk.id)] ?? 0}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
