import { parse, type DefaultTreeAdapterMap } from "parse5";
type Node = DefaultTreeAdapterMap["node"];
const attr = (node: Node, name: string) => "attrs" in node ? node.attrs.find(a => a.name === name)?.value : undefined;
const text = (node: Node): string => "value" in node ? node.value : "childNodes" in node ? node.childNodes.map(text).join("") : "";
const elements = (node: Node): Node[] => ["tagName" in node ? [node] : [], "childNodes" in node ? node.childNodes.flatMap(elements) : []].flat();
const title = "ロボティクスとプログラミングの記録";
const description = "Xpotatoの技術とものづくりの記録。ロボティクスやプログラミングの試行錯誤、制作物、教育資料、ブラウザで使える小さなツールをまとめています。";
export function validateHomeSearchMetadata(html: string, icons: ReadonlyMap<string, Buffer>): string[] {
  const errors: string[] = [];
  const head = elements(parse(html)).find(n => "tagName" in n && n.tagName === "head");
  const nodes = head ? elements(head) : [];
  const select = (tag: string, key?: string, value?: string) => nodes.filter(n => "tagName" in n && n.tagName === tag && (!key || attr(n, key) === value));
  const exact = (values: (string | undefined)[], expected: string, label: string) => {
    if (values.length !== 1 || values[0] !== expected) errors.push(`home: ${label} mismatch or duplicate`);
  };
  exact(select("title").map(text), title + " | Xpotato", "title");
  exact(select("meta", "name", "description").map(n => attr(n, "content")), description, "description");
  exact(select("link", "rel", "canonical").map(n => attr(n, "href")), "https://xpotato.net/", "canonical");
  for (const [property, value] of [["og:title", title], ["og:description", description], ["og:site_name", "Xpotato"], ["og:url", "https://xpotato.net/"]]) {
    exact(select("meta", "property", property).map(n => attr(n, "content")), value!, property!);
  }
  if (select("meta", "name", "robots").some(n => /noindex|none/iu.test(attr(n, "content") ?? ""))) errors.push("home: unexpectedly noindex");
  if (/Xpotato vNext foundation|Design\s*Freeze|代表fixture/iu.test(html)) errors.push("home: obsolete internal explanation");
  const links = select("link", "rel", "icon");
  for (const [path, type, sizes] of [["/favicon.ico", "image/x-icon", "16x16 32x32 48x48 64x64"], ["/favicon.svg", "image/svg+xml", "any"]]) {
    const matches = links.filter(n => attr(n, "href") === path);
    if (matches.length !== 1 || attr(matches[0]!, "type") !== type || attr(matches[0]!, "sizes") !== sizes) errors.push(`home: favicon link ${path}`);
    if (!icons.get(path!)?.length) errors.push(`home: missing favicon file ${path}`);
  }
  const svg = icons.get("/favicon.svg")?.toString("utf8") ?? "";
  const viewBox = /\bviewBox="([^"]+)"/u.exec(svg)?.[1]?.split(/\s+/u).map(Number);
  if (!viewBox || viewBox.length !== 4 || viewBox.some(v => !Number.isFinite(v)) || viewBox[2] !== viewBox[3] || viewBox[2]! <= 0
    || !/\bwidth="64"/u.test(svg) || !/\bheight="64"/u.test(svg)) errors.push("home: favicon SVG must have square viewBox and dimensions");
  const ico = icons.get("/favicon.ico") ?? Buffer.alloc(0);
  let valid = ico.length >= 70 && ico.readUInt16LE(0) === 0 && ico.readUInt16LE(2) === 1 && ico.readUInt16LE(4) === 4;
  for (const [index, size] of [16, 32, 48, 64].entries()) {
    if (!valid) break;
    const entry = 6 + index * 16, bytes = ico.readUInt32LE(entry + 8), offset = ico.readUInt32LE(entry + 12);
    const expectedBytes = 40 + size * size * 4 + Math.ceil(size / 32) * 4 * size;
    valid = ico[entry] === size && ico[entry + 1] === size && ico.readUInt16LE(entry + 4) === 1 && ico.readUInt16LE(entry + 6) === 32
      && bytes === expectedBytes && offset >= 70 && offset + bytes <= ico.length
      && ico.readUInt32LE(offset) === 40 && ico.readInt32LE(offset + 4) === size && ico.readInt32LE(offset + 8) === size * 2
      && ico.readUInt16LE(offset + 12) === 1 && ico.readUInt16LE(offset + 14) === 32;
  }
  if (!valid) errors.push("home: favicon ICO must contain valid square 16/32/48/64 bitmaps");
  return errors;
}
