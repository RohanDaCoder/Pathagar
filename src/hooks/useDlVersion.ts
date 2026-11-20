/* hooks/useDlVersion.ts — subscribe React views to the download queue
   (the queue lives outside React; downloads continue while navigating). */

import { useSyncExternalStore } from "react";
import { DL } from "@/downloads";

export function useDlVersion(): number {
  return useSyncExternalStore(
    (cb) => DL.subscribe(cb),
    () => DL.version,
  );
}
