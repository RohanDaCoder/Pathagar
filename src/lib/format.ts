/* lib/format.ts — display formatting.
   `bn` kept the historical name (it used to render Bengali digits); the UI is
   English now, so it passes values through unchanged. */

export const bn = (n: string | number): string => String(n);

export const fmtMB = (bytes: number): string =>
  `${bn((bytes / 1048576).toFixed(1))} MB`;
