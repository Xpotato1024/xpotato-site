import type { Locator, Page } from "playwright";
import type { LocalDraft } from "../../apps/editor/src/data/storage.js";
export function ensureEditing(page: Page): Promise<void>;
export function goHome(page: Page): Promise<void>;
export function sourceEditor(page: Page): Promise<Locator>;
export function readBody(page: Page): Promise<string>;
export function writeBody(page: Page, body: string): Promise<Locator>;
export function showBlocks(page: Page): Promise<void>;
export function panel(page: Page, label: string, content: Locator): Promise<void>;
export function closePanel(page: Page): Promise<void>;
export function savedDraft(
  page: Page,
  expected?: { source?: string; annotationCount?: number },
): Promise<LocalDraft>;
