import { publicObservationBodyLimit } from "./prime-public-target-policy.mjs";
import {
  assertPublicTargetPlan,
  publicReadbackPolicy as policy,
} from "./shared/public-readback-policy.mjs";
import { authority } from "./deployment-policy.mjs";
import { hashBytes } from "./manual-deployment.mjs";
import { stop, uuid, ManualDeployError } from "./manual-deployment-provider.mjs";
import { dnsLabel } from "./shared/cloudflare-response-shapes.mjs";
import {
  parseStaticHeaderRules,
  headersForPath,
} from "../../packages/site-validators/src/delivery/static-headers.mjs";
import { matchManagedRobots } from "./managed-robots-policy.mjs";
const reports = new WeakMap();
const observationErrorCodes = new Set([
  "PUBLIC_TIMEOUT",
  "PUBLIC_READ_FAILED",
  "PUBLIC_READBACK_STALE",
  "PUBLIC_HTTP_OR_REDIRECT",
  "PUBLIC_BODY_LIMIT",
  "PUBLIC_READ_BUDGET",
]);
export const publicReadbackReport = (error) => reports.get(error);

/**
 * Only static CMS shell paths that the canonical artifact's public target plan
 * already admitted can use Cloudflare Access as their observable readback.
 * API routes, arbitrary editor paths and all other site assets remain exact.
 */
function isEditorProtectedShellPath(path) {
  return (
    path === "/editor/" ||
    /^\/editor\/(?:index\.html|manifest\.webmanifest|icon\.svg|xpotato-cms(?:-(?:small|maskable))?\.svg|xpotato-cms-(?:16|32|48|180|192|512|maskable-512)\.png|sw\.js|assets\/[A-Za-z0-9_.-]+\.(?:js|css)|fonts\/[A-Za-z0-9_.-]+\.woff2)$/.test(
      path,
    )
  );
}
/** Access is verified as an authentication boundary, never as an asset byte match. */
function isEditorAccessChallenge(response, target) {
  if (!isEditorProtectedShellPath(target?.path) || response.status !== 302) return false;
  const location = response.headers.get("location");
  if (!location || !location.startsWith("https://")) return false;
  try {
    const url = new URL(location);
    return (
      url.protocol === "https:" &&
      url.hostname === "xpotato1024.cloudflareaccess.com" &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.pathname === "/cdn-cgi/access/login/" + authority.hostname &&
      url.searchParams.getAll("redirect_url").length === 1 &&
      url.searchParams.get("redirect_url") === target.path &&
      url.searchParams.has("kid") &&
      url.searchParams.has("meta")
    );
  } catch {
    return false;
  }
}
export function createPublicReadback({
  fetchImpl,
  clock = Date.now,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  let count = 0,
    observedBytes = 0;
  async function read(url, maxBytes = 2097152, deadline = Infinity, target) {
    const fresh = () => {
      if (clock() >= deadline) stop("PUBLIC_READBACK_STALE");
    };
    fresh();
    if (++count > policy.maxReads) stop("PUBLIC_READ_BUDGET");
    const controller = new AbortController();
    let timer,
      timedOut = false;
    const operation = (async () => {
      const response = await fetchImpl(url, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "xpotato-site-manual-readback", "Cache-Control": "no-cache" },
      });
      fresh();
      if (isEditorAccessChallenge(response, target)) {
        await response.body?.cancel().catch(() => {});
        // The canonical release archive and active Worker version are verified elsewhere.
        // Access protects the entire CMS shell; unauthenticated requests cannot read its bytes.
        return {
          status: response.status,
          bytes: 0,
          sha256: null,
          headers: {},
          managedRobots: null,
          accessProtected: true,
        };
      }
      if (![200, 404].includes(response.status) || !response.body?.getReader)
        stop("PUBLIC_HTTP_OR_REDIRECT");
      const reader = response.body.getReader(),
        chunks = [];
      let size = 0;
      const cancel = () => {
        try {
          Promise.resolve(reader.cancel()).catch(() => {});
        } catch {}
      };
      controller.signal.addEventListener("abort", cancel, { once: true });
      try {
        for (;;) {
          fresh();
          if (controller.signal.aborted) stop("PUBLIC_TIMEOUT");
          const r = await reader.read();
          fresh();
          if (r.done) break;
          size += r.value.length;
          observedBytes += r.value.length;
          if (size > maxBytes || observedBytes > policy.maxObservedBytes) {
            cancel();
            stop("PUBLIC_BODY_LIMIT");
          }
          chunks.push(Buffer.from(r.value));
        }
      } finally {
        controller.signal.removeEventListener("abort", cancel);
        try {
          reader.releaseLock();
        } catch {}
      }
      if (controller.signal.aborted) stop("PUBLIC_TIMEOUT");
      const headers = Object.fromEntries(
        [
          "content-security-policy",
          "x-content-type-options",
          "referrer-policy",
          "permissions-policy",
          "cache-control",
        ].map((name) => [name, response.headers.get(name)]),
      );
      const body = Buffer.concat(chunks);
      const managedRobots =
        target?.path === "/robots.txt" ? matchManagedRobots(target, body) : null;
      return {
        status: response.status,
        bytes: size,
        sha256: hashBytes(body),
        headers,
        managedRobots,
      };
    })();
    try {
      return await Promise.race([
        operation,
        new Promise((_, reject) => {
          timer = setTimeout(
            () => {
              timedOut = true;
              controller.abort();
              reject(Error("PUBLIC_TIMEOUT"));
            },
            Math.min(policy.requestMs, deadline - clock()),
          );
        }),
      ]);
    } catch (error) {
      if (timedOut) stop("PUBLIC_TIMEOUT");
      if (error instanceof ManualDeployError && observationErrorCodes.has(error.message))
        throw error;
      stop("PUBLIC_READ_FAILED");
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  }
  async function alternates(image, deadline = Infinity) {
    if (!uuid(image.versionId) || !dnsLabel(image.accountSubdomain)) stop("ALTERNATE_IDENTITY");
    const suffix = image.accountSubdomain + ".workers.dev";
    const worker = await read(
      "https://" + authority.worker + "." + suffix + "/",
      2097152,
      deadline,
    );
    const preview = await read(
      "https://" + image.versionId.slice(0, 8) + "-" + authority.worker + "." + suffix + "/",
      2097152,
      deadline,
    );
    if (worker.status !== 404 || preview.status !== 404) stop("ALTERNATE_ENDPOINT_LIVE");
    return { workersDevStatus: worker.status, previewStatus: preview.status };
  }
  return Object.freeze({
    async before(image) {
      const home = await read("https://" + authority.hostname + "/");
      return { publicStatus: home.status, homeSha256: home.sha256, ...(await alternates(image)) };
    },
    async published(targets, image, assertSameVersion = async () => {}) {
      assertPublicTargetPlan(targets.targets);
      if (count + targets.targets.length + 2 > policy.maxReads) stop("PUBLIC_READ_BUDGET");
      const deadline = clock() + policy.phaseMs;
      const observations = [],
        rules = targets.headers ? parseStaticHeaderRules(targets.headers) : [],
        startedAt = new Date(clock()).toISOString();
      let pending = targets.targets,
        attempt = 0,
        alternateEndpoints;
      const report = (status) => ({
        status,
        expectedVersionId: image.versionId,
        startedAt,
        observedAt: new Date(clock()).toISOString(),
        attempts: attempt,
        requests: count,
        observedBytes,
        observations,
        ...(alternateEndpoints ? { alternateEndpoints } : {}),
      });
      try {
        while (pending.length) {
          if (attempt >= policy.maxAttempts) stop("PUBLIC_BYTES_MISMATCH");
          attempt++;
          if (attempt > 1) {
            if (clock() + policy.reobserveMs >= deadline) stop("PUBLIC_READBACK_STALE");
            await wait(policy.reobserveMs);
            await assertSameVersion();
          }
          const next = [];
          for (const target of pending) {
            const external = target.path.startsWith("https://");
            let current;
            try {
              if (count + 1 + 2 > policy.maxReads) stop("PUBLIC_READ_BUDGET");
              current = await read(
                external ? target.path : "https://" + authority.hostname + target.path,
                publicObservationBodyLimit(target.path, target.bytes),
                deadline,
                target,
              );
            } catch (error) {
              // The path is already admitted by the artifact plan. Never copy a
              // transport message, redirect Location, body or signed URL here.
              const errorCode =
                error instanceof ManualDeployError && observationErrorCodes.has(error.message)
                  ? error.message
                  : "PUBLIC_READ_FAILED";
              observations.push({
                path: target.path,
                attempt,
                observedAt: new Date(clock()).toISOString(),
                expected: { status: 200, bytes: target.bytes, sha256: target.sha256 },
                errorCode,
                matches: false,
              });
              throw error;
            }
            const expectedHeaders = external ? {} : headersForPath(target.path, rules);
            const headerKeys = Object.keys(expectedHeaders)
              .filter((name) => Object.hasOwn(current.headers, name))
              .sort();
            const headerHash = (value) =>
              hashBytes(JSON.stringify(headerKeys.map((key) => [key, value[key] ?? null])));
            const expected = {
              status: 200,
              bytes: target.bytes,
              sha256: target.sha256,
              headersSha256: headerHash(expectedHeaders),
            };
            const actual = {
              status: current.status,
              bytes: current.bytes,
              sha256: current.sha256,
              headersSha256: headerHash(current.headers),
            };
            const exact = expected.bytes === actual.bytes && expected.sha256 === actual.sha256;
            const accessProtected =
              current.accessProtected === true && isEditorProtectedShellPath(target.path);
            const matches =
              accessProtected ||
              (expected.status === actual.status &&
                expected.headersSha256 === actual.headersSha256 &&
                (exact || current.managedRobots !== null));
            // Preserve raw wire-body facts; never replace them with origin facts.
            // Exact equality alone makes no assertion about Cloudflare settings.
            observations.push({
              path: target.path,
              attempt,
              observedAt: new Date(clock()).toISOString(),
              expected,
              actual,
              matches,
              bodyMatch: accessProtected
                ? "cloudflare-access-protected"
                : exact
                  ? "exact"
                  : current.managedRobots
                    ? "cloudflare-managed-robots"
                    : "mismatch",
              ...(current.managedRobots ? { managedRobots: current.managedRobots } : {}),
            });
            if (!matches) next.push(target);
          }
          pending = next;
        }
        await assertSameVersion();
        alternateEndpoints = await alternates(image, deadline);
        return report("verified");
      } catch (error) {
        // No body, raw response, credentials, query strings or arbitrary error text.
        if (error && typeof error === "object") reports.set(error, report("pending"));
        throw error;
      }
    },
  });
}
