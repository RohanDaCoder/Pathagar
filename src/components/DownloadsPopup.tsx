/* components/DownloadsPopup.tsx — the download manager.
   A floating pill (fixed above the bottom nav) shows aggregate progress +
   network speed whenever jobs run; tapping it opens this popup with every
   job: per-chapter progress, MB moved, speed, ETA, cancel / retry. */

import { useSyncExternalStore } from "react";
import { useNavigate } from "react-router";
import { AlertCircle, Check, Download, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { S } from "@/config";
import { DL } from "@/dlqueue";
import { useDlVersion } from "@/hooks/useDlVersion";
import { fmtMB } from "@/lib/format";
import { parseBookName, stripLeadNum } from "@/lib/titles";

function fmtSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec < 1) return "—";
  if (bytesPerSec < 1024 * 1024)
    return `${Math.round(bytesPerSec / 1024)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

function fmtEta(loaded: number, total: number, speed: number): string {
  if (!speed || !total || loaded >= total) return "";
  const secs = Math.round((total - loaded) / speed);
  if (secs < 60) return `${secs}s left`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s left`;
}

export function DownloadsFloatingButton({ onOpen }: { onOpen: () => void }) {
  useDlVersion();
  const st = DL.stats();
  const active = st.downloading + st.queued + st.errors;
  if (!active) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="fixed inset-x-0 bottom-16 z-40 mx-auto flex w-fit max-w-[92vw] items-center gap-2 rounded-full border bg-background/95 py-2 pl-3 pr-4 text-sm shadow-lg backdrop-blur transition-colors hover:bg-muted/60"
      aria-label="Open downloads"
    >
      <span className="relative flex size-5 items-center justify-center">
        <Download className="size-4 text-primary" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        {st.downloading
          ? `Downloading ${st.downloading}${st.queued ? ` (+${st.queued} queued)` : ""}`
          : st.queued
            ? `${st.queued} queued`
            : `${st.errors} failed`}
      </span>
      {st.speed ? (
        <span className="tabular-nums text-muted-foreground">
          {fmtSpeed(st.speed)}
        </span>
      ) : null}
      {st.errors ? (
        <AlertCircle className="size-4 text-destructive" aria-hidden="true" />
      ) : null}
    </button>
  );
}

export function DownloadsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  useDlVersion();
  const navigate = useNavigate();
  const rows = [...DL.jobs.entries()]
    .map(([id, job]) => ({ id, job, st: S.dl.get(id) }))
    .filter((r) => r.st)
    .toSorted((a, b) => {
      const rank = { downloading: 0, queued: 1, error: 2, done: 3 } as const;
      return (rank[a.st!.status] ?? 9) - (rank[b.st!.status] ?? 9);
    });
  const stats = DL.stats();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Download className="size-4" aria-hidden="true" />
            Downloads
          </DialogTitle>
          <DialogDescription className="sr-only">
            Active, queued and finished chapter downloads
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto">
          {rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Nothing downloading. Pick a book and tap a chapter.
            </p>
          ) : (
            <ul className="divide-y">
              {rows.map(({ id, job, st }) => {
                const raw =
                  job.chapter.display || job.chapter.title || "Chapter";
                const title = stripLeadNum(raw) || raw;
                const isDone = st!.status === "done";
                const isError = st!.status === "error";
                const isDl = st!.status === "downloading";
                return (
                  <li key={id} className="flex items-center gap-3 px-4 py-3">
                    <span
                      className={
                        "flex size-8 shrink-0 items-center justify-center rounded-full " +
                        (isDone
                          ? "bg-primary/10 text-primary"
                          : isError
                            ? "bg-destructive/10 text-destructive"
                            : "bg-muted text-muted-foreground")
                      }
                      aria-hidden="true"
                    >
                      {isDone ? (
                        <Check className="size-4" />
                      ) : isError ? (
                        <AlertCircle className="size-4" />
                      ) : (
                        <Download className="size-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {(() => {
                          const bp = parseBookName(job.book.name);
                          return bp.tags.length
                            ? `${bp.name} · ${bp.tags.join(" · ")}`
                            : bp.name;
                        })()}
                      </p>
                      {isDl ? (
                        <div className="mt-1 flex items-center gap-2">
                          <Progress
                            value={st!.pct}
                            className="h-1.5 flex-1"
                            aria-label={`${title} progress`}
                          />
                          <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                            {st!.pct}%
                          </span>
                        </div>
                      ) : null}
                      <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                        {isDl
                          ? `${fmtMB(st!.loaded)}${st!.total ? ` / ${fmtMB(st!.total)}` : ""} · ${fmtSpeed(st!.speed ?? 0)} ${fmtEta(st!.loaded, st!.total, st!.speed ?? 0) ? `· ${fmtEta(st!.loaded, st!.total, st!.speed ?? 0)}` : ""}`
                          : isError
                            ? st!.error
                            : st!.status === "queued"
                              ? "Queued…"
                              : st!.size
                                ? `${fmtMB(st!.size)} · saved`
                                : "Saved"}
                      </p>
                    </div>
                    {isDl || st!.status === "queued" ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Cancel ${title}`}
                        onClick={() => DL.cancel(id)}
                      >
                        <X className="size-4" aria-hidden="true" />
                      </Button>
                    ) : isError ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Retry ${title}`}
                        onClick={() => DL.retry(id)}
                      >
                        <RotateCcw className="size-4" aria-hidden="true" />
                      </Button>
                    ) : isDone ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          onOpenChange(false);
                          void navigate(`/read/${id}`);
                        }}
                      >
                        Read
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {stats.downloading + stats.queued > 0 ? (
          <div className="border-t p-3">
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={() => DL.cancelAll()}
            >
              Cancel all
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/* shared open-state as a tiny external store — the queue (main.ts) can close
   the dialog directly when it auto-opens the reader, no DOM events involved */
let dlOpen = false;
const dlListeners = new Set<() => void>();
function notify() {
  for (const l of dlListeners) l();
}
export const dlDialog = {
  open() {
    if (!dlOpen) {
      dlOpen = true;
      notify();
    }
  },
  close() {
    if (dlOpen) {
      dlOpen = false;
      notify();
    }
  },
};
export function useDownloadsOpen(): [boolean, (o: boolean) => void] {
  const open = useSyncExternalStore(
    (cb) => {
      dlListeners.add(cb);
      return () => dlListeners.delete(cb);
    },
    () => dlOpen,
  );
  return [open, (o) => (o ? dlDialog.open() : dlDialog.close())];
}
