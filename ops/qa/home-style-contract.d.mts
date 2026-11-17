export const homeStyleTokens: string[];
export function inspectHomeStyleContract(dist: string, html: string): Promise<{ sources: { path: string; sha256: string }[]; tokens: Record<string, string>; scope: string }>;
