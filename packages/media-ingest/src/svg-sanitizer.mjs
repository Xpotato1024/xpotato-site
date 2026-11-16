// Shared existing sanitizer. Renderer-specific restrictions belong to the renderer.
const normalizedSvg = source => source.replaceAll("\r\n", "\n").replaceAll("\r", "\n").trimEnd() + "\n";

export const sanitizeSvg = source => {
  const normalized = normalizedSvg(source);
  if (!/^\s*<svg\b/iu.test(normalized)) throw new Error("SVG source must begin with an svg element");
  if (!/\bviewBox\s*=\s*["'][^"']+["']/iu.test(normalized)) throw new Error("SVG source requires a viewBox");
  if (/<(?:script|foreignObject)\b/iu.test(normalized)) throw new Error("SVG active content is forbidden");
  if (/\son[a-z]+\s*=/iu.test(normalized)) throw new Error("SVG event handlers are forbidden");
  if (/\b(?:href|src)\s*=\s*["']\s*(?:https?:|data:|javascript:|\/\/)/iu.test(normalized)) throw new Error("SVG external references are forbidden");
  if (/url\(\s*["']?\s*(?:https?:|data:|\/\/)/iu.test(normalized)) throw new Error("SVG external CSS references are forbidden");
  return normalized;
};
