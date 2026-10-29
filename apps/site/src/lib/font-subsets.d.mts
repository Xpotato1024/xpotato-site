export function matchesUnicodeRange(codepoint: number, range: string): boolean;
export function selectFontFaces(source: string, textByFamily: Record<string, string>): string;
export function renderedFontText(html: string, options?: { searchCollection?: boolean }): Record<"Noto Serif" | "Noto Serif JP" | "Zen Kaku Gothic New", string>;
export function routeFontIntegration(): import("astro").AstroIntegration;
export function loadToolFontText(sourceRoot: URL): Promise<string>;
export function dynamicFontText(html: string, ui: {search: string; code: string; share?: string; prime?: string}): string;
