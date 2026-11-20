/* downloads/ — the download manager singleton. */

import { DownloadQueue } from "./queue";

export const DL = new DownloadQueue();
export { DownloadQueue, type DlJob } from "./queue";
