/* lib/streamStyle.ts — per-stream accent (icon + literal tailwind classes)
   for the redesign: every subject stream gets a stable hue used on group
   headers, subject cards and chips. Class strings are literal (Tailwind has
   no runtime); the record covers the full Stream union. */

import {
  BookOpen,
  Briefcase,
  FlaskConical,
  Landmark,
  MoonStar,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { Stream } from "./titles";

export interface StreamStyle {
  icon: LucideIcon;
  /** icon chip background + icon color */
  chip: string;
  /** group heading text color */
  label: string;
  /** thin colored strip on top of subject cards */
  strip: string;
}

export const STREAM_STYLE: Record<Stream, StreamStyle> = {
  compulsory: {
    icon: BookOpen,
    chip: "bg-teal-500/15 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300",
    label: "text-teal-700 dark:text-teal-300",
    strip: "bg-teal-500",
  },
  science: {
    icon: FlaskConical,
    chip: "bg-indigo-500/15 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300",
    label: "text-indigo-700 dark:text-indigo-300",
    strip: "bg-indigo-500",
  },
  business: {
    icon: Briefcase,
    chip: "bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
    label: "text-amber-700 dark:text-amber-300",
    strip: "bg-amber-500",
  },
  humanities: {
    icon: Landmark,
    chip: "bg-rose-500/15 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300",
    label: "text-rose-700 dark:text-rose-300",
    strip: "bg-rose-500",
  },
  religion: {
    icon: MoonStar,
    chip: "bg-violet-500/15 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
    label: "text-violet-700 dark:text-violet-300",
    strip: "bg-violet-500",
  },
  extra: {
    icon: Sparkles,
    chip: "bg-sky-500/15 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
    label: "text-sky-700 dark:text-sky-300",
    strip: "bg-sky-500",
  },
};
