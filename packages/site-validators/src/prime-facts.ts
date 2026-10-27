import type { BrowserToolUiCapabilities } from "@xpotato/content-contracts";
import { parse, type DefaultTreeAdapterMap } from "parse5";
type Node = DefaultTreeAdapterMap["node"];
const attr = (n: Node, key: string) => "attrs" in n ? n.attrs.find(a => a.name === key)?.value : undefined;
const nodes = (n: Node): Node[] => ["tagName" in n ? [n] : [], "childNodes" in n ? n.childNodes.flatMap(nodes) : []].flat();
const visible = (n: Node): string => "tagName" in n && (["script", "style", "astro-island"].includes(n.tagName) || attr(n, "hidden") !== undefined || (n.tagName === "details" && attr(n, "open") === undefined)) ? "" : "value" in n ? n.value : "childNodes" in n ? n.childNodes.map(visible).join("") : "";
export function validatePrimeFacts(html: string, capabilities: BrowserToolUiCapabilities | undefined): string[] {
  if (!capabilities) return ["prime facts: selected capabilities missing"];
  const all = nodes(parse(html)), main = all.find(n => "tagName" in n && n.tagName === "main");
  const achievement = all.find(n => attr(n, "data-prime-achievement") !== undefined);
  const facts = all.find(n => attr(n, "data-prime-facts") !== undefined);
  const island = all.find(n => "tagName" in n && n.tagName === "astro-island");
  const text = main ? visible(main) : "", errors: string[] = [];
  if (!achievement || !island || all.indexOf(achievement) > all.indexOf(island) || !text.includes("過去の実験版の1試行。現行公開版の速度保証ではありません。")) errors.push("prime facts: qualified achievement must precede the tool");
  if (!facts || !text.includes("入力欄に長い値を貼り付けられることと、計算を受け付けることは別")) errors.push("prime facts: always-visible acceptance explanation missing");
  if (!facts || !island || all.indexOf(facts) < all.indexOf(island)) errors.push("prime facts: facts must follow the tool");
  if (!text.includes(capabilities.input.maxTextLength.toLocaleString("ja-JP") + "文字")) errors.push("prime facts: text length differs from selected release");
  for (const mode of capabilities.modes) {
    if (!text.includes(mode.maxDigits + "桁、かつ" + mode.maxBits + "bit以下") || !text.includes(mode.timeBudgetMaxMs / 1000 + "秒")) errors.push("prime facts: mode bounds differ from selected release: " + mode.id);
  }
  if (!text.includes("完了") || !text.includes("保証") || !text.includes("素数証明ではありません")) errors.push("prime facts: completion and proof limitations missing");
  if (!text.includes("公開版") || !text.includes("異なる測定版")) errors.push("prime facts: historical benchmark scope missing");
  if (/世界最速|100桁唯一|必ず分解|必ず完了/u.test(text)) errors.push("prime facts: unsupported superiority or completion claim");
  return errors;
}
