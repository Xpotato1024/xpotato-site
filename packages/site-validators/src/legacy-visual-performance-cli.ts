import { createHash } from "node:crypto";
import { execFileSync, spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { LEGACY_COMMIT, LEGACY_REPOSITORY, LEGACY_TAG } from "./legacy-inventory.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const outputRoot = join(repositoryRoot, ".local/migration", LEGACY_TAG, "phase1b");
const screenshotRoot = join(outputRoot, "screenshots");
const CAPTURE_PROFILE_ID = "legacy-visual-performance-v1" as const;
const settleMs = 1_500;

interface ViewportProfile {
  readonly id: "desktop" | "mobile";
  readonly width: number;
  readonly height: number;
  readonly deviceScaleFactor: number;
  readonly mobile: boolean;
}

interface RouteProfile {
  readonly id: string;
  readonly path: string;
  readonly className: "home" | "archive" | "content" | "project" | "tool" | "generated_archive";
}

const viewports: readonly ViewportProfile[] = [
  { id: "desktop", width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
  { id: "mobile", width: 390, height: 844, deviceScaleFactor: 1, mobile: true },
];

const routes: readonly RouteProfile[] = [
  { id: "home", path: "/", className: "home" },
  { id: "blog-archive", path: "/blog/", className: "archive" },
  { id: "blog-category-diary", path: "/blog/category/diary/", className: "generated_archive" },
  { id: "vibration-robot", path: "/blog/vibration-robot/", className: "content" },
  { id: "xpotato-site", path: "/projects/xpotato-site/", className: "project" },
  { id: "prime-factorizer", path: "/tools/prime-factorizer/", className: "tool" },
];

interface ResourceObservation {
  readonly url: string;
  readonly initiatorType: string;
  readonly transferSize: number;
  readonly encodedBodySize: number;
  readonly decodedBodySize: number;
  readonly durationMs: number;
  readonly sameOrigin: boolean;
}

interface CaptureObservation {
  readonly routeId: string;
  readonly routeClass: RouteProfile["className"];
  readonly path: string;
  readonly viewportId: ViewportProfile["id"];
  readonly viewport: Readonly<{ width: number; height: number; deviceScaleFactor: number; mobile: boolean }>;
  readonly finalUrl: string;
  readonly documentTitle: string;
  readonly documentSize: Readonly<{ scrollWidth: number; scrollHeight: number }>;
  readonly screenshot: Readonly<{ relativePath: string; sha256: string; sizeBytes: number }>;
  readonly navigation: Readonly<{
    responseStartMs: number | null;
    domContentLoadedMs: number | null;
    loadEventMs: number | null;
    durationMs: number | null;
    transferSize: number | null;
    encodedBodySize: number | null;
    decodedBodySize: number | null;
  }>;
  readonly paint: Readonly<{ firstContentfulPaintMs: number | null; largestContentfulPaintMs: number | null; cls: number }>;
  readonly runtime: Readonly<{
    domNodes: number | null;
    taskDurationMs: number | null;
    jsHeapUsedBytes: number | null;
    layoutCount: number | null;
    recalcStyleCount: number | null;
  }>;
  readonly resources: Readonly<{
    requests: number;
    transferBytes: number;
    encodedBodyBytes: number;
    decodedBodyBytes: number;
    sameOriginTransferBytes: number;
    externalTransferBytes: number;
    javascriptTransferBytes: number;
    cssTransferBytes: number;
    imageTransferBytes: number;
    fontTransferBytes: number;
    externalOrigins: readonly string[];
  }>;
  readonly consoleErrors: readonly string[];
  readonly failedRequests: readonly string[];
}

interface CdpMessage {
  readonly id?: number;
  readonly method?: string;
  readonly params?: unknown;
  readonly result?: unknown;
  readonly error?: Readonly<{ message?: string }>;
}

class CdpClient {
  private readonly socket: WebSocket;
  private nextId = 1;
  private readonly pending = new Map<number, { resolve: (value: unknown) => void; reject: (reason: Error) => void }>();
  private readonly listeners = new Map<string, Set<(params: unknown) => void>>();

  private constructor(socket: WebSocket) {
    this.socket = socket;
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as CdpMessage;
      if (message.id !== undefined) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message ?? "CDP request failed"));
        else pending.resolve(message.result);
        return;
      }
      if (!message.method) return;
      for (const listener of this.listeners.get(message.method) ?? []) listener(message.params);
    });
  }

  static async connect(url: string): Promise<CdpClient> {
    const socket = new WebSocket(url);
    await new Promise<void>((resolveOpen, rejectOpen) => {
      const timer = setTimeout(() => rejectOpen(new Error(`Timed out connecting CDP ${url}`)), 10_000);
      socket.addEventListener("open", () => { clearTimeout(timer); resolveOpen(); }, { once: true });
      socket.addEventListener("error", () => { clearTimeout(timer); rejectOpen(new Error(`CDP websocket error ${url}`)); }, { once: true });
    });
    return new CdpClient(socket);
  }

  async send<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = this.nextId;
    this.nextId += 1;
    const result = new Promise<T>((resolveRequest, rejectRequest) => {
      this.pending.set(id, { resolve: (value) => resolveRequest(value as T), reject: rejectRequest });
    });
    this.socket.send(JSON.stringify({ id, method, params }));
    return result;
  }

  once(method: string, timeoutMs = 30_000): Promise<unknown> {
    return new Promise((resolveEvent, rejectEvent) => {
      const timer = setTimeout(() => {
        this.off(method, listener);
        rejectEvent(new Error(`Timed out waiting for CDP event ${method}`));
      }, timeoutMs);
      const listener = (params: unknown): void => {
        clearTimeout(timer);
        this.off(method, listener);
        resolveEvent(params);
      };
      this.on(method, listener);
    });
  }

  on(method: string, listener: (params: unknown) => void): void {
    const set = this.listeners.get(method) ?? new Set();
    set.add(listener);
    this.listeners.set(method, set);
  }

  off(method: string, listener: (params: unknown) => void): void {
    this.listeners.get(method)?.delete(listener);
  }

  close(): void {
    this.socket.close();
  }
}

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const round = (value: unknown, digits = 3): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const run = (command: string, args: readonly string[], cwd: string): void => {
  const result = spawnSync(command, [...args], { cwd, env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1" }, stdio: "inherit", shell: false });
  if (result.error) throw result.error;
  if ((result.status ?? 1) !== 0) throw new Error(`${command} ${args.join(" ")} failed with ${result.status ?? 1}`);
};

const git = (args: readonly string[], cwd = repositoryRoot): string => execFileSync("git", [...args], { cwd, encoding: "utf8" }).trim();

const mimeTypeFor = (path: string): string => {
  const extension = extname(path).toLowerCase();
  return ({
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  } as Record<string, string>)[extension] ?? "application/octet-stream";
};

const safeFileForRequest = (distRoot: string, requestPath: string): string => {
  const decoded = decodeURIComponent(requestPath.split("?")[0] ?? "/");
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const candidates = relative.endsWith("/") ? [`${relative}index.html`] : [relative, `${relative}/index.html`];
  for (const candidate of candidates) {
    const resolved = resolve(distRoot, normalize(candidate));
    const prefix = `${resolve(distRoot)}${sep}`;
    if (resolved !== resolve(distRoot) && !resolved.startsWith(prefix)) continue;
    try {
      execFileSync(process.execPath, ["-e", "process.exit(0)"]);
      return resolved;
    } catch {
      // unreachable; retained to keep path validation synchronous-free below
    }
  }
  return resolve(distRoot, relative);
};

const startStaticServer = async (distRoot: string): Promise<{ server: Server; origin: string }> => {
  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      const decoded = decodeURIComponent(requestUrl.pathname);
      const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
      const candidates = relative.endsWith("/") ? [`${relative}index.html`] : [relative, `${relative}/index.html`];
      let selected: string | undefined;
      for (const candidate of candidates) {
        const resolved = resolve(distRoot, normalize(candidate));
        const prefix = `${resolve(distRoot)}${sep}`;
        if (resolved !== resolve(distRoot) && !resolved.startsWith(prefix)) continue;
        try {
          const metadata = await stat(resolved);
          if (metadata.isFile()) { selected = resolved; break; }
        } catch {
          // next candidate
        }
      }
      if (!selected) {
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }
      const bytes = await readFile(selected);
      response.writeHead(200, { "content-type": mimeTypeFor(selected), "cache-control": "no-store" });
      response.end(bytes);
    } catch (error) {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      response.end(error instanceof Error ? error.message : String(error));
    }
  });
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", () => resolveListen());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Static server did not bind TCP port");
  return { server, origin: `http://127.0.0.1:${address.port}` };
};

const findChrome = (): string => {
  if (process.platform === "win32") {
    const candidates = [
      process.env.CHROME_PATH,
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    ].filter((item): item is string => Boolean(item));
    for (const candidate of candidates) {
      try { execFileSync(candidate, ["--version"], { stdio: "ignore" }); return candidate; } catch { /* next */ }
    }
    throw new Error("Chrome executable not found; set CHROME_PATH");
  }
  const result = spawnSync("sh", ["-lc", "command -v google-chrome || command -v google-chrome-stable || command -v chromium || command -v chromium-browser"], { encoding: "utf8" });
  const executable = result.stdout.trim().split(/\r?\n/u)[0];
  if (!executable) throw new Error("Chrome/Chromium executable not found");
  return executable;
};

const startChrome = async (): Promise<{ process: ChildProcess; port: number; userDataDir: string; executable: string; version: string }> => {
  const executable = findChrome();
  const version = execFileSync(executable, ["--version"], { encoding: "utf8" }).trim();
  const userDataDir = await mkdtemp(join(tmpdir(), "xpotato-legacy-chrome-"));
  const portServer = createServer();
  await new Promise<void>((resolveListen) => portServer.listen(0, "127.0.0.1", () => resolveListen()));
  const address = portServer.address();
  if (!address || typeof address === "string") throw new Error("Unable to reserve Chrome debug port");
  const port = address.port;
  await new Promise<void>((resolveClose) => portServer.close(() => resolveClose()));
  const child = spawn(executable, [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-background-networking",
    "--disable-default-apps",
    "--disable-extensions",
    "--disable-sync",
    "--metrics-recording-only",
    "--mute-audio",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ], { stdio: "ignore" });
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return { process: child, port, userDataDir, executable, version };
    } catch {
      // retry
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  child.kill("SIGKILL");
  throw new Error("Chrome DevTools endpoint did not become ready");
};

const observerBootstrap = `(() => {
  const state = { lcp: null, cls: 0 };
  Object.defineProperty(window, "__xpotatoLegacyPerf", { value: state, configurable: false });
  try { new PerformanceObserver((list) => { for (const entry of list.getEntries()) state.lcp = entry.startTime; }).observe({ type: "largest-contentful-paint", buffered: true }); } catch {}
  try { new PerformanceObserver((list) => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) state.cls += entry.value; }).observe({ type: "layout-shift", buffered: true }); } catch {}
})();`;

const snapshotRuntimeExpression = `(() => {
  const nav = performance.getEntriesByType("navigation")[0] || null;
  const paints = performance.getEntriesByType("paint");
  const fcp = paints.find((entry) => entry.name === "first-contentful-paint") || null;
  const resources = performance.getEntriesByType("resource").map((entry) => ({
    name: entry.name,
    initiatorType: entry.initiatorType || "unknown",
    transferSize: Number(entry.transferSize || 0),
    encodedBodySize: Number(entry.encodedBodySize || 0),
    decodedBodySize: Number(entry.decodedBodySize || 0),
    duration: Number(entry.duration || 0),
  }));
  const perfState = window.__xpotatoLegacyPerf || { lcp: null, cls: 0 };
  return {
    title: document.title,
    url: location.href,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    navigation: nav ? {
      responseStart: nav.responseStart,
      domContentLoadedEventEnd: nav.domContentLoadedEventEnd,
      loadEventEnd: nav.loadEventEnd,
      duration: nav.duration,
      transferSize: nav.transferSize,
      encodedBodySize: nav.encodedBodySize,
      decodedBodySize: nav.decodedBodySize,
    } : null,
    fcp: fcp ? fcp.startTime : null,
    lcp: perfState.lcp,
    cls: perfState.cls,
    resources,
  };
})()`;

const waitForImagesExpression = `(async () => {
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  await Promise.race([
    Promise.all(Array.from(document.images).map(async (image) => {
      if (!image.complete) await new Promise((resolve) => { image.addEventListener("load", resolve, { once: true }); image.addEventListener("error", resolve, { once: true }); });
      try { await image.decode(); } catch {}
    })),
    pause(10000),
  ]);
  if (document.fonts && document.fonts.ready) await Promise.race([document.fonts.ready, pause(5000)]);
  return true;
})()`;

const captureOne = async (
  cdp: CdpClient,
  origin: string,
  route: RouteProfile,
  viewport: ViewportProfile,
): Promise<CaptureObservation> => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const consoleListener = (params: unknown): void => {
    const value = params as { type?: string; args?: Array<{ value?: unknown; description?: string }> };
    if (value.type !== "error") return;
    consoleErrors.push(value.args?.map((item) => String(item.value ?? item.description ?? "")).join(" ") ?? "console.error");
  };
  const failedListener = (params: unknown): void => {
    const value = params as { requestId?: string; errorText?: string; blockedReason?: string };
    failedRequests.push(`${value.requestId ?? "?"}:${value.errorText ?? value.blockedReason ?? "failed"}`);
  };
  cdp.on("Runtime.consoleAPICalled", consoleListener);
  cdp.on("Network.loadingFailed", failedListener);
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor,
    mobile: viewport.mobile,
    screenWidth: viewport.width,
    screenHeight: viewport.height,
  });
  await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  const load = cdp.once("Page.loadEventFired", 45_000);
  await cdp.send("Page.navigate", { url: `${origin}${route.path}` });
  await load;
  await cdp.send("Runtime.evaluate", { expression: waitForImagesExpression, awaitPromise: true, returnByValue: true });
  await cdp.send("Runtime.evaluate", {
    expression: `(() => { const s=document.createElement('style'); s.textContent='*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}'; document.head.appendChild(s); return true; })()`,
    returnByValue: true,
  });
  await new Promise((resolveDelay) => setTimeout(resolveDelay, settleMs));
  const runtime = await cdp.send<{ result: { value?: unknown } }>("Runtime.evaluate", { expression: snapshotRuntimeExpression, returnByValue: true });
  const page = runtime.result.value as {
    title: string;
    url: string;
    scrollWidth: number;
    scrollHeight: number;
    navigation: null | { responseStart: number; domContentLoadedEventEnd: number; loadEventEnd: number; duration: number; transferSize: number; encodedBodySize: number; decodedBodySize: number };
    fcp: number | null;
    lcp: number | null;
    cls: number;
    resources: Array<{ name: string; initiatorType: string; transferSize: number; encodedBodySize: number; decodedBodySize: number; duration: number }>;
  };
  const metricsResponse = await cdp.send<{ metrics?: Array<{ name: string; value: number }> }>("Performance.getMetrics");
  const metrics = new Map((metricsResponse.metrics ?? []).map((item) => [item.name, item.value]));
  const screenshot = await cdp.send<{ data: string }>("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, fromSurface: true });
  const screenshotBytes = Buffer.from(screenshot.data, "base64");
  const relativePath = `screenshots/${route.id}-${viewport.id}.png`;
  await writeFile(join(outputRoot, relativePath), screenshotBytes);
  const observedResources: ResourceObservation[] = page.resources.map((resource) => {
    const parsed = new URL(resource.name, page.url);
    return {
      url: resource.name,
      initiatorType: resource.initiatorType,
      transferSize: resource.transferSize,
      encodedBodySize: resource.encodedBodySize,
      decodedBodySize: resource.decodedBodySize,
      durationMs: Math.round(resource.duration * 1000) / 1000,
      sameOrigin: parsed.origin === origin,
    };
  });
  const bytesFor = (types: readonly string[]): number => observedResources.filter((item) => types.includes(item.initiatorType)).reduce((sum, item) => sum + item.transferSize, 0);
  const externalOrigins = [...new Set(observedResources.filter((item) => !item.sameOrigin).map((item) => new URL(item.url, page.url).origin))].sort();
  cdp.off("Runtime.consoleAPICalled", consoleListener);
  cdp.off("Network.loadingFailed", failedListener);
  return {
    routeId: route.id,
    routeClass: route.className,
    path: route.path,
    viewportId: viewport.id,
    viewport: { width: viewport.width, height: viewport.height, deviceScaleFactor: viewport.deviceScaleFactor, mobile: viewport.mobile },
    finalUrl: page.url,
    documentTitle: page.title,
    documentSize: { scrollWidth: page.scrollWidth, scrollHeight: page.scrollHeight },
    screenshot: { relativePath, sha256: sha256(screenshotBytes), sizeBytes: screenshotBytes.byteLength },
    navigation: {
      responseStartMs: round(page.navigation?.responseStart),
      domContentLoadedMs: round(page.navigation?.domContentLoadedEventEnd),
      loadEventMs: round(page.navigation?.loadEventEnd),
      durationMs: round(page.navigation?.duration),
      transferSize: round(page.navigation?.transferSize, 0),
      encodedBodySize: round(page.navigation?.encodedBodySize, 0),
      decodedBodySize: round(page.navigation?.decodedBodySize, 0),
    },
    paint: { firstContentfulPaintMs: round(page.fcp), largestContentfulPaintMs: round(page.lcp), cls: round(page.cls, 6) ?? 0 },
    runtime: {
      domNodes: round(metrics.get("Nodes"), 0),
      taskDurationMs: metrics.has("TaskDuration") ? round((metrics.get("TaskDuration") ?? 0) * 1000) : null,
      jsHeapUsedBytes: round(metrics.get("JSHeapUsedSize"), 0),
      layoutCount: round(metrics.get("LayoutCount"), 0),
      recalcStyleCount: round(metrics.get("RecalcStyleCount"), 0),
    },
    resources: {
      requests: observedResources.length,
      transferBytes: observedResources.reduce((sum, item) => sum + item.transferSize, 0),
      encodedBodyBytes: observedResources.reduce((sum, item) => sum + item.encodedBodySize, 0),
      decodedBodyBytes: observedResources.reduce((sum, item) => sum + item.decodedBodySize, 0),
      sameOriginTransferBytes: observedResources.filter((item) => item.sameOrigin).reduce((sum, item) => sum + item.transferSize, 0),
      externalTransferBytes: observedResources.filter((item) => !item.sameOrigin).reduce((sum, item) => sum + item.transferSize, 0),
      javascriptTransferBytes: bytesFor(["script"]),
      cssTransferBytes: bytesFor(["css", "link"]),
      imageTransferBytes: bytesFor(["img", "image"]),
      fontTransferBytes: bytesFor(["font"]),
      externalOrigins,
    },
    consoleErrors,
    failedRequests,
  };
};

await rm(outputRoot, { recursive: true, force: true });
await mkdir(screenshotRoot, { recursive: true });
const tempRoot = await mkdtemp(join(tmpdir(), "xpotato-phase1b-"));
const legacyWorktree = join(tempRoot, "legacy");
let worktreeAdded = false;
let staticServer: Server | undefined;
let chrome: Awaited<ReturnType<typeof startChrome>> | undefined;
let cdp: CdpClient | undefined;
try {
  git(["worktree", "add", "--detach", legacyWorktree, LEGACY_TAG]);
  worktreeAdded = true;
  if (git(["rev-parse", "HEAD"], legacyWorktree) !== LEGACY_COMMIT) throw new Error("Legacy capture worktree commit mismatch");
  run(process.platform === "win32" ? "npm.cmd" : "npm", ["ci"], legacyWorktree);
  run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "check"], legacyWorktree);
  run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], legacyWorktree);
  if (git(["status", "--porcelain", "--untracked-files=no"], legacyWorktree) !== "") throw new Error("Legacy source changed during Phase 1B capture");

  const { server, origin } = await startStaticServer(join(legacyWorktree, "dist"));
  staticServer = server;
  chrome = await startChrome();
  const targetResponse = await fetch(`http://127.0.0.1:${chrome.port}/json/new?about:blank`, { method: "PUT" });
  if (!targetResponse.ok) throw new Error(`Unable to create Chrome target: HTTP ${targetResponse.status}`);
  const target = await targetResponse.json() as { webSocketDebuggerUrl?: string };
  if (!target.webSocketDebuggerUrl) throw new Error("Chrome target missing webSocketDebuggerUrl");
  cdp = await CdpClient.connect(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");
  await cdp.send("Performance.enable");
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: observerBootstrap });

  const observations: CaptureObservation[] = [];
  for (const viewport of viewports) {
    for (const route of routes) {
      console.log(`Capture ${route.path} ${viewport.id}`);
      observations.push(await captureOne(cdp, origin, route, viewport));
    }
  }
  const report = {
    schemaVersion: 1,
    captureProfileId: CAPTURE_PROFILE_ID,
    observedAt: new Date().toISOString(),
    source: {
      repository: LEGACY_REPOSITORY,
      tag: LEGACY_TAG,
      tagObjectSha: git(["rev-parse", `refs/tags/${LEGACY_TAG}`]),
      commitSha: LEGACY_COMMIT,
      packageLockBlobSha: git(["rev-parse", `${LEGACY_TAG}:package-lock.json`]),
    },
    environment: {
      platform: process.platform,
      architecture: process.arch,
      nodeVersion: process.version,
      chromeVersion: chrome.version,
    },
    capturePolicy: {
      screenshotsStoredInGit: false,
      screenshotsArtifactOnly: true,
      reducedMotion: true,
      animationsDisabledAfterLoad: true,
      cacheMode: "local-server-no-store",
      network: "public-read-only; no credentials; external resource observations retained",
      performanceInterpretation: "local hosted-run lab observation; not field Core Web Vitals compliance",
      inp: "not measured; no representative interaction workload defined in Phase 1B",
      thresholds: "none; this phase records observations and does not invent hard budgets",
    },
    viewports,
    routes,
    observations,
  };
  await writeFile(join(outputRoot, "capture-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const compact = {
    schemaVersion: 1,
    captureProfileId: CAPTURE_PROFILE_ID,
    source: report.source,
    environment: report.environment,
    viewports,
    routes,
    observationCount: observations.length,
    screenshots: observations.map((item) => ({ routeId: item.routeId, viewportId: item.viewportId, sha256: item.screenshot.sha256, sizeBytes: item.screenshot.sizeBytes })),
    measurements: observations.map((item) => ({
      routeId: item.routeId,
      viewportId: item.viewportId,
      firstContentfulPaintMs: item.paint.firstContentfulPaintMs,
      largestContentfulPaintMs: item.paint.largestContentfulPaintMs,
      cls: item.paint.cls,
      transferBytes: item.resources.transferBytes,
      javascriptTransferBytes: item.resources.javascriptTransferBytes,
      cssTransferBytes: item.resources.cssTransferBytes,
      imageTransferBytes: item.resources.imageTransferBytes,
      externalTransferBytes: item.resources.externalTransferBytes,
      domNodes: item.runtime.domNodes,
      jsHeapUsedBytes: item.runtime.jsHeapUsedBytes,
      failedRequestCount: item.failedRequests.length,
      consoleErrorCount: item.consoleErrors.length,
    })),
  };
  await writeFile(join(outputRoot, "compact-baseline-candidate.json"), `${JSON.stringify(compact, null, 2)}\n`, "utf8");
  console.log(`Legacy Phase 1B capture PASS: ${observations.length} route/viewport observations`);
} finally {
  cdp?.close();
  if (chrome) {
    const browser = chrome;
    browser.process.kill("SIGTERM");
    await new Promise<void>((resolveExit) => {
      if (browser.process.exitCode !== null) {
        resolveExit();
        return;
      }
      const timer = setTimeout(() => {
        browser.process.kill("SIGKILL");
        resolveExit();
      }, 2_000);
      browser.process.once("exit", () => {
        clearTimeout(timer);
        resolveExit();
      });
    });
    await rm(browser.userDataDir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  }
  if (staticServer) {
    const server = staticServer;
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  }
  if (worktreeAdded) {
    try { git(["worktree", "remove", "--force", legacyWorktree]); } catch { /* cleanup below */ }
  }
  await rm(tempRoot, { recursive: true, force: true });
}
