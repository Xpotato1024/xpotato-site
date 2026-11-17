export const tokenSource: string;
export function loadDesignTokens(): Promise<{
  resolve: (name: string) => string;
  values: Map<string, string>;
  css: string;
  sha256: string;
}>;
export function technicalVisualTheme(): Promise<{
  id: string;
  background: string;
  foreground: string;
  muted: string;
  grid: string;
  accent: string;
  font: string;
  fontSize: number;
  sha256: string;
  tokenSourceSha256: string;
}>;
