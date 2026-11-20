/* branches.ts — SSOT for guide branches: UI labels and which branches ship.
   make-snapshot.ts regenerates from this list; the Home grid renders
   whatever the snapshot contains. */

export interface BranchDef {
  readonly id: number;
  readonly label: string;
  /** Hidden branches are excluded from the shipped snapshot. */
  readonly hidden?: boolean;
}

export const BRANCHES: readonly BranchDef[] = [
  { id: 18203, label: "Bangla Version (SSC 2028)" },
  { id: 17786, label: "মাদ্রাসার গাইড (Madrasah Guide)" },
  { id: 17794, label: "English Version (Nine)" },
  {
    id: 101,
    label: "নবম শ্রেণীর গাইড, পুরাতন (Older guide set)",
    hidden: true,
  },
];
