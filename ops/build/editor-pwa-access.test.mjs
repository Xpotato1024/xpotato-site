import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { runInNewContext } from "node:vm";
import { editorWorkerSource, editorShellInventory } from "./editor-pwa.mjs";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const files = [
  { path: "/editor/index.html", sha256: "a".repeat(64), bytes: 128 },
  { path: "/editor/assets/editor.js", sha256: "b".repeat(64), bytes: 256 },
];

test("Access-protected editor precache includes same-origin credentials", () => {
  const worker = editorWorkerSource(files);
  assert.match(
    worker,
    /new Request\(requestPath\(path\),\{cache:'reload',credentials:'include'\}\)/,
  );
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
        return new Response(bodies.get(path === "/editor/" ? "/editor/index.html" : path));
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
  assert.deepEqual(fetched, ["/editor/", "/editor/fonts/core.woff2"]);
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

async function installShell(responseFor) {
  const bodies = new Map([
    ["/editor/index.html", "exact shell"],
    ["/editor/assets/editor.js", "exact app"],
  ]);
  const inventory = [...bodies].map(([path, body]) => ({
    path,
    bytes: Buffer.byteLength(body),
    sha256: createHash("sha256").update(body).digest("hex"),
  }));
  const listeners = new Map(),
    stored = new Map(),
    fetched = [],
    deleted = [];
  runInNewContext(editorWorkerSource(inventory), {
    crypto: webcrypto,
    URL,
    Response,
    Request: class {
      constructor(path, options) {
        this.path = path;
        this.options = options;
      }
    },
    self: { addEventListener: (type, handler) => listeners.set(type, handler) },
    caches: {
      has: async () => false,
      open: async () => ({
        put: async (path, response) => stored.set(path, await response.text()),
      }),
      delete: async (key) => {
        deleted.push(key);
        return true;
      },
    },
    fetch: async (request) => {
      fetched.push(request);
      const body = bodies.get(request.path === "/editor/" ? "/editor/index.html" : request.path);
      return responseFor(request.path, body);
    },
  });
  let completed;
  listeners.get("install")({
    waitUntil: (task) => {
      completed = task;
    },
  });
  return { completed, stored, fetched, deleted };
}

test("canonical shell URL installs behind Static Assets redirects without weakening exact-byte checks", async () => {
  const run = await installShell((path, body) => {
    if (path === "/editor/index.html")
      return Response.redirect("https://xpotato.test/editor/", 307);
    return new Response(body);
  });
  await run.completed;
  assert.deepEqual(
    run.fetched.map((request) => request.path),
    ["/editor/", "/editor/assets/editor.js"],
  );
  for (const request of run.fetched) {
    assert.equal(request.options.credentials, "include");
    assert.equal(request.options.cache, "reload");
  }
  assert.equal(run.stored.get("/editor/index.html"), "exact shell");
  assert.equal(run.stored.get("/editor/assets/editor.js"), "exact app");
  assert.equal(run.deleted.length, 0);
});

test("login redirects and changed shell bytes still reject installation and discard the partial cache", async () => {
  for (const fault of ["redirect", "body"]) {
    const run = await installShell((path, body) => {
      const response = new Response(
        path === "/editor/" && fault === "body" ? "sign-in page" : body,
      );
      if (path === "/editor/" && fault === "redirect")
        Object.defineProperty(response, "redirected", { value: true });
      return response;
    });
    await assert.rejects(run.completed, /EDITOR_SHELL_HASH_MISMATCH/);
    assert.equal(run.stored.size, 0);
    assert.equal(run.deleted.length, 1);
  }
});

test("precache includes approved CMS icon paths but rejects arbitrary raster", async () => {
  const root = await mkdtemp(join(tmpdir(), "cms-brand-"));
  try {
    await writeFile(join(root, "index.html"), "shell");
    const icons = [
      "xpotato-cms.svg",
      "xpotato-cms-small.svg",
      "xpotato-cms-maskable.svg",
      "xpotato-cms-16.png",
      "xpotato-cms-32.png",
      "xpotato-cms-48.png",
      "xpotato-cms-180.png",
      "xpotato-cms-192.png",
      "xpotato-cms-512.png",
      "xpotato-cms-maskable-512.png",
    ];
    for (const icon of icons) await writeFile(join(root, icon), "fixture");
    const files = await editorShellInventory(root);
    for (const icon of icons) {
      assert.ok(files.some((entry) => entry.path === "/editor/" + icon));
      assert.ok(editorWorkerSource(files).includes("/editor/" + icon));
    }
    await writeFile(join(root, "xpotato-cms-64.png"), "not approved");
    await assert.rejects(() => editorShellInventory(root), /EDITOR_ASSET_NOT_ALLOWED/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
