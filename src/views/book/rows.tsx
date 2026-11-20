/* views/book/rows.tsx — chapter-list rows: plain chapters, split-chapter
   parent rows, and the bare part rows of the /part/:major view. */

import { useNavigate } from "react-router";
import {
  Check,
  ChevronRight,
  Download,
  FileText,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DL } from "@/downloads";
import { fmtMB } from "@/lib/format";
import { bnNum, stripLeadNum } from "@/lib/titles";
import type { Book, Chapter } from "@/types";

export function SectionLabel({ text }: { text: string }) {
  return (
    <p className="px-1 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {text}
    </p>
  );
}

/* one list entry: a plain chapter, or a parent row for a split chapter */
export type Row =
  | { t: "ch"; ch: Chapter; book: Book }
  | {
      t: "grp";
      major: number;
      parts: Chapter[];
      whole?: Chapter;
      book: Book;
    };

/** Collapse decimal splits (২.১, ২.২ …) into parent rows when a book has
    "many splits of a single chapter" (≥ 4 parts); otherwise plain rows. */
export function buildRows(chs: Chapter[], bk: Book): Row[] {
  const numbered = chs.filter((c) => typeof c.num === "number");
  const decimals = numbered.filter((c) => (c.num ?? 0) % 1 !== 0);
  if (decimals.length < 4) return chs.map((ch) => ({ t: "ch", ch, book: bk }));
  const rows: Row[] = [];
  const majors = [
    ...new Set(numbered.map((c) => Math.floor(c.num ?? 0))),
  ].toSorted((a, b) => a - b);
  for (const maj of majors) {
    const whole = numbered.find((c) => c.num === maj);
    const parts = numbered.filter(
      (c) => Math.floor(c.num ?? 0) === maj && (c.num ?? 0) % 1 !== 0,
    );
    if (parts.length)
      rows.push({ t: "grp", major: maj, parts, whole, book: bk });
    else if (whole) rows.push({ t: "ch", ch: whole, book: bk });
  }
  for (const ch of chs)
    if (typeof ch.num !== "number") rows.push({ t: "ch", ch, book: bk });
  return rows;
}

/** Parent display: the first part's title without its "— অংশ N" suffix or
    its leading chapter number ("2. সেট ও ফাংশন — অংশ 1" → "সেট ও ফাংশন"). */
function parentTitle(parts: Chapter[]): string {
  const d = parts[0]?.display || "";
  const stripped = stripLeadNum(d.replace(/ ?— ?অংশ ?[০-৯0-9]+$/, "").trim());
  return stripped || bnNum(parts[0]?.label || "") || "Chapter";
}

/* right-hand status cluster shared by chapter and part rows */
function RowTail({ id, saved }: { id: string; saved: boolean }) {
  const st = DL.stateOf(id);
  const isDownloading = st?.status === "downloading";
  const isQueued = st?.status === "queued";
  const isError = st?.status === "error";
  if (isDownloading || isQueued)
    return (
      <Button
        size="icon"
        variant="ghost"
        aria-label="Cancel download"
        onClick={(e) => {
          e.stopPropagation();
          DL.cancel(id);
        }}
      >
        <X className="size-4" aria-hidden="true" />
      </Button>
    );
  if (saved || st?.status === "done")
    return (
      <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Check className="size-4" aria-hidden="true" />
      </span>
    );
  if (isError)
    return (
      <span className="flex size-8 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <RotateCcw className="size-4" aria-hidden="true" />
      </span>
    );
  return (
    <span className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <Download className="size-4" aria-hidden="true" />
    </span>
  );
}

export function ChapterRow({
  ch,
  book,
  saved,
  size,
}: {
  ch: Chapter;
  book: Book;
  saved: boolean;
  size?: number;
}) {
  const navigate = useNavigate();
  const id = String(ch.id);
  const st = DL.stateOf(id);
  const isDownloading = st?.status === "downloading";
  const isQueued = st?.status === "queued";
  const isError = st?.status === "error";
  const raw = ch.display || ch.title || "Chapter";
  const title = stripLeadNum(raw) || raw;
  return (
    <Card
      key={id}
      className={
        "flex cursor-pointer items-center gap-3 p-3 transition-colors " +
        (saved || st?.status === "done"
          ? "hover:bg-muted/50"
          : isError
            ? "border-destructive/40"
            : "")
      }
      onClick={() => {
        if (saved || st?.status === "done") void navigate(`/read/${id}`);
        else if (!isDownloading && !isQueued)
          DL.enqueue(ch, book, { autoOpen: true });
      }}
    >
      <span
        className="flex h-11 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary"
        aria-hidden="true"
      >
        {ch.label ? (
          <>
            <span className="text-[11px] font-medium leading-none opacity-80">
              {ch.label.split(" ")[0]}
            </span>
            <span className="text-base font-bold leading-tight">
              {bnNum(ch.label.split(" ").slice(1).join(" ")) || "·"}
            </span>
          </>
        ) : (
          <Sparkles className="size-4" aria-hidden="true" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          {ch.pages ? (
            <Badge
              variant="outline"
              className="gap-1 font-normal tabular-nums text-muted-foreground"
            >
              <FileText className="size-3" aria-hidden="true" />
              Page {ch.pages[0]}–{ch.pages[1]}
            </Badge>
          ) : null}
          {isDownloading ? (
            <div className="flex w-full items-center gap-2">
              <Progress value={st?.pct ?? 0} className="h-1.5 flex-1" />
              <span className="text-xs tabular-nums text-muted-foreground">
                {st?.pct ?? 0}%
              </span>
            </div>
          ) : null}
          {saved || st?.status === "done" ? (
            <Badge variant="secondary">
              ✓ Offline{size ? ` · ${fmtMB(size)}` : ""}
            </Badge>
          ) : null}
        </div>
      </div>
      <RowTail id={id} saved={saved} />
    </Card>
  );
}

export function GroupRow({
  group,
  savedIds,
}: {
  group: Extract<Row, { t: "grp" }>;
  savedIds: ReadonlySet<string>;
}) {
  const navigate = useNavigate();
  const first = group.parts[0];
  const word = first.label?.split(" ")[0] || "অধ্যায়";
  const savedCount = group.parts.filter((p) =>
    savedIds.has(String(p.id)),
  ).length;
  return (
    <Card
      key={`g-${group.book.id}-${group.major}`}
      className="flex cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-muted/50"
      onClick={() =>
        void navigate(`/book/${group.book.id}/part/${group.major}`)
      }
    >
      <span
        className="flex h-11 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary"
        aria-hidden="true"
      >
        <span className="text-[11px] font-medium leading-none opacity-80">
          {word}
        </span>
        <span className="text-base font-bold leading-tight">
          {bnNum(String(group.major))}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {parentTitle(group.parts)}
        </p>
        {savedCount === group.parts.length ? (
          <p className="text-xs text-muted-foreground">✓ Saved</p>
        ) : null}
      </div>
      <ChevronRight
        className="size-5 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
    </Card>
  );
}

/* bare part row for the /part/:major view — number, progress, state */
export function PartRow({
  ch,
  book,
  saved,
}: {
  ch: Chapter;
  book: Book;
  saved: boolean;
}) {
  const navigate = useNavigate();
  const id = String(ch.id);
  const st = DL.stateOf(id);
  const isDownloading = st?.status === "downloading";
  const isQueued = st?.status === "queued";
  const isError = st?.status === "error";
  return (
    <Card
      key={id}
      className={
        "flex items-center gap-3 p-3 transition-colors " +
        (saved || st?.status === "done"
          ? "cursor-pointer hover:bg-muted/50"
          : "")
      }
      onClick={() => {
        if (saved || st?.status === "done") {
          void navigate(`/read/${id}`);
        } else if (!isDownloading && !isQueued) {
          DL.enqueue(ch, book, { autoOpen: true });
        }
      }}
    >
      <span
        className="flex h-11 min-w-14 shrink-0 items-center justify-center rounded-lg bg-primary/10 px-2 text-base font-bold tabular-nums text-primary"
        aria-hidden="true"
      >
        {bnNum(String(ch.num ?? "·"))}
      </span>
      <div className="min-w-0 flex-1">
        {isDownloading ? (
          <Progress value={st?.pct ?? 0} className="h-1.5" />
        ) : isError ? (
          <span className="text-xs text-destructive">{st?.error}</span>
        ) : isQueued ? (
          <span className="text-xs text-muted-foreground">Queued…</span>
        ) : null}
      </div>
      <RowTail id={id} saved={saved} />
    </Card>
  );
}
