/* components/InstallSuggestion.tsx — the Android install popup.
   Shown when the browser confirms the app is installable (beforeinstallprompt,
   i.e. Android Chrome / Chromium) and the user hasn't dismissed it before. */

import { useCallback, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  dismissInstallSuggestion,
  useInstallPrompt,
} from "@/hooks/useInstallPrompt";

export function InstallSuggestion() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const suggest = useCallback(() => setOpen(true), []);
  const { canInstall, install } = useInstallPrompt(suggest);

  if (!canInstall) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="size-5 shrink-0" aria-hidden="true" />
            Install Pathagar
          </DialogTitle>
          <DialogDescription>
            Add Pathagar to your home screen — it opens full-screen like an
            Android app, works offline, and your downloaded library comes with
            it.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => {
              dismissInstallSuggestion();
              setOpen(false);
            }}
          >
            Not now
          </Button>
          <Button
            aria-disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const outcome = await install();
                if (outcome === "accepted")
                  toast.success("Pathagar was installed");
                else if (outcome === "dismissed") dismissInstallSuggestion();
                setOpen(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            Install
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
