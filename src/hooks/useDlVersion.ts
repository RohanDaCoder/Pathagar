/* hooks/useDlVersion.ts — subscribe React views to the download queue.
   The queue lives outside React (downloads continue while navigating); views
   re-render on every queue update via a version counter + useSyncExternalStore. */

import { useSyncExternalStore } from "react";
import { DL } from "@/dlqueue";

let version = 0;
const listeners = new Set<() => void>();

DL.onRowUpdate = () => {
  version++;
  for (const l of listeners) l();
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDlVersion(): number {
  return useSyncExternalStore(subscribe, () => version);
}
