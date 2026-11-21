/* components/UpdatePopup.tsx — info/warn popup shown when a new service
   worker takes control (autoUpdate). The app reloads itself so every user
   runs the latest version, but the reload is announced with a short
   countdown instead of happening silently mid-reading. */

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const AUTO_RELOAD_MS = 4000;

export function UpdatePopup({ onReload }: { onReload: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [left, setLeft] = useState(AUTO_RELOAD_MS / 1000);

  useEffect(() => {
    timer.current = setTimeout(onReload, AUTO_RELOAD_MS);
    const tick = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      clearInterval(tick);
    };
  }, [onReload]);

  return (
    <output
      aria-live="polite"
      className="fixed inset-x-4 bottom-4 z-[100] mx-auto block max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300"
    >
      <div className="rounded-2xl border border-amber-500/40 bg-card p-4 shadow-xl">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <RefreshCw className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Update installed</p>
            <p className="text-sm text-muted-foreground">
              A new version of Pathagar is ready — reloading in {left}s…
            </p>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            onClick={() => {
              if (timer.current) clearTimeout(timer.current);
              onReload();
            }}
          >
            Reload now
          </Button>
        </div>
      </div>
    </output>
  );
}
