/* components/ErrorState.tsx — the inline error card every view uses when
   loading fails: plain-language message, the technical detail, a retry button. */

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({
  title,
  detail,
  onRetry,
}: {
  title: string;
  detail?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center"
    >
      <AlertTriangle className="size-8 text-destructive" aria-hidden="true" />
      <p className="font-semibold">{title}</p>
      {detail ? (
        <p className="max-w-sm text-sm text-muted-foreground">{detail}</p>
      ) : null}
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
