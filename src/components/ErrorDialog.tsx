/* components/ErrorDialog.tsx — the unexpected-error popup: title, plain-language
   explanation, technical detail behind a disclosure, and a clear way out.
   Used for failures the user can't act on inline (e.g. the reader failing to
   open a file) and by the root error boundary. */

import { useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function ErrorDialog({
  open,
  onOpenChange,
  title,
  message,
  detail,
  actionLabel,
  onAction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle
              className="size-5 shrink-0 text-destructive"
              aria-hidden="true"
            />
            {title}
          </DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        {detail ? (
          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto w-full justify-between px-2 py-1.5 text-xs text-muted-foreground"
              aria-expanded={showDetail}
              onClick={() => setShowDetail((v) => !v)}
            >
              Technical details
              <ChevronDown
                className={
                  "size-4 transition-transform " +
                  (showDetail ? "rotate-180" : "")
                }
                aria-hidden="true"
              />
            </Button>
            {showDetail ? (
              <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-muted p-2 text-left text-xs whitespace-pre-wrap">
                {detail}
              </pre>
            ) : null}
          </div>
        ) : null}
        <DialogFooter className="flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {actionLabel && onAction ? (
            <Button
              onClick={() => {
                onOpenChange(false);
                onAction();
              }}
            >
              {actionLabel}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
