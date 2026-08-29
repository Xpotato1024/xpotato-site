from pathlib import Path

path = Path("packages/site-validators/src/legacy-visual-performance-cli.ts")
text = path.read_text(encoding="utf-8")
replacements = [
    (
'''  readonly runtime: Readonly<{
    domNodes: number | null;
    taskDurationMs: number | null;
    jsHeapUsedBytes: number | null;
    layoutCount: number | null;
    recalcStyleCount: number | null;
  }>;''',
'''  readonly runtime: Readonly<{
    domElementCount: number;
  }>;'''
    ),
    (
'''    fontTransferBytes: number;
    externalOrigins: readonly string[];''',
'''    fontTransferBytes: number;
    otherTransferBytes: number;
    externalOrigins: readonly string[];'''
    ),
    (
'''    scrollHeight: document.documentElement.scrollHeight,
    navigation: nav ? {''',
'''    scrollHeight: document.documentElement.scrollHeight,
    domElementCount: document.querySelectorAll("*").length,
    navigation: nav ? {'''
    ),
    (
'''    scrollHeight: number;
    navigation: null | { responseStart: number; domContentLoadedEventEnd: number; loadEventEnd: number; duration: number; transferSize: number; encodedBodySize: number; decodedBodySize: number };''',
'''    scrollHeight: number;
    domElementCount: number;
    navigation: null | { responseStart: number; domContentLoadedEventEnd: number; loadEventEnd: number; duration: number; transferSize: number; encodedBodySize: number; decodedBodySize: number };'''
    ),
    (
'''  const metricsResponse = await cdp.send<{ metrics?: Array<{ name: string; value: number }> }>("Performance.getMetrics");
  const metrics = new Map((metricsResponse.metrics ?? []).map((item) => [item.name, item.value]));
  const screenshot = await cdp.send<{ data: string }>("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, fromSurface: true });''',
'''  const screenshot = await cdp.send<{ data: string }>("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, fromSurface: true });'''
    ),
    (
'''  const bytesFor = (types: readonly string[]): number => observedResources.filter((item) => types.includes(item.initiatorType)).reduce((sum, item) => sum + item.transferSize, 0);
  const externalOrigins = [...new Set(observedResources.filter((item) => !item.sameOrigin).map((item) => new URL(item.url, page.url).origin))].sort();''',
'''  const resourcePath = (item: ResourceObservation): string => {
    try { return new URL(item.url, page.url).pathname.toLowerCase(); } catch { return ""; }
  };
  const isJavascript = (item: ResourceObservation): boolean => item.initiatorType === "script" || /\\.(?:m?js)$/u.test(resourcePath(item));
  const isStylesheet = (item: ResourceObservation): boolean => item.initiatorType === "css" || /\\.css$/u.test(resourcePath(item));
  const isImage = (item: ResourceObservation): boolean => ["img", "image"].includes(item.initiatorType) || /\\.(?:avif|gif|jpe?g|png|svg|webp|ico)$/u.test(resourcePath(item));
  const isFont = (item: ResourceObservation): boolean => item.initiatorType === "font" || /\\.(?:woff2?|ttf|otf)$/u.test(resourcePath(item));
  const categorizedTransfer = (predicate: (item: ResourceObservation) => boolean): number => observedResources.filter(predicate).reduce((sum, item) => sum + item.transferSize, 0);
  const externalOrigins = [...new Set(observedResources.filter((item) => !item.sameOrigin).map((item) => new URL(item.url, page.url).origin))].sort();'''
    ),
    (
'''    runtime: {
      domNodes: round(metrics.get("Nodes"), 0),
      taskDurationMs: metrics.has("TaskDuration") ? round((metrics.get("TaskDuration") ?? 0) * 1000) : null,
      jsHeapUsedBytes: round(metrics.get("JSHeapUsedSize"), 0),
      layoutCount: round(metrics.get("LayoutCount"), 0),
      recalcStyleCount: round(metrics.get("RecalcStyleCount"), 0),
    },''',
'''    runtime: {
      domElementCount: page.domElementCount,
    },'''
    ),
    (
'''      javascriptTransferBytes: bytesFor(["script"]),
      cssTransferBytes: bytesFor(["css", "link"]),
      imageTransferBytes: bytesFor(["img", "image"]),
      fontTransferBytes: bytesFor(["font"]),
      externalOrigins,''',
'''      javascriptTransferBytes: categorizedTransfer(isJavascript),
      cssTransferBytes: categorizedTransfer(isStylesheet),
      imageTransferBytes: categorizedTransfer(isImage),
      fontTransferBytes: categorizedTransfer(isFont),
      otherTransferBytes: observedResources.reduce((sum, item) => sum + item.transferSize, 0)
        - categorizedTransfer(isJavascript)
        - categorizedTransfer(isStylesheet)
        - categorizedTransfer(isImage)
        - categorizedTransfer(isFont),
      externalOrigins,'''
    ),
    (
'''      domNodes: item.runtime.domNodes,
      jsHeapUsedBytes: item.runtime.jsHeapUsedBytes,
      failedRequestCount: item.failedRequests.length,''',
'''      domElementCount: item.runtime.domElementCount,
      otherTransferBytes: item.resources.otherTransferBytes,
      failedRequestCount: item.failedRequests.length,'''
    ),
    (
'''  cdp.on("Runtime.consoleAPICalled", consoleListener);
  cdp.on("Network.loadingFailed", failedListener);
  await cdp.send("Emulation.setDeviceMetricsOverride", {''',
'''  cdp.on("Runtime.consoleAPICalled", consoleListener);
  cdp.on("Network.loadingFailed", failedListener);
  await cdp.send("Network.clearBrowserCache");
  await cdp.send("Emulation.setDeviceMetricsOverride", {'''
    ),
    (
'''  await cdp.send("Network.enable");
  await cdp.send("Performance.enable");
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: observerBootstrap });''',
'''  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: observerBootstrap });'''
    ),
]
for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected exactly one replacement, found {count}: {old[:80]!r}")
    text = text.replace(old, new)
path.write_text(text, encoding="utf-8", newline="\n")
