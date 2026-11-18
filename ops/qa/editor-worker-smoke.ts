import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { Miniflare, Response as RuntimeResponse } from "miniflare";
import { seal } from "../../apps/editor-api/src/auth.js";

const storage = await mkdtemp(join(tmpdir(), "xpotato-editor-r2-"));
const origin = "https://xpotato.example";
const secret = "native-local-worker-fixture-secret-at-least-32-chars";
const csrf = "native-local-csrf";
const cookie =
  "__Host-xpotato-editor=" +
  (await seal(
    {
      userId: "190472511",
      login: "fixture",
      token: "synthetic-no-network-token",
      csrf,
      issued: Date.now(),
      expires: Date.now() + 600000,
    },
    secret,
  ));
const bundled = await readFile(resolve("apps/editor-api/dist/worker.js"), "utf8");
const createRuntime = () =>
  new Miniflare({
    telemetry: { enabled: false },
    resourcePersistencePath: storage,
    workers: [
      {
        config: {
          name: "editor-native-smoke",
          compatibilityDate: "2026-10-01",
          manifest: {
            mainModule: "worker.js",
            modules: { "worker.js": { type: "esm", contents: bundled } },
          },
          env: {
            ...Object.fromEntries(
              Object.entries({
                GITHUB_APP_ID: "123",
                GITHUB_CLIENT_ID: "fixture-client",
                GITHUB_CLIENT_SECRET: "fixture-secret",
                SESSION_SECRET: secret,
                OWNER_GITHUB_ID: "190472511",
                EDITOR_ORIGIN: origin,
                EDITOR_REPOSITORY: "Xpotato1024/xpotato-site",
                GC_ENABLED: "false",
              }).map(([name, value]) => [name, { type: "text" as const, value }]),
            ),
            DRAFT_MEDIA: { type: "r2", name: "editor-native-draft" },
          },
        },
        dev: {
          outboundService: {
            type: "fetcher",
            handler: () => new RuntimeResponse("External requests forbidden", { status: 503 }),
          },
        },
      },
    ],
  });

let runtime: Miniflare | undefined;
const bytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWOoCJj2HwAFAAJeoZPDtAAAAABJRU5ErkJggg==",
  "base64",
);
const hash = createHash("sha256").update(bytes).digest("hex");
const draftId = "11111111-1111-4111-8111-111111111111";
const call = (path: string, method = "GET", body?: unknown) =>
  runtime!.dispatchFetch(origin + "/editor-api" + path, {
    method,
    headers: {
      Cookie: cookie,
      Origin: origin,
      "X-CSRF-Token": csrf,
      "Content-Type": body instanceof Uint8Array ? "image/png" : "application/json",
    },
    ...(body === undefined
      ? {}
      : { body: body instanceof Uint8Array ? body : JSON.stringify(body) }),
  });
try {
  runtime = createRuntime();
  assert.equal((await runtime.dispatchFetch(origin + "/editor-api/drafts")).status, 401);
  assert.equal(
    (
      await runtime.dispatchFetch(origin + "/editor-api/drafts", {
        method: "POST",
        headers: { Cookie: cookie, Origin: "https://untrusted.example" },
        body: "{}",
      })
    ).status,
    403,
  );
  const created = await call("/drafts", "POST", {
    id: draftId,
    contentId: "22222222-2222-4222-8222-222222222222",
    branch: "content/native-smoke",
    commit: "a".repeat(40),
  });
  assert.equal(created.status, 201, await created.text());
  const reservationResponse = await call("/media/reserve", "POST", {
    draftId,
    assetId: "native-image",
    sha256: hash,
    sourceSha256: hash,
    bytes: bytes.length,
    sourceBytes: bytes.length,
    kind: "technical",
    mime: "image/png",
    expectedDraftRevision: 1,
    transform: "identity-v1",
    sourceRetained: true,
  });
  assert.equal(reservationResponse.status, 201);
  const reservation = (await reservationResponse.json()) as { id: string };
  const upload = await call("/media/upload/" + reservation.id, "PUT", new Uint8Array(bytes));
  assert.equal(upload.status, 201, await upload.text());
  const before = await call("/media/" + reservation.id);
  assert.equal(before.status, 200);
  assert.match(before.headers.get("Cache-Control")!, /no-store/u);
  assert.deepEqual(Buffer.from(await before.arrayBuffer()), bytes);
  await runtime.dispose();
  runtime = createRuntime();
  const after = await call("/media/" + reservation.id);
  assert.equal(after.status, 200);
  assert.deepEqual(Buffer.from(await after.arrayBuffer()), bytes);
  const snapshot = (await (await call("/draft?id=" + draftId)).json()) as {
    draft: { revision: number; assets: Record<string, string> };
  };
  assert.equal(snapshot.draft.revision, 2);
  assert.equal(snapshot.draft.assets["native-image"], reservation.id);
  const quota = (await (await call("/quota")).json()) as { used: number; reserved: number };
  assert.equal(quota.used, bytes.length);
  assert.equal(quota.reserved, 0);
  console.log(
    "Native workerd/R2 PASS: authenticated write/read, CSRF rejection, conditional state, exact media bytes, restart persistence. External provider calls: 0; live authorization: not verified.",
  );
} finally {
  await runtime?.dispose();
  await rm(storage, { recursive: true, force: true, maxRetries: 3 });
}
