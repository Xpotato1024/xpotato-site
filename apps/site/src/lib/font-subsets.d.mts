export function matchesUnicodeRange(codepoint: number, range: string): boolean;
export function selectFontFaces(source: string, textByFamily: Record<string, string>, preferredSource?: string): string;
export function compactArticleHeadingRanges(css: string, textByFamily: Record<string, string>): string;
export function renderedFontText(html: string, options?: { searchCollection?: boolean }): Record<"Noto Serif" | "Noto Serif JP" | "Zen Kaku Gothic New", string>;
export function routeFontIntegration(): import("astro").AstroIntegration;
export function loadToolFontText(sourceRoot: URL): Promise<string>;
export function dynamicFontText(html: string, ui: {search: string; code: string; share?: string; prime?: string; updates?: string; tools?: Record<string, string>}): string;
