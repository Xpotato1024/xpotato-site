const forbiddenPatterns: readonly Readonly<{ pattern: RegExp; reason: string }>[] = [
  { pattern: /\b(?:https?:\/\/[^\s"')]*\.r2\.dev|r2:\/\/)/iu, reason: "R2/provider URL" },
  { pattern: /\bmedia\/v1\/objects\/sha256\//u, reason: "provider object key" },
  { pattern: /^\s*(?:import|export)\s/mu, reason: "arbitrary runtime import/export" },
  { pattern: /\bclient:(?:load|idle|visible|media|only)\b/u, reason: "content-owned hydration directive" },
  { pattern: /<Demo\b[^>]*\bmoduleId\s*=/u, reason: "non-frozen Demo moduleId prop" },
  { pattern: /<Figure\b[^>]*\bassetId\s*=/u, reason: "non-frozen Figure assetId prop" },
  { pattern: /(?:\.\.\/)+(?:components|src)\//u, reason: "React/filesystem implementation path" },
  { pattern: /\b(?:canonical|og:image|sitemap|searchIndex)\s*=/u, reason: "hand-maintained discovery/SEO state" },
  { pattern: /class(?:Name)?\s*=\s*["'][^"']*(?:grid-cols-|col-span-|w-\[|left-\[)/u, reason: "article-owned layout sprawl" },
];

export const validatePortableMdx = (source: string): readonly string[] =>
  forbiddenPatterns.filter(({ pattern }) => pattern.test(source)).map(({ reason }) => reason);
