/* lib/format.ts — display formatting. */

export const fmtMB = (bytes: number): string =>
  `${(bytes / 1048576).toFixed(1)} MB`;
