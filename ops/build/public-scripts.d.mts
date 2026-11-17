import type { AstroIntegration } from "astro";
export function compilePublicScript(name: string, source: string): string;
export function readPublicScript(name: string): Promise<Buffer>;
export function publicScriptIntegration(): AstroIntegration;
