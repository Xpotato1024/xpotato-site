import type { BrowserToolPin } from "@xpotato/content-contracts";

// Real reviewed releases only. Synthetic acceptance fixtures remain under .local/.
export const browserToolReleases: readonly BrowserToolPin[] = Object.freeze([]);

// Explicit raw browser-tool.json imports, keyed by toolId:releaseId. Only selected releases need display metadata.
export const browserToolManifestSources: Readonly<Record<string,string>> = Object.freeze({});
