export interface EditorShellFile {
  path: string;
  bytes: number;
  sha256: string;
}
export function editorShellInventory(dist: string): Promise<EditorShellFile[]>;
export function editorWorkerSource(files: EditorShellFile[]): string;
export function buildEditorPwa(dist: string): Promise<{ files: number; bytes: number }>;
