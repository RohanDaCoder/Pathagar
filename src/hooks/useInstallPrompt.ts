/* hooks/useInstallPrompt.ts — PWA install flow.
   Follows the modern-web-guidance install-web-app guide: prefer navigator.install()
   when supported, otherwise the captured beforeinstallprompt (Android Chrome).
   The event is single-use — it is saved and cleared before awaiting the user's
   choice, and the affordance only appears once an install mechanism is
   confirmed (never a dead button). */

import { useCallback, useEffect, useState } from "react";
import { NATIVE } from "@/config";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const dismissedKey = "ptg:installDismissed";

export interface InstallState {
  canInstall: boolean;
  install: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

export function useInstallPrompt(onSuggest?: () => void): InstallState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [supportsWebInstall] = useState(
    () =>
      typeof navigator !== "undefined" &&
      "install" in Navigator.prototype &&
      typeof Navigator.prototype.install === "function",
  );

  useEffect(() => {
    if (NATIVE) return undefined;
    const onBip = (e: Event) => {
      e.preventDefault();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- browser event boundary (not in lib.dom)
      setDeferred(e as BeforeInstallPromptEvent);
      // suggest the install once, only if the user never dismissed it
      if (onSuggest && !localStorage.getItem(dismissedKey)) onSuggest();
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, [onSuggest]);

  const install = useCallback(async () => {
    if (supportsWebInstall) {
      try {
        await navigator.install();
        return "accepted" as const;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError")
          return "dismissed" as const;
        console.error(error);
        return "unavailable" as const;
      }
    }
    if (!deferred) return "unavailable" as const;
    // single-use event: clear it before awaiting the user's choice
    const promptEvent = deferred;
    setDeferred(null);
    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      return outcome;
    } catch (error) {
      console.error(error);
      return "unavailable" as const;
    }
  }, [deferred, supportsWebInstall]);

  return { canInstall: supportsWebInstall || deferred !== null, install };
}

export function dismissInstallSuggestion() {
  localStorage.setItem(dismissedKey, "1");
}
