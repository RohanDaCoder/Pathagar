/* views/Library.tsx — offline library grouped by book; delete via AlertDialog
   (destructive actions get an explicit confirmation with focus on the safe
   action) */

import { useCallback, useState } from "react";
import { Link } from "react-router";
import { ChevronLeft, FileText, Play, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAsyncData } from "@/hooks/useAsyncData";
import { storageEstimate } from "@/lib/storage";
import { DB } from "@/db";
import { fmtMB } from "@/lib/format";
import { parseBookName, stripLeadNum } from "@/lib/titles";
import type { ChapterMeta } from "@/types";

export function Library() {
  const fetchLibrary = useCallback(async () => {
    const [m, e] = await Promise.all([DB.allMeta(), storageEstimate()]);
    return {
      metas: m.toSorted((a, b) => (b.addedAt || 0) - (a.addedAt || 0)),
      est: e,
    };
  }, []);
  const { data, reload } = useAsyncData(fetchLibrary);
  const metas = data?.metas ?? null;
  const est = data?.est ?? null;
  const [confirmDelete, setConfirmDelete] = useState<ChapterMeta | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const groups = new Map<string, ChapterMeta[]>();
  for (const m of metas ?? []) {
    const g = groups.get(m.bookName) ?? [];
    g.push(m);
    groups.set(m.bookName, g);
  }
  const totalMB = (metas ?? []).reduce((a, m) => a + (m.size || 0), 0);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6">
      <nav className="mb-1 flex items-center gap-1 text-sm text-muted-foreground">
        <Link to="/" className="inline-flex items-center gap-1 hover:underline">
          <ChevronLeft className="size-4" aria-hidden="true" /> Home
        </Link>
      </nav>
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
          <FileText className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-xl font-bold">My Library</h1>
          <p className="text-sm text-muted-foreground">
            {(metas ?? []).length} chapters · {fmtMB(totalMB)}
          </p>
        </div>
      </div>

      {est ? (
        <Card className="mb-4 border-primary/30 bg-primary/5 p-4 text-sm">
          <p className="font-medium">
            Storage — {fmtMB(est.usage)} / {fmtMB(est.quota)}
          </p>
          <p className="mt-1 text-muted-foreground">
            Downloaded chapters can be read without internet.
          </p>
        </Card>
      ) : null}

      {!metas ? (
        <div className="grid gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : metas.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <p className="font-semibold">Library is empty</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Pick a guide on Home and download its chapters — then read them
            offline here.
          </p>
          <Button asChild className="mt-1">
            <Link to="/">Browse books</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {[...groups.entries()].map(([gname, items]) => (
            <section key={gname}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <FileText className="size-4" aria-hidden="true" />
                <span className="truncate">
                  {(() => {
                    const bp = parseBookName(gname);
                    return bp.tags.length
                      ? `${bp.name} · ${bp.tags.join(" · ")}`
                      : bp.name;
                  })()}
                </span>
                <span className="ml-auto shrink-0 font-normal">
                  {items.length} chapters
                </span>
              </h2>
              <div className="grid gap-2">
                {items.map((m) => (
                  <Card
                    key={m.id}
                    className="flex cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-muted/50"
                    onClick={() => {
                      localStorage.setItem("ptg:lastRead", m.id);
                      void DB.updateMeta(m.id, { lastOpened: Date.now() });
                      window.location.hash = `#/read/${m.id}`;
                    }}
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="size-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {stripLeadNum(m.title) || m.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {fmtMB(m.size || 0)} ·{" "}
                        {new Date(m.addedAt).toLocaleDateString("en-GB")}
                      </p>
                    </div>
                    <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Play className="size-4" aria-hidden="true" />
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Delete ${m.title}`}
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete(m);
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </Card>
                ))}
              </div>
            </section>
          ))}
          <div className="flex justify-center pt-2">
            <Button
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => setConfirmClear(true)}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Delete all downloads
            </Button>
          </div>
        </div>
      )}

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chapter?</AlertDialogTitle>
            <AlertDialogDescription>
              “{confirmDelete?.title}” ({fmtMB(confirmDelete?.size || 0)}) will
              be removed from your offline library. You can download it again
              anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel autoFocus>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                const m = confirmDelete;
                setConfirmDelete(null);
                if (m) void DB.delFile(m.id).then(reload);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all downloads?</AlertDialogTitle>
            <AlertDialogDescription>
              All {metas?.length ?? 0} chapters ({fmtMB(totalMB)}) will be
              removed from this device.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel autoFocus>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                setConfirmClear(false);
                void DB.clearAll().then(reload);
              }}
            >
              Delete all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
