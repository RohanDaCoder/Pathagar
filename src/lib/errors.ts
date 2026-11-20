/* lib/errors.ts — catch-clause helpers (catch params are `unknown` under strict TS) */
import { ApiError } from "@/net";

export function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function errStatus(e: unknown): number | undefined {
  return e instanceof ApiError ? e.status : undefined;
}
