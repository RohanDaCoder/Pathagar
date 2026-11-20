/* views/Library.tsx — offline library grouped by book; delete via AlertDialog
   (destructive actions get an explicit confirmation with focus on the safe
   action) */

import { useEffect, useState } from "react";
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
import { storageEstimate } from "@/lib/storage";
import { DB } from "@/db";
import { fmtMB } from "@/lib/format";
import { parseBookName, stripLeadNum } from "@/lib/titles";
import type { ChapterMeta } from "@/types";

export function Library() {
  const [metas, setMetas] = useState<ChapterMeta[] | null>(null);
  const [est, setEst] =
    useState<Awaited<ReturnType<typeof storageEstimate>>>(null);
  const [confirmDelete, setConfirmDelete] = useState<ChapterMeta | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [m, e] = await Promise.all([DB.allMeta(), storageEstimate()]);
      if (cancelled) return;
      setMetas(m.toSorted((a, b) => (b.addedAt || 0) - (a.addedAt || 0)));
      setEst(e);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-effect-dependencies -- reload is an intentional refetch trigger
  }, [reload]);

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
      <h1 className="text-xl font-bold">My Library</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        {(metas ?? []).length} chapters · {fmtMB(totalMB)}
      </p>

      {est ? (
        <Card className="mb-4 p-4 text-sm">
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
              variant="ghost"
              className="text-destructive"
              onClick={() => setConfirmClear(true)}
            >
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
                if (m)
                  void DB.delFile(m.id).then(() => setReload((n) => n + 1));
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
                void DB.clearAll().then(() => setReload((n) => n + 1));
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
