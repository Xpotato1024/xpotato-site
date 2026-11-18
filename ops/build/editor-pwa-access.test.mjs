import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { runInNewContext } from "node:vm";
import { editorWorkerSource } from "./editor-pwa.mjs";

const files = [
  { path: "/editor/index.html", sha256: "a".repeat(64), bytes: 128 },
  { path: "/editor/assets/editor.js", sha256: "b".repeat(64), bytes: 256 },
];

test("Access-protected editor precache includes same-origin credentials", () => {
  const worker = editorWorkerSource(files);
  assert.match(worker, /new Request\(path,\{cache:'reload',credentials:'include'\}\)/);
  assert.doesNotMatch(worker, /credentials:'omit'/);
});

test("editor service worker keeps API and other site routes out of offline cache", () => {
  const worker = editorWorkerSource(files);
  assert.match(worker, /const ALLOWED=new Set\(FILES\)/);
  assert.match(worker, /ALLOWED\.has\(path\)/);
  assert.doesNotMatch(worker, /\/editor-api\/session/);
  assert.match(worker, /response\.redirected/);
  assert.match(worker, /EDITOR_SHELL_HASH_MISMATCH/);
});

test("preview font subsets load on demand and enter the same verified offline cache", async () => {
  const bodies = new Map([
    ["/editor/index.html", "shell"],
    ["/editor/fonts/core.woff2", "core"],
    ["/editor/fonts/preview.woff2", "preview"],
  ]);
  const inventory = [...bodies].map(([path, body]) => ({
    path,
    bytes: Buffer.byteLength(body),
    sha256: createHash("sha256").update(body).digest("hex"),
  }));
  const listeners = new Map(),
    stored = new Map(),
    fetched = [];
  runInNewContext(
    editorWorkerSource(inventory, { lazyFontPaths: ["/editor/fonts/preview.woff2"] }),
    {
      crypto: webcrypto,
      URL,
      Response,
      Request: class {
        constructor(path) {
          this.path = path;
        }
      },
      self: {
        location: { origin: "https://xpotato.test" },
        addEventListener: (type, handler) => listeners.set(type, handler),
      },
      caches: {
        has: async () => false,
        open: async () => ({
          put: async (path, response) => stored.set(path, response),
          match: async (path) => stored.get(path),
        }),
        delete: async () => true,
      },
      fetch: async (request) => {
        const path = request.path ?? new URL(request.url).pathname;
        fetched.push(path);
        return new Response(bodies.get(path));
      },
    },
  );
  let installed;
  listeners.get("install")({
    waitUntil: (task) => {
      installed = task;
    },
  });
  await installed;
  assert.deepEqual(fetched, ["/editor/index.html", "/editor/fonts/core.woff2"]);
  let received;
  listeners.get("fetch")({
    request: {
      method: "GET",
      url: "https://xpotato.test/editor/fonts/preview.woff2",
      headers: new Headers(),
      mode: "cors",
    },
    respondWith: (task) => {
      received = task;
    },
  });
  assert.equal(await (await received).text(), "preview");
  assert.ok(stored.has("/editor/fonts/preview.woff2"));
  assert.throws(
    () => editorWorkerSource(inventory, { lazyFontPaths: ["/editor-api/draft"] }),
    /EDITOR_LAZY_ASSET_NOT_FONT/,
  );
});
