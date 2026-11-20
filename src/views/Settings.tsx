/* views/Settings.tsx — appearance, install, data, about.
   Technical settings are gone from the UI on purpose: the API URL, API key
   and PDF proxy prefix are porting constants in src/config.ts (the file we
   re-point when moving the backend). PWA-only app: it is always the latest
   version the moment it is deployed. */

import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { APP_NAME, APP_VERSION, S, saveSettings } from "@/config";
import { applyTheme } from "@/lib/theme";
import { DB } from "@/db";
import { storageEstimate } from "@/lib/storage";
import { fmtMB } from "@/lib/format";

export function Settings() {
  const st = S.settings;
  const [est, setEst] =
    useState<Awaited<ReturnType<typeof storageEstimate>>>(null);
  const { canInstall, install } = useInstallPrompt();

  useEffect(() => {
    void storageEstimate().then(setEst);
  }, []);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6">
      <nav className="mb-1 flex items-center gap-1 text-sm text-muted-foreground">
        <Link to="/" className="inline-flex items-center gap-1 hover:underline">
          <ChevronLeft className="size-4" aria-hidden="true" /> Home
        </Link>
      </nav>
      <h1 className="mb-4 text-xl font-bold">Settings</h1>

      <fieldset className="grid gap-3">
        <legend className="mb-1 text-sm font-semibold">Appearance</legend>
        <Card className="p-4">
          <RadioGroup
            name="theme"
            value={st.theme}
            onValueChange={(v) => {
              S.settings.theme = v;
              saveSettings();
              applyTheme(v);
            }}
            className="grid grid-cols-3 gap-2"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="auto" id="s-theme-auto" />
              <Label htmlFor="s-theme-auto">System</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="light" id="s-theme-light" />
              <Label htmlFor="s-theme-light">Light</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="dark" id="s-theme-dark" />
              <Label htmlFor="s-theme-dark">Dark</Label>
            </div>
          </RadioGroup>
        </Card>
      </fieldset>

      {canInstall ? (
        <fieldset className="mt-4 grid gap-3">
          <legend className="mb-1 text-sm font-semibold">Install app</legend>
          <Card className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Add to home screen</p>
              <p className="text-xs text-muted-foreground">
                Full-screen, offline, with your downloaded library.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                void (async () => {
                  const outcome = await install();
                  if (outcome === "accepted")
                    toast.success("Pathagar was installed");
                })();
              }}
            >
              Install
            </Button>
          </Card>
        </fieldset>
      ) : null}

      <fieldset className="mt-4 grid gap-3">
        <legend className="mb-1 text-sm font-semibold">Data</legend>
        <Card className="grid gap-3 p-4 text-sm">
          <p className="text-muted-foreground">
            {est
              ? `Used: ${fmtMB(est.usage)} / ${fmtMB(est.quota)}`
              : "Storage usage unavailable."}
          </p>
          <div>
            <Button
              type="button"
              variant="outline"
              className="text-destructive"
              onClick={() => {
                void (async () => {
                  await DB.clearAll();
                  toast.success("All downloads deleted");
                  setEst(await storageEstimate());
                })();
              }}
            >
              Delete all downloads
            </Button>
          </div>
        </Card>
      </fieldset>

      <fieldset className="mt-4 grid gap-3">
        <legend className="mb-1 text-sm font-semibold">About</legend>
        <Card className="p-4 text-sm leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground">
            {APP_NAME} v{APP_VERSION}
          </p>
          <p className="mt-2">
            A lightweight PWA for reading Class 9-10 guide books — install it on
            your phone or desktop (see "Install app" above) and it works offline
            like a native app. The web app is always the latest version —
            nothing to update manually.
          </p>
          <p className="mt-2">
            The catalog and PDFs come from the original “Class 9 All Subject
            Books” app's server (reverse-engineered with apkscope). For
            students' personal study only — the books belong to their
            publishers. If you like it, use the original app too.
          </p>
        </Card>
      </fieldset>
    </div>
  );
}
