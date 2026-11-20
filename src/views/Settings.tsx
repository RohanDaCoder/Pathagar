/* views/Settings.tsx — connection, proxy, appearance, data, update check.
   Form structure follows the modern-web-guidance forms guide: real <form>,
   fieldset/legend groups, visible labels with help text, radio groups for the
   2–5-option choices (theme, concurrency), type="button" on secondary buttons. */

import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import {
  NATIVE,
  APP_NAME,
  APP_VERSION,
  REPO,
  S,
  DEFAULT_SETTINGS,
  saveSettings,
} from "@/config";
import { applyTheme } from "@/lib/theme";
import { apiGet } from "@/net";
import { DB } from "@/db";
import { checkForUpdate } from "@/updater";
import { storageEstimate } from "@/lib/storage";
import { errMessage } from "@/lib/errors";
import { fmtMB } from "@/lib/format";
import type { ApiEnvelope } from "@/catalog";

type UpdState = "idle" | "checking" | "latest" | "available";

export function Settings() {
  const st = S.settings;
  const [apiUrl, setApiUrl] = useState(st.apiUrl);
  const [apiKey, setApiKey] = useState(st.apiKey);
  const [showKey, setShowKey] = useState(false);
  const [proxyPrefix, setProxyPrefix] = useState(st.proxyPrefix);
  const [proxyOn, setProxyOn] = useState(st.proxyEnabled);
  const [testing, setTesting] = useState(false);
  const [updState, setUpdState] = useState<UpdState>("idle");
  const [est, setEst] =
    useState<Awaited<ReturnType<typeof storageEstimate>>>(null);

  useEffect(() => {
    void storageEstimate().then(setEst);
  }, []);

  async function applyAndTest(e: FormEvent) {
    e.preventDefault();
    S.settings.apiUrl = apiUrl.trim() || DEFAULT_SETTINGS.apiUrl;
    S.settings.apiKey = apiKey.trim() || DEFAULT_SETTINGS.apiKey;
    if (!NATIVE) {
      S.settings.proxyEnabled = proxyOn;
      S.settings.proxyPrefix = proxyPrefix.trim() || "/pdf/";
    }
    saveSettings();
    setTesting(true);
    try {
      const d = await apiGet<ApiEnvelope<unknown>>("categories", {
        parent: 18203,
        limit: 1,
      });
      toast.success(
        `Settings saved — API is working (${(d.data || []).length} item)`,
      );
    } catch (err) {
      toast.error(`API test failed: ${errMessage(err)}`, {
        description: "The settings were saved, but the test request failed.",
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6">
      <nav className="mb-1 flex items-center gap-1 text-sm text-muted-foreground">
        <Link to="/" className="inline-flex items-center gap-1 hover:underline">
          <ChevronLeft className="size-4" aria-hidden="true" /> Home
        </Link>
      </nav>
      <h1 className="mb-4 text-xl font-bold">Settings</h1>

      <form onSubmit={applyAndTest} className="grid gap-4">
        <fieldset className="grid gap-3">
          <legend className="mb-1 text-sm font-semibold">Connection</legend>
          <Card className="grid gap-4 p-4">
            <div className="grid gap-1.5">
              <Label htmlFor="s-api">API URL</Label>
              <Input
                id="s-api"
                name="apiUrl"
                type="url"
                spellCheck={false}
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                aria-describedby="s-api-help"
              />
              <p id="s-api-help" className="text-xs text-muted-foreground">
                The original app's backend (Laravel).
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="s-key">API key</Label>
              <div className="flex gap-2">
                <Input
                  id="s-key"
                  name="apiKey"
                  type={showKey ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  aria-describedby="s-key-help"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowKey((v) => !v)}
                >
                  {showKey ? "Hide" : "Show"}
                </Button>
              </div>
              <p id="s-key-help" className="text-xs text-muted-foreground">
                If the key changes (403 errors), extract the new key from the
                latest APK and paste it here.
              </p>
            </div>
            <div>
              <Button type="submit" disabled={testing}>
                {testing ? "Testing…" : "Save & test"}
              </Button>
            </div>
          </Card>
        </fieldset>

        {!NATIVE ? (
          <fieldset className="grid gap-3">
            <legend className="mb-1 text-sm font-semibold">
              Web proxy (PDF)
            </legend>
            <Card className="grid gap-4 p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Use proxy</p>
                  <p className="text-xs text-muted-foreground">
                    The PDF server has no CORS — files are fetched through
                    Netlify's <code>/pdf/*</code> reverse proxy.
                  </p>
                </div>
                <input
                  id="s-proxy"
                  name="useProxy"
                  type="checkbox"
                  className="size-4 accent-(--color-primary) md:size-4"
                  checked={proxyOn}
                  onChange={(e) => setProxyOn(e.target.checked)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="s-pp">Proxy path</Label>
                <Input
                  id="s-pp"
                  name="proxyPrefix"
                  spellCheck={false}
                  value={proxyPrefix}
                  onChange={(e) => setProxyPrefix(e.target.value)}
                />
              </div>
            </Card>
          </fieldset>
        ) : null}

        <fieldset className="grid gap-3">
          <legend className="mb-1 text-sm font-semibold">Downloads</legend>
          <Card className="p-4">
            <RadioGroup
              name="concurrency"
              value={String(st.concurrency)}
              onValueChange={(v) => {
                S.settings.concurrency = Number.parseInt(v, 10) || 2;
                saveSettings();
              }}
              className="grid grid-cols-4 gap-2"
            >
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="flex items-center gap-2">
                  <RadioGroupItem value={String(n)} id={`s-conc-${n}`} />
                  <Label htmlFor={`s-conc-${n}`}>{n}</Label>
                </div>
              ))}
            </RadioGroup>
            <p className="mt-2 text-xs text-muted-foreground">
              Chapters downloaded at the same time.
            </p>
          </Card>
        </fieldset>

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
      </form>

      <fieldset className="mt-4 grid gap-3">
        <legend className="mb-1 text-sm font-semibold">App update</legend>
        <Card className="flex items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {APP_NAME} v{APP_VERSION}
            </p>
            <p className="text-xs text-muted-foreground">
              When a new version is out, a banner appears on Home (from GitHub
              Releases).
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={updState === "checking"}
            onClick={() => {
              setUpdState("checking");
              void (async () => {
                const u = await checkForUpdate();
                if (u) {
                  setUpdState("available");
                  window.open(u.apkUrl, "_blank", "noopener");
                } else {
                  setUpdState("latest");
                }
              })();
            }}
          >
            {updState === "checking" ? "Checking…" : "Check for update"}
          </Button>
          {updState === "latest" ? (
            <Badge variant="secondary">Up to date</Badge>
          ) : null}
        </Card>
      </fieldset>

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
            {APP_NAME} v{APP_VERSION} · <code>{REPO}</code>
          </p>
          <p className="mt-2">
            A lightweight client for reading Class 9-10 guide books — Android
            and web from one codebase.
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
