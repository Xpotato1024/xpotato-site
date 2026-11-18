import { test } from "node:test";
import assert from "node:assert/strict";
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
