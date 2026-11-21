/* views/Home.tsx — hero, branch cards, library shortcut, footer */

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { BookMarked, ChevronRight, Languages, Library } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { APP_NAME, APP_VERSION } from "@/config";
import { catalog } from "@/catalog";
import { DB } from "@/db";
import { fmtMB } from "@/lib/format";

/* per-branch accent cycle (literal classes — Tailwind has no runtime) */
const BRANCH_CHIP = [
  "bg-teal-500/10 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300",
  "bg-indigo-500/10 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300",
  "bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  "bg-rose-500/10 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300",
];

export function Home() {
  const navigate = useNavigate();
  const snap = catalog().snapshot;
  const [meta, setMeta] = useState<Awaited<
    ReturnType<typeof DB.allMeta>
  > | null>(null);

  useEffect(() => {
    void DB.allMeta().then(setMeta);
  }, []);

  const totalMB = (meta ?? []).reduce((a, m) => a + (m.size || 0), 0);
  const savedByBranch = new Map<string, number>();
  for (const m of meta ?? []) {
    if (m.branchId)
      savedByBranch.set(m.branchId, (savedByBranch.get(m.branchId) || 0) + 1);
  }
  const totalBooks = snap.branches.reduce((a, b) => a + b.books.length, 0);
  const totalChapters = snap.branches.reduce((a, b) => a + b.total_chapters, 0);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pb-24 pt-6">
      {/* brand hero — gradient echoes the OG share card (teal + soft circles) */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-teal-800 p-5 text-primary-foreground shadow-lg">
        <span
          className="pointer-events-none absolute -right-16 -top-20 size-52 rounded-full bg-white/10"
          aria-hidden="true"
        />
        <span
          className="pointer-events-none absolute -bottom-24 -left-14 size-44 rounded-full bg-white/5"
          aria-hidden="true"
        />
        <div className="relative flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-white/15 text-2xl font-bold backdrop-blur">
            P
          </div>
          <div>
            <h1 className="text-xl font-bold">{APP_NAME}</h1>
            <p className="text-sm text-primary-foreground/85">
              Class 9-10 guide books · offline library
            </p>
          </div>
        </div>
        <div className="relative mt-4 flex flex-wrap gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 backdrop-blur">
            <BookMarked className="size-3.5" aria-hidden="true" />
            {snap.branches.length} versions · {totalBooks} books
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 backdrop-blur">
            {totalChapters} chapters
          </span>
        </div>
      </header>

      {meta && meta.length > 0 ? (
        <Link to="/library" className="block">
          <Card className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/50">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              <Library className="size-5" aria-hidden="true" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">My Library</p>
              <p className="text-sm text-muted-foreground">
                {meta.length} chapters · {fmtMB(totalMB)}
              </p>
            </div>
            <ChevronRight
              className="size-5 text-muted-foreground"
              aria-hidden="true"
            />
          </Card>
        </Link>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {snap.branches.map((b, i) => (
          <Card
            key={b.id}
            className="flex cursor-pointer items-center gap-3 p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
            onClick={() => void navigate(`/branch/${b.id}`)}
          >
            <div
              className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${BRANCH_CHIP[i % BRANCH_CHIP.length]}`}
            >
              <Languages className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-semibold">
                {b.label.replace(/\s*\(.*?\)\s*$/, "")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {b.books.length} books · {b.total_chapters} chapters
              </p>
              {savedByBranch.get(String(b.id)) ? (
                <Badge className="mt-1 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300">
                  ✓ {savedByBranch.get(String(b.id))} saved
                </Badge>
              ) : null}
            </div>
            <ChevronRight
              className="size-5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </Card>
        ))}
      </div>

      <footer className="mt-2 text-center text-xs text-muted-foreground">
        <p>
          {APP_NAME} v{APP_VERSION}
        </p>
      </footer>
    </div>
  );
}
