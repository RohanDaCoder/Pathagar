/* views/Home.tsx — branch cards, library shortcut, footer */

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { BookOpen, ChevronRight, Library } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { APP_NAME, APP_VERSION } from "@/config";
import { catalog } from "@/catalog";
import { DB } from "@/db";
import { fmtMB } from "@/lib/format";

export function Home() {
  const navigate = useNavigate();
  const snap = catalog.snapshot;
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

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pb-24 pt-6">
      <header className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground">
          P
        </div>
        <div>
          <h1 className="text-xl font-bold">{APP_NAME}</h1>
          <p className="text-sm text-muted-foreground">
            Class 9-10 guide books · offline library
          </p>
        </div>
      </header>

      {meta && meta.length > 0 ? (
        <Link to="/library" className="block">
          <Card className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/50">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
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
        {snap.branches.map((b) => (
          <Card
            key={b.id}
            className="flex cursor-pointer items-center gap-3 p-4 transition-colors hover:bg-muted/50"
            onClick={() => void navigate(`/branch/${b.id}`)}
          >
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BookOpen className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-semibold">
                {b.label.replace(/\s*\(.*?\)\s*$/, "")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {b.books.length} books · {b.total_chapters} chapters
              </p>
              {savedByBranch.get(String(b.id)) ? (
                <Badge variant="secondary" className="mt-1">
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

      <footer className="mt-4 text-center text-xs text-muted-foreground">
        <p>
          {APP_NAME} v{APP_VERSION}
        </p>
      </footer>
    </div>
  );
}
