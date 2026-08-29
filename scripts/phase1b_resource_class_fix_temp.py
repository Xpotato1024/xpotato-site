from pathlib import Path

path = Path("packages/site-validators/src/legacy-visual-performance-cli.ts")
text = path.read_text(encoding="utf-8")
old = '''  const resourcePath = (item: ResourceObservation): string => {
    try { return new URL(item.url, page.url).pathname.toLowerCase(); } catch { return ""; }
  };
  const isJavascript = (item: ResourceObservation): boolean => item.initiatorType === "script" || /\\.(?:m?js)$/u.test(resourcePath(item));
  const isStylesheet = (item: ResourceObservation): boolean => item.initiatorType === "css" || /\\.css$/u.test(resourcePath(item));
  const isImage = (item: ResourceObservation): boolean => ["img", "image"].includes(item.initiatorType) || /\\.(?:avif|gif|jpe?g|png|svg|webp|ico)$/u.test(resourcePath(item));
  const isFont = (item: ResourceObservation): boolean => item.initiatorType === "font" || /\\.(?:woff2?|ttf|otf)$/u.test(resourcePath(item));
  const categorizedTransfer = (predicate: (item: ResourceObservation) => boolean): number => observedResources.filter(predicate).reduce((sum, item) => sum + item.transferSize, 0);
  const externalOrigins = [...new Set(observedResources.filter((item) => !item.sameOrigin).map((item) => new URL(item.url, page.url).origin))].sort();'''
new = '''  const resourcePath = (item: ResourceObservation): string => {
    try { return new URL(item.url, page.url).pathname.toLowerCase(); } catch { return ""; }
  };
  type ResourceClass = "javascript" | "css" | "image" | "font" | "other";
  const resourceClass = (item: ResourceObservation): ResourceClass => {
    const pathname = resourcePath(item);
    if (["img", "image"].includes(item.initiatorType) || /\\.(?:avif|gif|jpe?g|png|svg|webp|ico)$/u.test(pathname)) return "image";
    if (item.initiatorType === "font" || /\\.(?:woff2?|ttf|otf)$/u.test(pathname)) return "font";
    if (item.initiatorType === "script" || /\\.(?:m?js)$/u.test(pathname)) return "javascript";
    if (["css", "link"].includes(item.initiatorType) || /\\.css$/u.test(pathname)) return "css";
    return "other";
  };
  const transferFor = (kind: ResourceClass): number => observedResources.filter((item) => resourceClass(item) === kind).reduce((sum, item) => sum + item.transferSize, 0);
  const externalOrigins = [...new Set(observedResources.filter((item) => !item.sameOrigin).map((item) => new URL(item.url, page.url).origin))].sort();'''
if text.count(old) != 1:
    raise SystemExit(f"resource classifier block count={text.count(old)}")
text = text.replace(old, new)
old = '''      javascriptTransferBytes: categorizedTransfer(isJavascript),
      cssTransferBytes: categorizedTransfer(isStylesheet),
      imageTransferBytes: categorizedTransfer(isImage),
      fontTransferBytes: categorizedTransfer(isFont),
      otherTransferBytes: observedResources.reduce((sum, item) => sum + item.transferSize, 0)
        - categorizedTransfer(isJavascript)
        - categorizedTransfer(isStylesheet)
        - categorizedTransfer(isImage)
        - categorizedTransfer(isFont),'''
new = '''      javascriptTransferBytes: transferFor("javascript"),
      cssTransferBytes: transferFor("css"),
      imageTransferBytes: transferFor("image"),
      fontTransferBytes: transferFor("font"),
      otherTransferBytes: transferFor("other"),'''
if text.count(old) != 1:
    raise SystemExit(f"resource aggregate block count={text.count(old)}")
text = text.replace(old, new)
old = '''      performanceInterpretation: "local hosted-run lab observation; not field Core Web Vitals compliance",
      inp: "not measured; no representative interaction workload defined in Phase 1B",'''
new = '''      performanceInterpretation: "local hosted-run lab observation; not field Core Web Vitals compliance",
      crossOriginTransferCaveat: "Resource Timing transferSize may be zero for cross-origin resources that do not expose timing details; external origins are recorded separately",
      inp: "not measured; no representative interaction workload defined in Phase 1B",'''
if text.count(old) != 1:
    raise SystemExit(f"capture policy block count={text.count(old)}")
text = text.replace(old, new)
path.write_text(text, encoding="utf-8", newline="\n")
