export type PresentationSurface = { elements: Record<string,number>; rules: string[]; conditions: string[]; script: string[] };
export function inspectPresentation(path: string, source: string): Promise<PresentationSurface>;
export function collectPresentation(root: string): Promise<Record<string, PresentationSurface>>;
export function checkPresentation(root: string, options?: {write?:boolean}): Promise<number>;
