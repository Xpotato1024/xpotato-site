export interface EditorShellFile {
  path: string;
  bytes: number;
  sha256: string;
}
export function editorShellInventory(dist: string): Promise<EditorShellFile[]>;
export interface EditorPwaOptions {
  lazyFontPaths?: readonly string[];
}
export function editorWorkerSource(files: EditorShellFile[], options?: EditorPwaOptions): string;
export function buildEditorPwa(
  dist: string,
  options?: EditorPwaOptions,
): Promise<{ files: number; bytes: number }>;
