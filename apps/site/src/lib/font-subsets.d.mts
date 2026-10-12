export function matchesUnicodeRange(codepoint: number, range: string): boolean;
export function selectFontFaces(source: string, textByFamily: Record<string, string>): string;
export function renderedFontText(html: string): Record<"Noto Serif" | "Noto Serif JP" | "Zen Kaku Gothic New", string>;
export function routeFontIntegration(): import("astro").AstroIntegration;
