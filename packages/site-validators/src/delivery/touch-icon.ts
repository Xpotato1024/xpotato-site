import { parse, type DefaultTreeAdapterMap } from "parse5";

type Node = DefaultTreeAdapterMap["node"];
const elements = (node: Node): Node[] => ["tagName" in node ? [node] : [], "childNodes" in node ? node.childNodes.flatMap(elements) : []].flat();
const attr = (node: Node, name: string) => "attrs" in node ? node.attrs.find(a => a.name === name)?.value : undefined;
export const touchIconPath = "/icon-apple-touch.png";

export function validateTouchIcon(html: string, png: Buffer): string[] {
  const errors: string[] = [];
  const head = elements(parse(html)).find(n => "tagName" in n && n.tagName === "head");
  const links = head ? elements(head).filter(n => "tagName" in n && n.tagName === "link" && attr(n, "rel") === "apple-touch-icon") : [];
  if (links.length !== 1 || attr(links[0]!, "href") !== touchIconPath || attr(links[0]!, "type") !== "image/png" || attr(links[0]!, "sizes") !== "180x180") {
    errors.push("apple-touch-icon must declare one 180x180 PNG in head");
  }
  // The generator emits an opaque RGB PNG. Decode/pixel and byte-parity checks
  // live in the generator test; this rejects missing/truncated PNG headers too.
  if (png.length < 33 || !png.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    || png.readUInt32BE(8) !== 13 || png.toString("ascii", 12, 16) !== "IHDR"
    || png.readUInt32BE(16) !== 180 || png.readUInt32BE(20) !== 180 || png[24] !== 8 || png[25] !== 2) {
    errors.push("apple-touch-icon must be an opaque 180x180 RGB PNG");
  }
  return errors;
}
