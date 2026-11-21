import {
  assertPackageSourceParity,
  currentGuardPaths,
  operationManualControlPaths,
} from "./manual-deployment-source-policy.mjs";
import "./manual-deployment-source.integration.test.mjs";
import "./managed-robots-policy.test.mjs";
import "./readback-only.test.mjs";
import "./readback-only-cli.test.mjs";
import "./site-icon-asset.test.mjs";
import { createHash } from "node:crypto";
import { assertManualWorkflow } from "./manual-deployment-workflow-policy.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import { authority } from "./deployment-policy.mjs";
import {
  createManualProvider,
  ManualDeployError,
  assessZoneWorkerRoutes,
} from "./manual-deployment-provider.mjs";
import {
  requireManualRun,
  runManualDeployment,
  readPublicTargets,
  hashBytes,
  runTokenDiagnosticsOnly,
} from "./manual-deployment.mjs";
import { createManualGitHub } from "./manual-deployment-github.mjs";
import { createPublicReadback } from "./manual-deployment-public.mjs";
import { assertPublicTargetPlan, publicReadbackPolicy } from "./shared/public-readback-policy.mjs";
import {
  homeWorkshopPublicObjects,
  assertHomeWorkshopPublicObject,
  assertHomeWorkshopPublicObjects,
  assertHomeWorkshopImageReferences,
  isRasterBytes,
} from "./home-workshop-public-policy.mjs";
import {
  cleanToolEnvironment,
  createWranglerDeploy,
  executeCaptured,
} from "./manual-deployment-process.mjs";
const now = Date.parse("2026-10-12T14:00:00Z"),
  uid = (n) => n.toString(16).padStart(8, "0") + "-0000-4000-8000-000000000000",
  id = (n) => String(n).repeat(32);
const selection = {
  artifactId: "12",
  digest: "sha256:" + "d".repeat(64),
  runId: "11",
  runAttempt: 1,
  sourceSha: "a".repeat(40),
};
const env = {
  GITHUB_REPOSITORY: authority.repository,
  GITHUB_EVENT_NAME: "workflow_dispatch",
  GITHUB_REF: "refs/heads/main",
  GITHUB_ACTOR: "Xpotato1024",
  GITHUB_TRIGGERING_ACTOR: "Xpotato1024",
  GITHUB_RUN_ATTEMPT: "1",
  GITHUB_SHA: "b".repeat(40),
  GITHUB_RUN_ID: "13",
  OWNER_RECOVERY_READY: "true",
};
const context = {
  accountId: id(1),
  ownerPolicyReviewed: true,
  tokenPolicy: {
    createdOnUtcDate: "2026-10-01",
    issuedOn: null,
    reviewSource: "owner-created-and-saved-token",
  },
};
const image = {
  observedAt: new Date(now).toISOString(),
  deploymentId: uid(1),
  versionId: uid(2),
  workerTag: id(2),
  accountSubdomain: "example",
  bindings: 0,
  routes: 0,
  workersDev: false,
  previewUrls: false,
  hostname: authority.hostname,
};
function fixture(overrides = {}) {
  const calls = [],
    handoff = {
      mode: "Production",
      sourceSha: selection.sourceSha,
      artifactId: selection.artifactId,
      digest: selection.digest,
    };
  let snapshots = 0;
  const step = (name) => async () => {
    calls.push(name);
    return undefined;
  };
  const result = {
    env,
    selection,
    clock: () => now,
    wait: async () => {
      calls.push("postversion-wait");
    },
    provider: {
      verifyDeployToken: async () => {
        calls.push("token");
        return {
          tokenId: id(4),
          expiresOn: "2026-12-20T00:00:00Z",
          scopeEvidence: "OWNER_PINNED_INITIAL_POLICY",
        };
      },
      snapshot: async () => {
        calls.push("snapshot");
        return { ...image, versionId: ++snapshots === 3 ? uid(3) : uid(2) };
      },
      postVersionSnapshot: async () => result.provider.snapshot(),
    },
    verifyGitHub: step("github"),
    verifyHandoff: async () => {
      calls.push("handoff");
      return { ...handoff };
    },
    loadTargets: async () => {
      calls.push("targets");
      return { targets: [{ path: "/", bytes: 1, sha256: "a".repeat(64) }] };
    },
    probeBefore: async () => {
      calls.push("before");
      return {
        publicStatus: 200,
        homeSha256: "a".repeat(64),
        workersDevStatus: 404,
        previewStatus: 404,
      };
    },
    verifyPublished: step("published"),
    persistPreimage: step("persist"),
    deployOnce: async () => {
      calls.push("deploy");
      return { count: 1, exitCode: 0, versionId: uid(3) };
    },
    ...overrides,
  };
  return { calls, input: result };
}
test("manual owner/main/first attempt and real recovery acknowledgement are mandatory", () => {
  for (const key of [
    "GITHUB_REPOSITORY",
    "GITHUB_EVENT_NAME",
    "GITHUB_REF",
    "GITHUB_ACTOR",
    "GITHUB_TRIGGERING_ACTOR",
    "GITHUB_RUN_ATTEMPT",
    "OWNER_RECOVERY_READY",
    "GITHUB_SHA",
    "GITHUB_RUN_ID",
  ])
    assert.throws(
      () => requireManualRun({ ...env, [key]: "wrong" }),
      /MANUAL_OWNER_MAIN_RUN_REQUIRED/,
    );
});
test("valid operation persists preimage before one write and keeps token active", async () => {
  const f = fixture(),
    r = await runManualDeployment(f.input);
  assert.equal(r.status, "DEPLOYED_READBACK_VERIFIED");
  assert.equal(r.deployCount, 1);
  assert.equal(r.buildCount, 0);
  assert.equal(r.scopeLiveReadback, false);
  assert.equal(f.calls.filter((x) => x === "deploy").length, 1);
  assert.ok(f.calls.indexOf("persist") < f.calls.indexOf("deploy"));
  assert.ok(f.calls.indexOf("published") > f.calls.indexOf("deploy"));
});
for (const corrupt of [false, true])
  test(
    "managed robots " +
      (corrupt
        ? "mismatch preserves acknowledged deployment without retrying writes"
        : "proof completes verification after one synthetic deployment"),
    async () => {
      const capture = JSON.parse(
        await readFile(new URL("./fixtures/managed-robots-20261104.json", import.meta.url), "utf8"),
      );
      const body = Buffer.from(capture.body);
      if (corrupt) body[0] ^= 1;
      const reader = createPublicReadback({
        wait: async () => {},
        fetchImpl: async (url) =>
          new Response(url.includes("workers.dev") ? "missing" : body, {
            status: url.includes("workers.dev") ? 404 : 200,
          }),
      });
      const f = fixture({
        loadTargets: async () => ({
          targets: [
            { path: "/robots.txt", bytes: capture.originBytes, sha256: capture.originSha256 },
          ],
        }),
        verifyPublished: reader.published,
      });
      f.input.provider.assertSameVersion = async () => {};
      const result = await runManualDeployment(f.input);
      assert.equal(result.deployment.status, "acknowledged");
      assert.equal(result.deployCount, 1);
      assert.equal(f.calls.filter((c) => c === "deploy").length, 1);
      assert.equal(result.verification.status, corrupt ? "pending" : "verified");
      assert.equal(result.readback.status, corrupt ? "pending" : "verified");
      assert.equal(
        result.status,
        corrupt ? "STOPPED_OWNER_RECOVERY_REQUIRED" : "DEPLOYED_READBACK_VERIFIED",
      );
      assert.equal(result.readback.observations[0].actual.bytes, 2746);
      assert.ok(!JSON.stringify(result).includes(capture.body));
      if (corrupt) {
        assert.equal(result.code, "PUBLIC_BYTES_MISMATCH");
        assert.equal(result.rollbackExecuted, false);
        assert.equal(result.credentialRevoked, false);
      }
    },
  );
test("acknowledged deployment and postimage survive a later verification failure", async () => {
  const progress = [],
    f = fixture({
      persistProgress: async (p) => progress.push(structuredClone(p)),
      verifyPublished: async () => {
        throw Error("private output");
      },
    });
  const result = await runManualDeployment(f.input);
  assert.equal(result.deployment.status, "acknowledged");
  assert.equal(result.deployment.receipt.versionId, uid(3));
  assert.equal(result.verification.status, "failed");
  assert.equal(result.postimage.versionId, uid(3));
  assert.ok(progress.some((p) => p.deployment.status === "acknowledged"));
  assert.equal(f.calls.filter((c) => c === "deploy").length, 1);
  assert.ok(!JSON.stringify(result).includes("private output"));
});
test("progress failure before invocation reports no deployment; later failure preserves verified GET evidence", async () => {
  const before = fixture({
      persistProgress: async () => {
        throw Error("local disk failure");
      },
    }),
    stopped = await runManualDeployment(before.input);
  assert.equal(stopped.deployCount, 0);
  assert.equal(stopped.deployment.status, "not_attempted");
  assert.ok(!before.calls.includes("deploy"));
  const after = fixture({ verifyPublished: async () => ({ status: "verified", requests: 4 }) });
  let tokens = 0;
  after.input.provider.verifyDeployToken = async () => ({
    tokenId: ++tokens === 3 ? id(9) : id(4),
    expiresOn: "2026-12-20T00:00:00Z",
  });
  const result = await runManualDeployment(after.input);
  assert.equal(result.code, "TOKEN_CHANGED_AFTER_DEPLOY");
  assert.equal(result.readback.status, "verified");
  assert.equal(result.verification.status, "verified");
  assert.equal(result.deployment.status, "acknowledged");
});
for (const gate of [
  "verifyGitHub",
  "verifyHandoff",
  "loadTargets",
  "probeBefore",
  "persistPreimage",
])
  test(gate + " failure stops before write", async () => {
    const f = fixture({
      [gate]: async () => {
        throw Error("synthetic-private-output");
      },
    });
    const r = await runManualDeployment(f.input);
    assert.equal(r.status, "STOPPED_BEFORE_DEPLOY");
    assert.equal(r.deployCount, 0);
    assert.ok(!f.calls.includes("deploy"));
    assert.ok(!JSON.stringify(r).includes("synthetic-private-output"));
  });
test("second handoff identity drift stops before write", async () => {
  let count = 0;
  const f = fixture({
    verifyHandoff: async () => ({
      mode: "Production",
      sourceSha: selection.sourceSha,
      artifactId: ++count === 1 ? selection.artifactId : "99",
      digest: selection.digest,
    }),
  });
  assert.equal((await runManualDeployment(f.input)).code, "HANDOFF_OR_TARGETS_CHANGED");
  assert.ok(!f.calls.includes("deploy"));
});
test("preimage drift cannot be deployed", async () => {
  const f = fixture();
  let count = 0;
  f.input.provider.snapshot = async () => ({
    ...image,
    versionId: ++count === 2 ? uid(99) : uid(2),
  });
  assert.equal((await runManualDeployment(f.input)).code, "PREIMAGE_CHANGED");
  assert.ok(!f.calls.includes("deploy"));
});
for (const gate of ["deployOnce", "verifyPublished"])
  test(gate + " failure yields owner recovery and no automatic rollback/revoke", async () => {
    const f = fixture({
      [gate]: async () => {
        throw Error("synthetic-private-output");
      },
    });
    const r = await runManualDeployment(f.input);
    assert.equal(r.status, "STOPPED_OWNER_RECOVERY_REQUIRED");
    assert.equal(r.deployCount, 1);
    assert.equal(r.rollbackExecuted, false);
    assert.equal(r.credentialRevoked, false);
  });
test("receipt/provider version mismatch is never reported as successful", async () => {
  const f = fixture({ deployOnce: async () => ({ count: 1, exitCode: 0, versionId: uid(99) }) });
  const result = await runManualDeployment(f.input);
  assert.equal(result.code, "POST_VERSION_MISMATCH");
  assert.equal(result.deployCount, 1);
  assert.equal(f.calls.filter((value) => value === "postversion-wait").length, 0);
});
test("post-deploy read-only snapshot waits for the acknowledged version to become active", async () => {
  const f = fixture();
  let snapshots = 0;
  f.input.provider.snapshot = async () => {
    f.calls.push("snapshot");
    snapshots++;
    return snapshots <= 4 ? { ...image } : { ...image, deploymentId: uid(7), versionId: uid(3) };
  };
  const result = await runManualDeployment(f.input);
  assert.equal(result.status, "DEPLOYED_READBACK_VERIFIED");
  assert.equal(result.deployment.receipt.versionId, uid(3));
  assert.equal(result.postimage.versionId, uid(3));
  assert.equal(result.postimage.deploymentId, uid(7));
  assert.equal(f.calls.filter((value) => value === "postversion-wait").length, 2);
  assert.equal(f.calls.filter((value) => value === "deploy").length, 1);
});
test("unexpected third-party active version fails closed without retrying the deployment", async () => {
  const f = fixture();
  let snapshots = 0;
  f.input.provider.snapshot = async () => {
    f.calls.push("snapshot");
    return { ...image, versionId: ++snapshots > 2 ? uid(8) : uid(2) };
  };
  const result = await runManualDeployment(f.input);
  assert.equal(result.code, "POST_VERSION_MISMATCH");
  assert.equal(result.deployCount, 1);
  assert.equal(f.calls.filter((value) => value === "postversion-wait").length, 0);
  assert.equal(f.calls.filter((value) => value === "deploy").length, 1);
});
test("post-version polling rejects a matching snapshot returned at the deadline", async () => {
  const f = fixture();
  let time = now;
  f.input.clock = () => time;
  f.input.provider.postVersionSnapshot = async () => {
    time += 90_000;
    return { ...image, versionId: uid(3) };
  };
  const result = await runManualDeployment(f.input);
  assert.equal(result.code, "POST_VERSION_MISMATCH");
  assert.equal(result.deployCount, 1);
  assert.equal(result.verification.status, "not_started");
  assert.equal(time, now + 90_000);
  assert.ok(!f.calls.includes("published"));
});
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
function providerFixture(change = () => {}, manualContext = context, clock = () => now) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    const path = new URL(url).pathname;
    calls.push({ url, method: options.method, authorization: options.headers.Authorization });
    let result, info;
    if (path.endsWith("/tokens/verify"))
      result = {
        id: options.headers.Authorization.endsWith("writecredential00") ? id(4) : id(5),
        status: "active",
        expires_on: "2026-12-20T00:00:00Z",
        not_before: "2026-10-01T00:00:00Z",
      };
    else if (path.endsWith("/scripts")) result = [{ id: authority.worker, tag: id(2) }];
    else if (path.endsWith("/settings")) result = { bindings: [] };
    else if (path.endsWith("/deployments"))
      result = {
        deployments: [
          {
            id: uid(1),
            strategy: "percentage",
            versions: [{ version_id: uid(2), percentage: 100 }],
          },
        ],
      };
    else if (path.includes("/versions/")) result = { id: uid(2), resources: { bindings: [] } };
    else if (path.endsWith("/scripts/" + authority.worker + "/subdomain"))
      result = { enabled: false, previews_enabled: false };
    else if (path.endsWith("/domains")) {
      result = [
        {
          id: "domain",
          service: authority.worker,
          hostname: authority.hostname,
          environment: "production",
          zone_id: id(3),
          enabled: true,
          previews_enabled: false,
        },
      ];
      info = { page: 1, per_page: 100, count: 1, total_count: 1 };
    } else if (path.endsWith("/routes")) {
      result = [];
      info = { page: 1, per_page: 100, count: 0, total_count: 0 };
    } else if (path.endsWith("/workers/subdomain")) result = { subdomain: "example" };
    else throw Error("unexpected");
    const body = { success: true, errors: [], result, ...(info ? { result_info: info } : {}) };
    const status = change(path, body) || 200;
    return json(body, status);
  };
  return {
    calls,
    provider: createManualProvider({
      context: manualContext,
      readonlyCredential: async () => "readcredential000",
      deployCredential: async () => "writecredential00",
      fetchImpl,
      clock,
    }),
  };
}
test("all 15 post-version snapshots leave room for public retries and final token verification", async () => {
  let deployed = false,
    postSnapshots = 0,
    time = now,
    publicReads = 0;
  const pf = providerFixture(
    (path, body) => {
      if (deployed && path.endsWith("/scripts")) postSnapshots++;
      if (postSnapshots === 15 && path.endsWith("/deployments")) {
        body.result.deployments[0].id = uid(3);
        body.result.deployments[0].versions[0].version_id = uid(3);
      }
      if (postSnapshots === 15 && path.includes("/versions/")) body.result.id = uid(3);
    },
    context,
    () => time,
  );
  const reader = createPublicReadback({
    clock: () => time,
    wait: async (ms) => {
      time += ms;
    },
    fetchImpl: async (url) =>
      new Response(url.includes("workers.dev") ? "missing" : ++publicReads < 4 ? "old" : "new", {
        status: url.includes("workers.dev") ? 404 : 200,
      }),
  });
  const f = fixture({
    provider: pf.provider,
    clock: () => time,
    wait: async (ms) => {
      time += ms;
    },
    loadTargets: async () => ({ targets: [{ path: "/", bytes: 3, sha256: hashBytes("new") }] }),
    probeBefore: reader.before,
    verifyPublished: reader.published,
    deployOnce: async () => {
      f.calls.push("deploy");
      deployed = true;
      return { count: 1, exitCode: 0, versionId: uid(3) };
    },
  });
  const result = await runManualDeployment(f.input);
  assert.equal(result.status, "DEPLOYED_READBACK_VERIFIED");
  assert.equal(result.readback.attempts, 3);
  assert.equal(postSnapshots, 15);
  assert.equal(pf.calls.length, 210);
  assert.equal(time - now, 58_000);
  assert.equal(f.calls.filter((call) => call === "deploy").length, 1);
  assert.ok(pf.calls.every((call) => call.method === "GET"));
});
test("unchanged active version stops after 15 complete real-adapter snapshots without another deploy", async () => {
  let time = now;
  const pf = providerFixture(
    () => {},
    context,
    () => time,
  );
  const f = fixture({
    provider: pf.provider,
    clock: () => time,
    wait: async (ms) => {
      time += ms;
    },
  });
  const result = await runManualDeployment(f.input);
  assert.equal(result.code, "POST_VERSION_MISMATCH");
  assert.equal(result.deployment.status, "acknowledged");
  assert.equal(result.verification.status, "not_started");
  assert.equal(result.deployCount, 1);
  assert.equal(pf.calls.length, 206);
  assert.equal(time - now, 56_000);
  assert.equal(f.calls.filter((call) => call === "deploy").length, 1);
  assert.ok(!f.calls.includes("published"));
});
for (const drift of ["worker", "settings", "version", "deployment"])
  test(
    "post-version polling rejects " + drift + " drift before waiting or public verification",
    async () => {
      let deployed = false;
      const pf = providerFixture((path, body) => {
        if (!deployed) return;
        if (drift === "worker" && path.endsWith("/scripts")) body.result[0].tag = id(8);
        if (drift === "settings" && path.endsWith("/settings"))
          body.result.bindings = [{ type: "r2_bucket", name: "unexpected" }];
        if (drift === "version" && path.endsWith("/deployments"))
          body.result.deployments[0].versions[0].version_id = uid(8);
        if (drift === "version" && path.includes("/versions/")) body.result.id = uid(8);
        if (drift === "deployment" && path.endsWith("/deployments"))
          body.result.deployments[0].id = uid(8);
      });
      const f = fixture({
        provider: pf.provider,
        deployOnce: async () => {
          f.calls.push("deploy");
          deployed = true;
          return { count: 1, exitCode: 0, versionId: uid(3) };
        },
      });
      const result = await runManualDeployment(f.input);
      assert.equal(
        result.code,
        drift === "worker"
          ? "WORKER_IDENTITY"
          : drift === "settings"
            ? "BINDINGS_DRIFT"
            : "POST_VERSION_MISMATCH",
      );
      assert.equal(result.deployCount, 1);
      assert.equal(f.calls.filter((call) => call === "deploy").length, 1);
      assert.ok(!f.calls.includes("postversion-wait"));
      assert.ok(!f.calls.includes("published"));
    },
  );
test("a receipt-matching full snapshot cannot succeed after the post-version deadline", async () => {
  let deployed = false,
    time = now;
  const pf = providerFixture(
    (path, body) => {
      if (!deployed) return;
      time += 8000;
      if (path.endsWith("/deployments")) {
        body.result.deployments[0].id = uid(3);
        body.result.deployments[0].versions[0].version_id = uid(3);
      }
      if (path.includes("/versions/")) body.result.id = uid(3);
    },
    context,
    () => time,
  );
  const f = fixture({
    provider: pf.provider,
    clock: () => time,
    deployOnce: async () => {
      f.calls.push("deploy");
      deployed = true;
      return { count: 1, exitCode: 0, versionId: uid(3) };
    },
  });
  const result = await runManualDeployment(f.input);
  assert.equal(result.status, "STOPPED_OWNER_RECOVERY_REQUIRED");
  assert.equal(result.code, "REMOTE_TIMEOUT");
  assert.equal(result.deployCount, 1);
  assert.equal(result.verification.status, "not_started");
  assert.equal(pf.calls.length, 38);
  assert.ok(!f.calls.includes("published"));
});
test("post-version reads retain a separate finite budget and cannot extend their deadline", async () => {
  const pf = providerFixture();
  await assert.rejects(
    () => pf.provider.postVersionSnapshot({ deadlineAt: now + 90_000 }),
    /POST_VERSION_SNAPSHOT_REQUIRED/,
  );
  await pf.provider.snapshot();
  await assert.rejects(() => pf.provider.postVersionSnapshot(), /POST_VERSION_DEADLINE_INVALID/);
  await assert.rejects(
    () => pf.provider.postVersionSnapshot({ deadlineAt: now + 90_001 }),
    /POST_VERSION_DEADLINE_INVALID/,
  );
  const deadlineAt = now + 90_000;
  for (let attempt = 0; attempt < 15; attempt++)
    await pf.provider.postVersionSnapshot({ deadlineAt });
  assert.equal(pf.calls.length, 192);
  await assert.rejects(
    () => pf.provider.postVersionSnapshot({ deadlineAt: deadlineAt - 1 }),
    /POST_VERSION_DEADLINE_INVALID/,
  );
  await assert.rejects(
    () => pf.provider.postVersionSnapshot({ deadlineAt }),
    /PROVIDER_READ_BUDGET/,
  );
  assert.equal(pf.calls.length, 192);
  // Normal verification retains its original 64-read allowance (12 already used).
  for (let read = 12; read < 64; read++) await pf.provider.verifyDeployToken();
  await assert.rejects(() => pf.provider.verifyDeployToken(), /PROVIDER_READ_BUDGET/);
  assert.equal(pf.calls.length, 244);
});
test("provider uses readonly fixed GETs and writer only on its own verify endpoint", async () => {
  const f = providerFixture();
  const token = await f.provider.verifyDeployToken();
  const snapshot = await f.provider.snapshot();
  assert.equal(snapshot.versionId, uid(2));
  assert.equal(token.scopeLiveReadback, false);
  assert.ok(
    f.calls.every(
      (c) => c.method === "GET" && new URL(c.url).origin === "https://api.cloudflare.com",
    ),
  );
  assert.ok(
    f.calls
      .filter((c) => c.authorization.endsWith("writecredential00"))
      .every((c) => new URL(c.url).pathname.endsWith("/tokens/verify")),
  );
});
test("the dedicated CMS route allows one Site deploy and successful readback", async () => {
  let deployed = false,
    reads = 0,
    writes = 0;
  const pf = providerFixture((p, b) => {
    if (p.endsWith("/routes")) {
      delete b.result_info;
      b.result = [routeRow("xpotato.net/editor-api/*", "xpotato-editor-api")];
    }
    if (deployed && p.endsWith("/deployments")) {
      b.result.deployments[0].id = uid(3);
      b.result.deployments[0].versions[0].version_id = uid(3);
    }
    if (deployed && p.includes("/versions/")) b.result.id = uid(3);
  });
  const publicReader = createPublicReadback({
    clock: () => now,
    wait: async () => {},
    fetchImpl: async (url) =>
      new Response(url.includes("workers.dev") ? "missing" : ++reads < 4 ? "old" : "new", {
        status: url.includes("workers.dev") ? 404 : 200,
      }),
  });
  const f = fixture({
    provider: pf.provider,
    loadTargets: async () => ({ targets: [{ path: "/", bytes: 3, sha256: hashBytes("new") }] }),
    probeBefore: publicReader.before,
    verifyPublished: publicReader.published,
    deployOnce: async () => {
      deployed = true;
      writes++;
      return { count: 1, exitCode: 0, versionId: uid(3) };
    },
  });
  const result = await runManualDeployment(f.input);
  assert.equal(result.status, "DEPLOYED_READBACK_VERIFIED");
  assert.equal(result.preimage.routes, 0);
  assert.equal(result.readback.attempts, 3);
  assert.equal(writes, 1);
  assert.equal(pf.calls.length, 42);
  assert.ok(pf.calls.every((c) => c.method === "GET"));
  const before = pf.calls.length;
  await pf.provider.assertSameVersion({ deploymentId: uid(3), versionId: uid(3) });
  assert.equal(pf.calls.length, before + 1);
  await assert.rejects(
    () => pf.provider.assertSameVersion({ deploymentId: uid(4), versionId: uid(3) }),
    /POST_VERSION_CHANGED/,
  );
});
test("deployment first active page does not require <=100 lifetime history", async () => {
  const f = providerFixture((p, b) => {
    if (p.endsWith("/deployments"))
      b.result_info = { page: 1, per_page: 100, count: 1, total_count: 200 };
  });
  assert.equal((await f.provider.snapshot()).deploymentId, uid(1));
});
for (const [name, change] of [
  [
    "token expiry mismatch",
    (p, b) => {
      if (p.endsWith("/tokens/verify")) b.result.expires_on = "2030-01-01T00:00:00Z";
    },
  ],
  [
    "extra binding",
    (p, b) => {
      if (p.endsWith("/settings")) b.result.bindings = [{ type: "r2_bucket" }];
    },
  ],
  [
    "domain metadata incomplete",
    (p, b) => {
      if (p.endsWith("/domains")) delete b.result_info;
    },
  ],
  [
    "workersDev enabled",
    (p, b) => {
      if (p.endsWith("/scripts/" + authority.worker + "/subdomain")) b.result.enabled = true;
    },
  ],
  ["permission denied", () => 403],
])
  test("provider rejects " + name, async () => {
    const f = providerFixture(change);
    await assert.rejects(() =>
      name.startsWith("token") ? f.provider.verifyDeployToken() : f.provider.snapshot(),
    );
  });
test("public readback checks exact bytes and actual version preview prefix", async () => {
  const calls = [],
    body = "approved",
    r = createPublicReadback({
      fetchImpl: async (url) => {
        calls.push(url);
        return new Response(url.includes("workers.dev") ? "missing" : body, {
          status: url.includes("workers.dev") ? 404 : 200,
        });
      },
    });
  await r.before(image);
  await r.published({ targets: [{ path: "/", bytes: 8, sha256: hashBytes(body) }] }, image);
  assert.ok(
    calls.includes(
      "https://" + uid(2).slice(0, 8) + "-" + authority.worker + ".example.workers.dev/",
    ),
  );
});
test("public redirects and byte mismatch fail without writes", async () => {
  for (const response of [
    () => new Response("wrong", { status: 200 }),
    () => new Response("", { status: 302, headers: { Location: "https://example.test" } }),
  ]) {
    const r = createPublicReadback({ fetchImpl: async () => response() });
    await assert.rejects(() =>
      r.published({ targets: [{ path: "/", bytes: 1, sha256: "a".repeat(64) }] }, image),
    );
  }
});

test("owner-only editor challenge is verified separately from published bytes", async () => {
  const html = "approved";
  const location =
    "https://xpotato1024.cloudflareaccess.com/cdn-cgi/access/login/xpotato.net?kid=present&meta=present&redirect_url=%2Feditor%2F";
  const readback = createPublicReadback({
    fetchImpl: async (url) => {
      const pathname = new URL(url).pathname;
      if (pathname === "/editor/")
        return new Response(null, { status: 302, headers: { location } });
      return new Response(pathname === "/public/" ? html : "missing", {
        status: url.includes("workers.dev") ? 404 : 200,
      });
    },
  });
  const report = await readback.published(
    {
      targets: [
        { path: "/editor/", bytes: html.length, sha256: hashBytes(html) },
        { path: "/public/", bytes: html.length, sha256: hashBytes(html) },
      ],
    },
    image,
  );
  assert.equal(report.status, "verified");
  assert.equal(report.observations[0].actual.status, 302);
  assert.equal(report.observations[0].bodyMatch, "cloudflare-access-protected");
  assert.equal(report.observations[0].matches, true);
  assert.equal(report.observations[0].actual.sha256, null);
  assert.equal(report.observations[1].bodyMatch, "exact");
});
test("Cloudflare Access protects each exact signed CMS shell asset without pretending its bytes were read", async () => {
  const paths = [
    "/editor/",
    "/editor/index.html",
    "/editor/assets/AstroReview-CIwfr59E.js",
    "/editor/assets/index-CKLULtcL.css",
    "/editor/fonts/regular.woff2",
    "/editor/sw.js",
    "/editor/manifest.webmanifest",
    "/editor/icon.svg",
  ];
  const body = "approved";
  const readback = createPublicReadback({
    fetchImpl: async (url) => {
      if (url.includes("workers.dev")) return new Response("missing", { status: 404 });
      const path = new URL(url).pathname;
      if (paths.includes(path))
        return new Response(null, {
          status: 302,
          headers: {
            location:
              "https://xpotato1024.cloudflareaccess.com/cdn-cgi/access/login/xpotato.net?kid=present&meta=present&redirect_url=" +
              encodeURIComponent(path),
          },
        });
      return new Response(body, { status: 200 });
    },
  });
  const report = await readback.published(
    { targets: paths.map((path) => ({ path, bytes: body.length, sha256: hashBytes(body) })) },
    image,
  );
  assert.equal(report.status, "verified");
  assert.equal(report.observations.length, paths.length);
  for (const row of report.observations) {
    assert.equal(row.matches, true, row.path);
    assert.equal(row.actual.status, 302, row.path);
    assert.equal(row.actual.sha256, null, row.path);
    assert.equal(row.bodyMatch, "cloudflare-access-protected", row.path);
  }
});
test("Cloudflare Access cannot disguise an unexpected CMS path or redirect", async () => {
  const protectedAsset = "/editor/assets/AstroReview-CIwfr59E.js";
  const accessLocation = (path) =>
    "https://xpotato1024.cloudflareaccess.com/cdn-cgi/access/login/xpotato.net?kid=present&meta=present&redirect_url=" +
    encodeURIComponent(path);
  const bad = [
    ["/editor-api/session", accessLocation("/editor-api/session")],
    ["/editor/data.json", accessLocation("/editor/data.json")],
    ["/editor/assets/source.js.map", accessLocation("/editor/assets/source.js.map")],
    ["/editor/assets/source.exe", accessLocation("/editor/assets/source.exe")],
    ["/editor/fonts/source.ttf", accessLocation("/editor/fonts/source.ttf")],
    ["/editor/secret/", accessLocation("/editor/secret/")],
    ["/editor-evil/assets/index.js", accessLocation("/editor-evil/assets/index.js")],
    [protectedAsset, accessLocation("/editor/")],
    [protectedAsset, accessLocation(protectedAsset).replace("kid=present", "other=present")],
    [
      protectedAsset,
      accessLocation(protectedAsset).replace("xpotato1024.cloudflareaccess.com", "evil.example"),
    ],
    [
      protectedAsset,
      accessLocation(protectedAsset) + "&redirect_url=" + encodeURIComponent(protectedAsset),
    ],
  ];
  for (const [path, location] of bad) {
    const readback = createPublicReadback({
      fetchImpl: async () => new Response(null, { status: 302, headers: { location } }),
    });
    await assert.rejects(
      () =>
        readback.published({ targets: [{ path, bytes: 8, sha256: hashBytes("approved") }] }, image),
      /PUBLIC_HTTP_OR_REDIRECT/,
      path,
    );
  }
});
test("unknown redirects and Access-looking challenges outside the editor remain blocked", async () => {
  const valid =
    "https://xpotato1024.cloudflareaccess.com/cdn-cgi/access/login/xpotato.net?kid=1&meta=2&redirect_url=%2Feditor%2F";
  const bad = [
    ["/public/", valid],
    [
      "/editor/",
      "https://evil.example/cdn-cgi/access/login/xpotato.net?kid=1&meta=2&redirect_url=%2Feditor%2F",
    ],
    [
      "/editor/",
      valid.replace("redirect_url=%2Feditor%2F", "redirect_url=%2Feditor-api%2Fsession"),
    ],
    ["/editor/", valid.replace("kid=1", "other=1")],
    [
      "/editor/",
      valid.replace("xpotato1024.cloudflareaccess.com", "other-team.cloudflareaccess.com"),
    ],
    ["/editor/", valid.replace("https://", "http://")],
  ];
  for (const [path, location] of bad) {
    const readback = createPublicReadback({
      fetchImpl: async () => new Response(null, { status: 302, headers: { location } }),
    });
    await assert.rejects(
      () =>
        readback.published({ targets: [{ path, bytes: 8, sha256: hashBytes("approved") }] }, image),
      /PUBLIC_HTTP_OR_REDIRECT/,
      path + " " + location.slice(0, 35),
    );
  }
});
test("a transient cache mismatch is retried without accepting incorrect published bytes", async () => {
  let pageReads = 0;
  const readback = createPublicReadback({
    clock: () => now,
    wait: async () => {},
    fetchImpl: async (url) => {
      const pathname = new URL(url).pathname;
      if (pathname === "/articles/tag/troubleshooting/") {
        pageReads++;
        return new Response(pageReads === 1 ? "stale" : "approved", { status: 200 });
      }
      return new Response(url.includes("workers.dev") ? "missing" : "approved", {
        status: url.includes("workers.dev") ? 404 : 200,
      });
    },
  });
  const report = await readback.published(
    {
      targets: [
        { path: "/articles/tag/troubleshooting/", bytes: 8, sha256: hashBytes("approved") },
      ],
    },
    image,
  );
  assert.equal(report.status, "verified");
  assert.equal(report.attempts, 2);
  assert.equal(report.observations[0].matches, false);
  assert.equal(report.observations[1].bodyMatch, "exact");
  assert.equal(pageReads, 2);
});
test("readback plans enforce target, aggregate bytes and per-object budgets before execution", () => {
  const row = (path, bytes = 1) => ({ path, bytes, sha256: "a".repeat(64) });
  assert.equal(
    assertPublicTargetPlan(Array.from({ length: 768 }, (_, i) => row("/" + i))).targets,
    768,
  );
  assert.throws(
    () => assertPublicTargetPlan(Array.from({ length: 769 }, (_, i) => row("/" + i))),
    /PUBLIC_TARGET_BUDGET/,
  );
  const limit = Array.from({ length: 32 }, (_, i) => row("/" + i, 2097152));
  assert.equal(assertPublicTargetPlan(limit).bytes, 67108864);
  assert.throws(
    () => assertPublicTargetPlan([...limit, row("/extra")]),
    /PUBLIC_TARGET_BYTES_BUDGET/,
  );
  for (const rows of [
    [row("/same"), row("/same")],
    [row("/../private")],
    [row("/%2e/private")],
    [row("/x", 0)],
    [row("/x", 2097153)],
  ])
    assert.throws(() => assertPublicTargetPlan(rows));
  assert.equal(publicReadbackPolicy.maxReads, 1541);
  assert.equal(publicReadbackPolicy.phaseMs, 120000);
});
test("maximum planned 768 targets use 773 reads; invalid plan dispatches no fetch", async () => {
  let calls = 0;
  const body = "approved";
  const r = createPublicReadback({
    fetchImpl: async (url) => {
      calls++;
      return new Response(url.includes("workers.dev") ? "missing" : body, {
        status: url.includes("workers.dev") ? 404 : 200,
      });
    },
  });
  const targets = Array.from({ length: 768 }, (_, i) => ({
    path: "/test-" + i,
    bytes: 8,
    sha256: hashBytes(body),
  }));
  await assert.rejects(
    () => r.published({ targets: [...targets, { ...targets[0], path: "/extra" }] }, image),
    /PUBLIC_TARGET_BUDGET/,
  );
  assert.equal(calls, 0);
  await r.before(image);
  await r.published({ targets }, image);
  assert.equal(calls, 773);
});
test("lifetime 1541 cap and complete-plan reservation prevent further dispatch", async () => {
  let calls = 0;
  const body = "approved";
  const r = createPublicReadback({
    fetchImpl: async (url) => {
      calls++;
      return new Response(url.includes("workers.dev") ? "missing" : body, {
        status: url.includes("workers.dev") ? 404 : 200,
      });
    },
  });
  for (let i = 0; i < 512; i++) await r.before(image);
  await r.published({ targets: [{ path: "/", bytes: 8, sha256: hashBytes(body) }] }, image);
  assert.equal(calls, 1539);
  await assert.rejects(
    () => r.published({ targets: [{ path: "/", bytes: 8, sha256: hashBytes(body) }] }, image),
    /PUBLIC_READ_BUDGET/,
  );
  assert.equal(calls, 1539);
  await assert.rejects(() => r.before(image), /PUBLIC_READ_BUDGET/);
  assert.equal(calls, 1541);
  await assert.rejects(() => r.before(image), /PUBLIC_READ_BUDGET/);
  assert.equal(calls, 1541);
});
test("actual response bytes stop at the finite 138MiB operation budget", async () => {
  let calls = 0;
  const body = Buffer.alloc(2097152, 97),
    r = createPublicReadback({
      fetchImpl: async (url) => {
        calls++;
        return new Response(body, { status: url.includes("workers.dev") ? 404 : 200 });
      },
    });
  for (let i = 0; i < 23; i++) await r.before(image);
  assert.equal(calls, 69);
  await assert.rejects(() => r.before(image), /PUBLIC_BODY_LIMIT/);
  assert.equal(calls, 70);
});
test("120s phase includes alternate endpoints; stale response aborts without next dispatch", async () => {
  let time = 0,
    calls = 0,
    lastSignal;
  const body = "approved";
  const r = createPublicReadback({
    clock: () => time,
    fetchImpl: async (url, options) => {
      calls++;
      lastSignal = options.signal;
      time += 60000;
      return new Response(url.includes("workers.dev") ? "missing" : body, {
        status: url.includes("workers.dev") ? 404 : 200,
      });
    },
  });
  await assert.rejects(
    () => r.published({ targets: [{ path: "/", bytes: 8, sha256: hashBytes(body) }] }, image),
    /PUBLIC_READBACK_STALE/,
  );
  assert.equal(calls, 2);
  assert.equal(lastSignal.aborted, true);
});
test("Wrangler child environment excludes unrelated credentials", () => {
  const child = cleanToolEnvironment(
    {
      PATH: "safe",
      GITHUB_TOKEN: "synthetic",
      CLOUDFLARE_SITE_MONITOR_READ_TOKEN: "synthetic",
      CLOUDFLARE_API_KEY: "synthetic",
      CLOUDFLARE_EMAIL: "synthetic",
    },
    { CLOUDFLARE_API_TOKEN: "synthetic-write" },
  );
  assert.deepEqual(
    Object.keys(child).sort(),
    ["CI", "CLOUDFLARE_API_TOKEN", "NO_COLOR", "PATH", "WRANGLER_SEND_METRICS"].sort(),
  );
});
test("Wrangler is pinned, uses config only, runs once and does not expose raw output", async () => {
  const root = await mkdtemp(join(tmpdir(), "manual-tool-"));
  try {
    await mkdir(join(root, "node_modules/wrangler"), { recursive: true });
    await writeFile(join(root, "node_modules/wrangler/package.json"), '{"version":"4.151.3"}');
    const calls = [],
      deploy = createWranglerDeploy({
        toolRoot: root,
        env: { CLOUDFLARE_SITE_API_TOKEN: "synthetic-write" },
        context,
        execute: async (command, args, options) => {
          calls.push({ command, args, options });
          return {
            exitCode: 0,
            output: "Current Version ID: " + uid(3) + "\nsynthetic-private-output",
          };
        },
      });
    const r = await deploy({ configPath: join(root, "approved-config.jsonc") });
    assert.equal(r.versionId, uid(3));
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].args.slice(1), [
      "deploy",
      "--config",
      join(root, "approved-config.jsonc"),
    ]);
    await assert.rejects(() => deploy({ configPath: "wrong" }), /DEPLOY_ALREADY_ATTEMPTED/);
    assert.ok(!JSON.stringify(r).includes("synthetic-private-output"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("captured process errors never return stdout/stderr secret text", async () => {
  const spawnImpl = () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => {};
    queueMicrotask(() => child.emit("error", Error("synthetic-private-output")));
    return child;
  };
  await assert.rejects(
    () => executeCaptured("unused", [], { spawnImpl }),
    (error) => error.message === "CAPTURED_TOOL_FAILED",
  );
});
test("canonical staging rejects held ID, broad raster and data image content", async () => {
  const root = await mkdtemp(join(tmpdir(), "manual-stage-"));
  try {
    const dist = join(root, "apps/site/dist");
    await mkdir(dist, { recursive: true });
    await writeFile(
      join(root, "release.json"),
      JSON.stringify({
        sourceSha: selection.sourceSha,
        productionEligible: true,
        event: "push",
        gitRef: "refs/heads/main",
        workflowRunId: selection.runId,
        workflowRunAttempt: 1,
        serverAuthoritySha: authority.serverSha,
        wranglerVersion: authority.wrangler,
        validation: { source: "PASS", final: "PASS" },
      }),
    );
    await writeFile(
      join(root, "apps/site/wrangler.jsonc"),
      JSON.stringify({
        name: authority.worker,
        compatibility_date: "2026-01-01",
        workers_dev: false,
        preview_urls: false,
        assets: { directory: "./dist", not_found_handling: "404-page" },
      }),
    );
    for (const route of [
      "",
      "about",
      "education",
      "notes",
      "projects",
      "search",
      "tools/prime-factorizer",
    ]) {
      await mkdir(join(dist, route), { recursive: true });
      await writeFile(join(dist, route, "index.html"), "<html>approved</html>");
    }
    const held = Array.from({ length: 44 }, (_, n) => uid(n + 1));
    await assert.rejects(() => readPublicTargets(root, selection, held), /HOME_WORKSHOP_PHOTO_SET/);
    await writeFile(join(dist, "index.html"), '<img src="data:image/gif;base64,AA">');
    await assert.rejects(() => readPublicTargets(root, selection, held), /HELD_OR_PRIVATE_MEDIA/);
    await writeFile(join(dist, "index.html"), held[0]);
    await assert.rejects(() => readPublicTargets(root, selection, held), /HELD_OR_PRIVATE_MEDIA/);
    await writeFile(join(dist, "index.html"), "<html>approved</html>");
    await writeFile(join(dist, "private.gif"), "raster");
    await assert.rejects(() => readPublicTargets(root, selection, held), /UNAPPROVED_RASTER/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("single live workflow keeps its source integrity lock, manual boundary and install-before-secrets", async () => {
  const live = await readFile(
    new URL("../../.github/workflows/deploy-site.yml", import.meta.url),
    "utf8",
  );
  assert.ok(live.includes("workflow_dispatch:"));
  assert.ok(!/^\s+(push|pull_request):/m.test(live));
  assert.ok(
    live.indexOf("npm install --prefix") < live.indexOf("secrets.CLOUDFLARE_SITE_API_TOKEN"),
  );
  assertManualWorkflow(live);
  assert.throws(
    () => assertManualWorkflow(live + "\n# unchecked source change\n"),
    /MANUAL_WORKFLOW_BOUNDARY/,
  );
});

function githubFixture(change = () => {}) {
  const calls = [],
    root = [
      ...[
        "apps",
        "packages",
        "schemas",
        "ops",
        "content",
        "config",
        "templates",
        "vendor",
        "tests",
        "docs",
        ".github",
      ].map((path) => ({ path, sha: "c".repeat(40), mode: "040000", type: "tree" })),
      ...[
        "package.json",
        "package-lock.json",
        ".node-version",
        ".gitattributes",
        ".gitignore",
        ".nvmrc",
        "tsconfig.base.json",
        "tsconfig.json",
        "vitest.config.ts",
      ].map((path) => ({ path, sha: "c".repeat(40), mode: "100644", type: "blob" })),
    ];
  root.find((r) => r.path === "ops").sha = "5".repeat(40);
  root.find((r) => r.path === "docs").sha = "6".repeat(40);
  const fetchImpl = async (url, options) => {
    calls.push({ url, method: options.method });
    const u = new URL(url),
      p = u.pathname;
    let body;
    if (p.endsWith("/branches/main")) body = { protected: true, commit: { sha: env.GITHUB_SHA } };
    else if (p.endsWith("/actions/runs/" + env.GITHUB_RUN_ID))
      body = {
        event: "workflow_dispatch",
        head_branch: "main",
        head_sha: env.GITHUB_SHA,
        run_attempt: 1,
        path: ".github/workflows/deploy-site.yml",
        actor: { login: "Xpotato1024" },
        triggering_actor: { login: "Xpotato1024" },
      };
    else if (p.endsWith("/check-runs"))
      body = {
        total_count: 2,
        check_runs: ["result", "offline-policy"].map((name) => ({
          name,
          app: { id: 15368 },
          status: "completed",
          conclusion: "success",
        })),
      };
    else if (p.endsWith("/environments/site-production"))
      body = {
        id: 17,
        name: "site-production",
        can_admins_bypass: false,
        protection_rules: [
          {
            type: "required_reviewers",
            prevent_self_review: false,
            reviewers: [{ reviewer: { login: "Xpotato1024" } }],
          },
        ],
        deployment_branch_policy: { custom_branch_policies: true },
      };
    else if (p.endsWith("/deployment-branch-policies"))
      body = { total_count: 1, branch_policies: [{ name: "main", type: "branch" }] };
    else if (p.endsWith("/approvals"))
      body = [
        {
          state: "approved",
          user: { login: "Xpotato1024" },
          environments: [{ id: 17, name: "site-production" }],
        },
      ];
    else if (p.includes("/compare/"))
      body = { status: "ahead", merge_base_commit: { sha: selection.sourceSha } };
    else if (p.includes("/git/commits/"))
      body = { tree: { sha: p.endsWith(selection.sourceSha) ? "1".repeat(40) : "2".repeat(40) } };
    else if (p.includes("/git/trees/")) {
      if (
        u.searchParams.has("recursive") &&
        (p.endsWith("3".repeat(40)) || p.endsWith("4".repeat(40)))
      )
        body = packageFixture()[p.endsWith("3".repeat(40)) ? 0 : 1];
      else if (u.searchParams.has("recursive") && p.endsWith("5".repeat(40)))
        body = {
          truncated: false,
          tree: operationManualControlPaths.map((path) => ({
            path,
            sha: "c".repeat(40),
            mode: "100644",
            type: "blob",
          })),
        };
      else if (u.searchParams.has("recursive"))
        body = {
          truncated: false,
          tree: [
            {
              path: "operations/current-deployment-status.md",
              sha: "c".repeat(40),
              mode: "100644",
              type: "blob",
            },
          ],
        };
      else {
        body = { truncated: false, tree: structuredClone(root) };
        body.tree.find((r) => r.path === "packages").sha = p.endsWith("1".repeat(40))
          ? "3".repeat(40)
          : "4".repeat(40);
      }
    } else if (p.includes("/contents/"))
      body = {
        sha: "c".repeat(40),
        path: "content/registry/publication-holds.json",
        encoding: "base64",
        content: Buffer.from('{"schemaVersion":1}').toString("base64"),
      };
    else throw Error("unexpected");
    const status = change(p, body, u) || 200;
    return json(body, status);
  };
  return {
    calls,
    github: createManualGitHub({
      env,
      selection,
      credentialProvider: async () => "githubcredential00",
      fetchImpl,
    }),
  };
}
test("GitHub runtime verifies owner approval, ancestor and unchanged build inputs via read only", async () => {
  const f = githubFixture(),
    r = await f.github.verify();
  assert.equal(r.ownerEnvironmentApproved, true);
  assert.equal(r.mainProtectionDetail, "SERVER_ENFORCED_NOT_ADMIN_API_READ");
  assert.ok(f.calls.every((c) => c.method === "GET"));
  assert.deepEqual(await f.github.sourceJson("content/registry/publication-holds.json"), {
    schemaVersion: 1,
  });
  await assert.rejects(() => f.github.sourceJson("unsafe"), /SOURCE_PATH_NOT_ALLOWED/);
});
for (const [name, change] of [
  [
    "main moved",
    (p, b) => {
      if (p.endsWith("/branches/main")) b.commit.sha = "e".repeat(40);
    },
  ],
  [
    "offline missing",
    (p, b) => {
      if (p.endsWith("/check-runs")) b.check_runs[1].conclusion = "failure";
    },
  ],
  [
    "environment bypass",
    (p, b) => {
      if (p.endsWith("/environments/site-production")) b.can_admins_bypass = true;
    },
  ],
  [
    "approval absent",
    (p, b) => {
      if (p.endsWith("/approvals")) b.splice(0);
    },
  ],
  [
    "not ancestor",
    (p, b) => {
      if (p.includes("/compare/")) b.status = "diverged";
    },
  ],
  [
    "public inputs changed",
    (p, b) => {
      if (p.includes("/git/trees/") && b.tree?.[0]?.path === "apps")
        b.tree[0].sha = Math.random().toString(16);
    },
  ],
  [
    "policy script changed",
    (p, b, u) => {
      if (p.includes("/git/trees/") && u.searchParams.has("recursive"))
        b.tree[0].sha = Math.random().toString(16);
    },
  ],
  [
    "incomplete tree",
    (p, b) => {
      if (p.includes("/git/trees/")) b.truncated = true;
    },
  ],
  ["permission denied", () => 403],
])
  test("GitHub rejects " + name, async () => {
    await assert.rejects(() => githubFixture(change).github.verify());
  });
test("missing not_before is explicitly absent when own token status is active", async () => {
  const f = providerFixture((p, b) => {
    if (p.endsWith("/tokens/verify")) delete b.result.not_before;
  });
  const r = await f.provider.verifyDeployToken();
  assert.equal(r.notBefore, null);
  assert.equal(r.notBeforeEvidence, "ABSENT_ACTIVE_STATUS");
  assert.equal(r.issuedOn, null);
  assert.equal(r.lifetimeBasis, "OWNER_CONFIRMED_UTC_DATE_LOWER_BOUND");
});
test("runtime-derived identities remain fixed and separate during an operation", async () => {
  let count = 0;
  const f = providerFixture((p, b) => {
    if (p.endsWith("/tokens/verify") && ++count === 2) b.result.id = id(9);
  });
  await f.provider.verifyDeployToken();
  await assert.rejects(() => f.provider.verifyDeployToken(), /DEPLOY_TOKEN_CHANGED/);
  const reused = providerFixture((p, b) => {
    if (p.endsWith("/tokens/verify")) b.result.id = id(4);
  });
  await reused.provider.verifyDeployToken();
  await assert.rejects(() => reused.provider.snapshot(), /READONLY_TOKEN_IDENTITY/);
});
test("automatic events, branch/actor/attempt bypasses and extra jobs cannot enter manual path", async () => {
  const actual = await readFile(
    new URL("../../.github/workflows/deploy-site.yml", import.meta.url),
    "utf8",
  );
  for (const change of [
    actual.replace("workflow_dispatch:", "push:"),
    actual.replace("github.ref == 'refs/heads/main'", "true"),
    actual.replace("github.actor == 'Xpotato1024'", "true"),
    actual.replace("github.run_attempt == 1", "true"),
    actual + "\n  other-job:\n    runs-on: ubuntu-latest\n",
    actual + "\n  secret: \u0024{{ secrets.FAKE }}\n",
  ])
    assert.throws(() => assertManualWorkflow(change), /MANUAL_WORKFLOW_BOUNDARY/);
});

for (const [name, change] of [
  [
    "missing expiry",
    (p, b) => {
      if (p.endsWith("/tokens/verify")) delete b.result.expires_on;
    },
  ],
  [
    "nonexpiring token",
    (p, b) => {
      if (p.endsWith("/tokens/verify")) b.result.expires_on = null;
    },
  ],
  [
    "90 day lifetime exceeded",
    (p, b) => {
      if (p.endsWith("/tokens/verify")) b.result.expires_on = "2026-12-30T00:00:01Z";
    },
  ],
  [
    "under seven days remaining",
    (p, b) => {
      if (p.endsWith("/tokens/verify")) b.result.expires_on = "2026-10-19T13:59:59Z";
    },
  ],
  [
    "future not_before",
    (p, b) => {
      if (p.endsWith("/tokens/verify")) b.result.not_before = "2026-10-13T00:00:00Z";
    },
  ],
])
  test("runtime token time check rejects " + name, async () => {
    await assert.rejects(() => providerFixture(change).provider.verifyDeployToken());
  });
test("creation date bound is conservative; an exact owner timestamp can resolve the 90-day boundary", async () => {
  const expires = "2026-12-30T14:00:00Z",
    change = (p, b) => {
      if (p.endsWith("/tokens/verify")) b.result.expires_on = expires;
    };
  await assert.rejects(
    () => providerFixture(change).provider.verifyDeployToken(),
    /DEPLOY_TOKEN_POLICY_OR_ROTATION/,
  );
  const exact = {
    ...context,
    tokenPolicy: { ...context.tokenPolicy, issuedOn: "2026-10-01T14:00:00Z" },
  };
  const r = await providerFixture(change, exact).provider.verifyDeployToken();
  assert.equal(r.lifetimeBasis, "OWNER_EXACT_ISSUED_ON");
  assert.equal(r.expiresOn, expires);
});
test("60 day rotation, future creation and timestamps outside the confirmed UTC day stop before write", async () => {
  for (const tokenPolicy of [
    { ...context.tokenPolicy, createdOnUtcDate: "2026-08-13" },
    { ...context.tokenPolicy, createdOnUtcDate: "2026-10-13" },
    { ...context.tokenPolicy, issuedOn: "2026-10-02T00:00:00Z" },
    { ...context.tokenPolicy, issuedOn: "2026-09-30T23:59:59Z" },
  ])
    await assert.rejects(
      () => providerFixture(() => {}, { ...context, tokenPolicy }).provider.verifyDeployToken(),
      /DEPLOY_TOKEN_POLICY_OR_ROTATION/,
    );
});
test("context rejects invalid UTC date, unknown fields and old self-comparison scope pins", () => {
  for (const patch of [
    { permissionGroupId: id(6) },
    { ownerPolicyReviewed: false },
    { tokenPolicy: { ...context.tokenPolicy, createdOnUtcDate: "2026-02-30" } },
    { tokenPolicy: { ...context.tokenPolicy, issuedOn: "today" } },
    { tokenPolicy: { ...context.tokenPolicy, secretValue: "synthetic" } },
  ])
    assert.throws(() => providerFixture(() => {}, { ...context, ...patch }));
});
test("runtime derived Worker and readonly identity drift is refused", async () => {
  let count = 0;
  const worker = providerFixture((p, b) => {
    if (p.endsWith("/scripts") && ++count === 2) b.result[0].tag = id(8);
  });
  await worker.provider.snapshot();
  await assert.rejects(() => worker.provider.snapshot(), /WORKER_IDENTITY/);
  count = 0;
  const reader = providerFixture((p, b) => {
    if (p.endsWith("/tokens/verify") && ++count === 2) b.result.id = id(8);
  });
  await reader.provider.snapshot();
  await assert.rejects(() => reader.provider.snapshot(), /READONLY_TOKEN_IDENTITY/);
});

for (const [name, change] of [
  [
    "missing zone",
    (p, b) => {
      if (p.endsWith("/domains")) delete b.result[0].zone_id;
    },
  ],
  [
    "inactive domain",
    (p, b) => {
      if (p.endsWith("/domains")) b.result[0].enabled = false;
    },
  ],
  [
    "domain previews",
    (p, b) => {
      if (p.endsWith("/domains")) b.result[0].previews_enabled = true;
    },
  ],
])
  test("domain-derived route target rejects " + name, async () => {
    const f = providerFixture(change);
    await assert.rejects(() => f.provider.snapshot(), /DOMAIN_ZONE_OR_ENDPOINT_DRIFT/);
    assert.ok(!f.calls.some((c) => new URL(c.url).pathname.endsWith("/workers/routes")));
  });
test("domain zone is runtime-derived, route GET is exactly bound and later zone drift is refused", async () => {
  let count = 0;
  const f = providerFixture((p, b) => {
    if (p.endsWith("/domains") && ++count === 2) b.result[0].zone_id = id(8);
  });
  const r = await f.provider.snapshot();
  assert.equal(r.zoneId, id(3));
  assert.deepEqual(
    f.calls
      .filter((c) => new URL(c.url).pathname.endsWith("/workers/routes"))
      .map((c) => new URL(c.url).pathname),
    ["/client/v4/zones/" + id(3) + "/workers/routes"],
  );
  await assert.rejects(() => f.provider.snapshot(), /DOMAIN_ZONE_OR_ENDPOINT_DRIFT/);
});

function packageFixture() {
  return [0, 1].map(() => ({
    truncated: false,
    tree: [
      ...currentGuardPaths.map((path) => ({
        path,
        sha: "a".repeat(40),
        mode: "100644",
        type: "blob",
      })),
      {
        path: "content-contracts/src/existing.ts",
        sha: "c".repeat(40),
        mode: "100644",
        type: "blob",
      },
    ],
  }));
}
test("package parity requires current code and rejects any changed or missing guard", () => {
  assert.equal(assertPackageSourceParity(packageFixture()).layout, "current");
  for (const path of currentGuardPaths) {
    const trees = packageFixture();
    trees[1].tree.find((r) => r.path === path).sha = "b".repeat(40);
    assert.throws(() => assertPackageSourceParity(trees), /UNREVIEWED_REPOSITORY_GUARD_CHANGE/);
  }
});
test("optional expiry omitted reproduces the stop with a specific nonsecret reason", async () => {
  const f = providerFixture((p, b) => {
    if (p.endsWith("/tokens/verify")) delete b.result.expires_on;
  });
  const r = await f.provider.diagnoseDeployToken();
  assert.equal(r.code, "DEPLOY_TOKEN_EXPIRY_MISSING");
  assert.equal(r.diagnostics.fields.expires_on.present, false);
  assert.equal(r.deployAllowed, false);
  assert.equal(r.deployCount, 0);
  assert.equal(r.providerWrites, 0);
  assert.equal(f.calls.length, 1);
  assert.ok(new URL(f.calls[0].url).pathname.endsWith("/tokens/verify"));
  assert.equal(f.calls[0].method, "GET");
});
test("optional not_before omitted passes only the token check; missing both still blocks expiry", async () => {
  const absent = providerFixture((p, b) => {
    if (p.endsWith("/tokens/verify")) delete b.result.not_before;
  });
  const pass = await absent.provider.diagnoseDeployToken();
  assert.equal(pass.status, "TOKEN_VERIFY_CHECK_PASSED");
  assert.equal(pass.diagnostics.fields.not_before.state, "absent");
  assert.equal(pass.deployAllowed, false);
  const both = providerFixture((p, b) => {
    if (p.endsWith("/tokens/verify")) {
      delete b.result.not_before;
      delete b.result.expires_on;
    }
  });
  assert.equal((await both.provider.diagnoseDeployToken()).code, "DEPLOY_TOKEN_EXPIRY_MISSING");
});
for (const [name, change, expected] of [
  [
    "ID missing",
    (v) => {
      delete v.id;
    },
    "DEPLOY_TOKEN_ID_MISSING",
  ],
  [
    "ID malformed",
    (v) => {
      v.id = "synthetic-private-value";
    },
    "DEPLOY_TOKEN_ID_FORMAT",
  ],
  [
    "inactive",
    (v) => {
      v.status = "disabled";
    },
    "DEPLOY_TOKEN_NOT_ACTIVE",
  ],
  [
    "status unknown",
    (v) => {
      v.status = "synthetic-private-value";
    },
    "DEPLOY_TOKEN_NOT_ACTIVE",
  ],
  [
    "expiry null",
    (v) => {
      v.expires_on = null;
    },
    "DEPLOY_TOKEN_EXPIRY_FORMAT",
  ],
  [
    "expiry invalid",
    (v) => {
      v.expires_on = "synthetic-private-value";
    },
    "DEPLOY_TOKEN_EXPIRY_FORMAT",
  ],
  [
    "not_before null",
    (v) => {
      v.not_before = null;
    },
    "DEPLOY_TOKEN_NOT_BEFORE_FORMAT",
  ],
  [
    "not_before invalid",
    (v) => {
      v.not_before = "synthetic-private-value";
    },
    "DEPLOY_TOKEN_NOT_BEFORE_FORMAT",
  ],
  [
    "not_before future",
    (v) => {
      v.not_before = "2026-10-13T00:00:00Z";
    },
    "DEPLOY_TOKEN_NOT_BEFORE_FUTURE",
  ],
])
  test("diagnosis identifies " + name + " without response values", async () => {
    const f = providerFixture((p, b) => {
      if (p.endsWith("/tokens/verify")) {
        change(b.result);
        b.result.privateBody = "synthetic-private-value";
      }
    });
    const r = await f.provider.diagnoseDeployToken();
    assert.equal(r.code, expected);
    assert.ok(!JSON.stringify(r).includes("synthetic-private-value"));
    assert.ok(!JSON.stringify(r).includes(id(4)));
    assert.ok(!JSON.stringify(r).includes(id(5)));
    assert.equal(f.calls.length, 1);
    assert.equal(r.deployCount, 0);
  });
test("policy safety still rejects unlimited, overlong, rotation due and short remaining lifetime", async () => {
  for (const value of [undefined, null, "2030-01-01T00:00:00Z", "2026-10-19T00:00:00Z"]) {
    const f = providerFixture((p, b) => {
      if (p.endsWith("/tokens/verify")) b.result.expires_on = value;
    });
    const r = await f.provider.diagnoseDeployToken();
    assert.ok(r.code);
    assert.equal(r.deployCount, 0);
  }
  const due = providerFixture(() => {}, {
    ...context,
    tokenPolicy: { ...context.tokenPolicy, createdOnUtcDate: "2026-08-13" },
  });
  const r = await due.provider.diagnoseDeployToken();
  assert.equal(r.diagnostics.policy.state, "blocked");
});
test("diagnosis transport failure stays sanitized and makes one read with no retry", async () => {
  const f = providerFixture(() => 403),
    r = await f.provider.diagnoseDeployToken();
  assert.equal(r.code, "REMOTE_HTTP_403");
  assert.equal(f.calls.length, 1);
  assert.equal(r.providerWrites, 0);
});
test("deployment stop persists only safe token field diagnostics before every write", async () => {
  const p = providerFixture((path, b) => {
    if (path.endsWith("/tokens/verify")) delete b.result.expires_on;
  });
  const f = fixture({ provider: p.provider }),
    r = await runManualDeployment(f.input);
  assert.equal(r.deployCount, 0);
  assert.equal(r.code, "DEPLOY_TOKEN_EXPIRY_MISSING");
  assert.equal(r.diagnostics.fields.expires_on.present, false);
  assert.ok(!f.calls.includes("deploy"));
  assert.ok(!JSON.stringify(r).includes(id(4)));
  assert.ok(!JSON.stringify(r).includes(id(5)));
});
test("diagnostic mode cannot fall through into deploy; actual CLI returns before manifest and staging use", async () => {
  const calls = [],
    provider = {
      diagnoseDeployToken: async () => {
        calls.push("verifyGET");
        return { deployCount: 0, providerWrites: 0 };
      },
    };
  await runTokenDiagnosticsOnly({
    env: { ...env, DIAGNOSTIC_ONLY: "true" },
    provider,
    verifyGitHub: async () => calls.push("github"),
    persist: async () => calls.push("persist"),
  });
  assert.deepEqual(calls, ["github", "verifyGET", "persist"]);
  for (const mode of [undefined, "false", "TRUE"])
    await assert.rejects(
      () => runTokenDiagnosticsOnly({ env: { ...env, DIAGNOSTIC_ONLY: mode }, provider }),
      /DIAGNOSTIC_ONLY_MODE_REQUIRED/,
    );
  const cli = await readFile(new URL("./manual-deployment-cli.mjs", import.meta.url), "utf8");
  const guard = /if\s*\(\s*env\.DIAGNOSTIC_ONLY\s*===\s*["']true["']\s*\)/u.exec(cli);
  const manifest = /const\s+manifest\s*=/u.exec(cli);
  assert.ok(guard && manifest && guard.index < manifest.index);
  const diagnostics = cli.slice(guard.index, manifest.index);
  assert.match(diagnostics, /await\s+runTokenDiagnosticsOnly\s*\(/u);
  assert.match(diagnostics, /\breturn\s*;/u);
  assert.doesNotMatch(diagnostics, /await\s+(?:stage|deploy|upload)\w*\s*\(/u);
  const actual = await readFile(
    new URL("../../.github/workflows/deploy-site.yml", import.meta.url),
    "utf8",
  );
  assert.throws(() =>
    assertManualWorkflow(actual.replace("        default: false", "        default: true")),
  );
});

test("unreported expiry stays blocked unless the one-time owner acceptance is explicitly true", async () => {
  for (const acceptance of [undefined, false]) {
    const tokenPolicy = {
      ...context.tokenPolicy,
      ...(acceptance === undefined ? {} : { acceptUnreportedExpiry: acceptance }),
    };
    const f = providerFixture(
      (p, b) => {
        if (p.endsWith("/tokens/verify")) delete b.result.expires_on;
      },
      { ...context, tokenPolicy },
    );
    assert.equal((await f.provider.diagnoseDeployToken()).code, "DEPLOY_TOKEN_EXPIRY_MISSING");
  }
  for (const acceptance of [null, "true", 1])
    assert.throws(
      () =>
        providerFixture(() => {}, {
          ...context,
          tokenPolicy: { ...context.tokenPolicy, acceptUnreportedExpiry: acceptance },
        }),
      /OWNER_POLICY_PIN_REQUIRED/,
    );
});
test("explicitly accepted unreported expiry remains UNKNOWN rather than unlimited or verified", async () => {
  const accepted = {
    ...context,
    tokenPolicy: { ...context.tokenPolicy, acceptUnreportedExpiry: true },
  };
  const f = providerFixture((p, b) => {
    if (p.endsWith("/tokens/verify")) {
      delete b.result.expires_on;
      delete b.result.not_before;
    }
  }, accepted);
  const r = await f.provider.diagnoseDeployToken();
  assert.equal(r.code, null);
  assert.equal(r.diagnostics.policy.state, "unverified_expiry_accepted");
  assert.equal(r.diagnostics.policy.expiryEvidence, "UNREPORTED");
  assert.equal(r.diagnostics.policy.lifetimeVerified, false);
  assert.equal(r.diagnostics.policy.rotationEnforced, false);
  assert.equal(r.diagnostics.reasonCode, "TOKEN_ACTIVE_EXPIRY_UNREPORTED");
  assert.equal(r.deployAllowed, false);
  assert.ok(!JSON.stringify(r).includes(id(4)));
  assert.equal(f.calls.length, 1);
  const token = await f.provider.verifyDeployToken();
  assert.equal(token.expiresOn, null);
  assert.equal(token.lifetimeBasis, "NO_PROVIDER_EXPIRY_EVIDENCE");
  assert.equal(token.tokenLifetimePolicyVerified, false);
});
test("acceptance does not admit explicit null, invalid dates, inactive status or future not_before", async () => {
  const accepted = {
    ...context,
    tokenPolicy: { ...context.tokenPolicy, acceptUnreportedExpiry: true },
  };
  for (const change of [
    (v) => {
      v.expires_on = null;
    },
    (v) => {
      v.expires_on = "";
    },
    (v) => {
      v.expires_on = "invalid";
    },
    (v) => {
      v.status = "expired";
    },
    (v) => {
      delete v.expires_on;
      v.not_before = "2026-10-13T00:00:00Z";
    },
    (v) => {
      delete v.expires_on;
      v.not_before = null;
    },
  ]) {
    const f = providerFixture((p, b) => {
      if (p.endsWith("/tokens/verify")) change(b.result);
    }, accepted);
    assert.ok((await f.provider.diagnoseDeployToken()).code);
    await assert.rejects(() => f.provider.verifyDeployToken());
  }
});
test("reported expiry still enforces expiry, 90-day, 60-day and seven-day limits with acceptance set", async () => {
  const accepted = {
    ...context,
    tokenPolicy: { ...context.tokenPolicy, acceptUnreportedExpiry: true },
  };
  for (const expires_on of [
    "2026-10-11T00:00:00Z",
    "2026-10-12T14:00:00Z",
    "2030-01-01T00:00:00Z",
    "2026-10-19T13:59:59Z",
  ]) {
    const r = await providerFixture((p, b) => {
      if (p.endsWith("/tokens/verify")) b.result.expires_on = expires_on;
    }, accepted).provider.diagnoseDeployToken();
    assert.ok(r.code);
  }
  const due = {
    ...accepted,
    tokenPolicy: { ...accepted.tokenPolicy, createdOnUtcDate: "2026-08-13" },
  };
  const r = await providerFixture((p, b) => {
    if (p.endsWith("/tokens/verify")) b.result.expires_on = "2026-10-20T00:00:00Z";
  }, due).provider.diagnoseDeployToken();
  assert.equal(r.diagnostics.policy.reasonCode, "ROTATION_DUE");
  assert.equal(r.diagnostics.policy.rotationEnforced, true);
});
test("60-day rotation is advisory only for explicitly accepted unreported expiry", async () => {
  const accepted = {
    ...context,
    tokenPolicy: {
      ...context.tokenPolicy,
      createdOnUtcDate: "2026-08-13",
      acceptUnreportedExpiry: true,
    },
  };
  const f = providerFixture((p, b) => {
    if (p.endsWith("/tokens/verify")) delete b.result.expires_on;
  }, accepted);
  const r = await f.provider.diagnoseDeployToken();
  assert.equal(r.code, null);
  assert.equal(r.diagnostics.policy.rotationState, "due_by_confirmed_time_bound");
  assert.equal(r.diagnostics.policy.rotationEnforced, false);
});
test("reported to unreported expiry and the reverse stop as operation identity drift", async () => {
  const accepted = {
    ...context,
    tokenPolicy: { ...context.tokenPolicy, acceptUnreportedExpiry: true },
  };
  for (const reverse of [false, true]) {
    let calls = 0;
    const f = providerFixture((p, b) => {
      if (p.endsWith("/tokens/verify") && (++calls === 1) === reverse) delete b.result.expires_on;
    }, accepted);
    await f.provider.verifyDeployToken();
    await assert.rejects(() => f.provider.verifyDeployToken(), /DEPLOY_TOKEN_CHANGED/);
  }
});
test("accepted unreported expiry still performs all pre/post deployment guards and reports uncertainty", async () => {
  const accepted = {
    ...context,
    tokenPolicy: { ...context.tokenPolicy, acceptUnreportedExpiry: true },
  };
  const p = providerFixture((path, b) => {
    if (path.endsWith("/tokens/verify")) delete b.result.expires_on;
  }, accepted);
  const f = fixture();
  f.input.provider.verifyDeployToken = p.provider.verifyDeployToken;
  const r = await runManualDeployment(f.input);
  assert.equal(r.status, "DEPLOYED_READBACK_VERIFIED");
  assert.equal(r.expiryEvidence, "UNREPORTED");
  assert.equal(r.tokenLifetimePolicyVerified, false);
  assert.equal(r.rotationEnforced, false);
  assert.equal(r.credentialLifecycle, "ACTIVE_AT_LAST_VERIFY_WITH_UNREPORTED_EXPIRY");
  assert.ok(f.calls.includes("github"));
  assert.ok(f.calls.includes("persist"));
  assert.ok(f.calls.includes("published"));
  assert.equal(f.calls.filter((x) => x === "deploy").length, 1);
});

const routeBody = (rows = [], info) => ({
  success: true,
  errors: [],
  messages: [],
  result: rows,
  ...(info === undefined ? {} : { result_info: info }),
});
const routeRow = (pattern = "links.xpotato.net/*", script, routeId = "route-1") => ({
  id: routeId,
  pattern,
  ...(script === undefined ? {} : { script }),
});
test("unfiltered SinglePage routes accept absent and consistent optional metadata", async () => {
  for (const info of [
    undefined,
    {},
    { count: 0 },
    { total_count: 0 },
    { page: 1 },
    { page: 1, per_page: 100, count: 0, total_count: 0, total_pages: 1 },
  ])
    assert.equal(assessZoneWorkerRoutes(routeBody([], info)).code, null);
  const f = providerFixture((path, body) => {
    if (path.endsWith("/routes")) delete body.result_info;
  });
  assert.equal((await f.provider.snapshot()).routes, 0);
  assert.ok(
    f.calls
      .filter((call) => new URL(call.url).pathname.endsWith("/routes"))
      .every((call) => call.method === "GET" && new URL(call.url).search === ""),
  );
});
test("route metadata partial, contradictory, malformed and unsupported signals have separate safe reasons", () => {
  const cases = [
    [{ page: 2 }, "ROUTE_PAGE_INFO_INCOMPLETE"],
    [{ total_pages: 2 }, "ROUTE_PAGE_INFO_INCOMPLETE"],
    [{ total_count: 1 }, "ROUTE_PAGE_INFO_INCOMPLETE"],
    [{ count: 1 }, "ROUTE_PAGE_INFO_CONTRADICTORY"],
    [{ count: -1 }, "ROUTE_PAGE_INFO_MALFORMED"],
    [{ count: null }, "ROUTE_PAGE_INFO_MALFORMED"],
    [{ count: "0" }, "ROUTE_PAGE_INFO_MALFORMED"],
    [{ count: false }, "ROUTE_PAGE_INFO_MALFORMED"],
    [{ page: 0 }, "ROUTE_PAGE_INFO_MALFORMED"],
    [{ per_page: 0 }, "ROUTE_PAGE_INFO_MALFORMED"],
    [{ total_pages: 0 }, "ROUTE_PAGE_INFO_MALFORMED"],
    [null, "ROUTE_PAGE_INFO_MALFORMED"],
    [[], "ROUTE_PAGE_INFO_MALFORMED"],
    [{ cursor: "synthetic-private-cursor" }, "ROUTE_PAGE_INFO_UNSUPPORTED_FIELDS"],
  ];
  for (const [info, reason] of cases) {
    const a = assessZoneWorkerRoutes(routeBody([], info));
    assert.equal(a.code, "ROUTE_DRIFT");
    assert.equal(a.diagnostics.reasonCode, reason);
  }
  for (const info of [{ per_page: 1 }, { total_count: 1 }])
    assert.notEqual(
      assessZoneWorkerRoutes(
        routeBody([routeRow(), routeRow("tools.xpotato.net/*", "other-worker", "route-2")], info),
      ).code,
      null,
    );
});
test("missing route result and invalid envelopes cannot prove an empty inventory", () => {
  for (const result of [undefined, null, {}, "private-body", false])
    assert.equal(
      assessZoneWorkerRoutes({ ...routeBody(), result }).diagnostics.reasonCode,
      "ROUTE_RESULT_MISSING_OR_INVALID",
    );
  for (const body of [
    null,
    [],
    { ...routeBody(), success: false },
    { ...routeBody(), errors: null },
    { ...routeBody(), errors: [{ message: "synthetic-private-error" }] },
    { ...routeBody(), messages: {} },
  ])
    assert.equal(assessZoneWorkerRoutes(body).diagnostics.reasonCode, "ROUTE_ENVELOPE_INVALID");
  assert.equal(
    assessZoneWorkerRoutes({ ...routeBody(), next: "synthetic-private-cursor" }).diagnostics
      .reasonCode,
    "ROUTE_ENVELOPE_UNSUPPORTED_FIELDS",
  );
});
test("invalid and duplicate route rows remain blocked", () => {
  for (const row of [
    null,
    [],
    {},
    routeRow("links.xpotato.net/*", null),
    routeRow("links.xpotato.net/*", 42),
    { ...routeRow(), id: "" },
    { ...routeRow(), id: "x".repeat(33) },
    { ...routeRow(), id: 42 },
    { ...routeRow(), pattern: null },
    routeRow("links.xpotato.net/*", "bad\nscript"),
  ])
    assert.equal(
      assessZoneWorkerRoutes(routeBody([row])).diagnostics.reasonCode,
      "ROUTE_ROW_INVALID",
    );
  assert.equal(
    assessZoneWorkerRoutes(routeBody([routeRow(), routeRow("tools.xpotato.net/*")])).diagnostics
      .reasonCode,
    "ROUTE_ID_DUPLICATE",
  );
  assert.equal(
    assessZoneWorkerRoutes(
      routeBody([
        routeRow("links.xpotato.net"),
        routeRow("links.xpotato.net/", "other-worker", "route-2"),
      ]),
    ).diagnostics.reasonCode,
    "ROUTE_PATTERN_DUPLICATE",
  );
  assert.equal(
    assessZoneWorkerRoutes(
      routeBody([
        routeRow("http://links.xpotato.net/"),
        routeRow("https://links.xpotato.net/", "other-worker", "route-2"),
      ]),
    ).code,
    null,
  );
});
test("uninterpretable route patterns cannot silently be treated as unrelated", () => {
  for (const pattern of [
    "",
    " links.xpotato.net/*",
    "ftp://links.xpotato.net/*",
    "links.xpotato.net/*.jpg",
    "links.xpotato.net/?a=*",
    "x*potato.net/*",
    "links.xpotato.net/#part",
    "links.xpotato.net\\private",
    "links.xpotato.net:443/*",
  ])
    assert.equal(
      assessZoneWorkerRoutes(routeBody([routeRow(pattern)])).diagnostics.reasonCode,
      "ROUTE_PATTERN_UNINTERPRETABLE",
    );
});
test("any route targeting the Site Worker remains drift regardless of hostname", () => {
  assert.equal(
    assessZoneWorkerRoutes(routeBody([routeRow("links.xpotato.net/*", authority.worker)]))
      .diagnostics.reasonCode,
    "SITE_WORKER_ROUTE_PRESENT",
  );
});
test("the CMS route exception does not allow different paths, Workers, or bypasses", () => {
  const approved = routeRow("xpotato.net/editor-api/*", "xpotato-editor-api");
  for (const unexpected of [
    routeRow(approved.pattern),
    routeRow(approved.pattern, "other-worker"),
    routeRow("xpotato.net/editor-api*", approved.script),
    routeRow("xpotato.net/editor-api/session", approved.script),
    routeRow("https://xpotato.net/editor-api/*", approved.script),
    routeRow("*xpotato.net/editor-api/*", approved.script),
  ])
    assert.equal(
      assessZoneWorkerRoutes(routeBody([unexpected])).diagnostics.reasonCode,
      "SITE_HOSTNAME_ROUTE_OVERLAP",
    );
  assert.equal(
    assessZoneWorkerRoutes(
      routeBody([approved, routeRow("xpotato.net/editor-api/session", undefined, "route-2")]),
    ).diagnostics.reasonCode,
    "SITE_HOSTNAME_ROUTE_OVERLAP",
  );
});
test("exact and wildcard Site hostname overlap blocks other Workers and bypass routes on every path", () => {
  for (const pattern of [
    "xpotato.net",
    "XPoTaTo.NET",
    "xpotato.net/",
    "xpotato.net/unprobed/*",
    "http://xpotato.net/private",
    "https://xpotato.net/private",
    "*xpotato.net/*",
    "*potato.net",
    "*.net/*",
  ])
    for (const script of ["other-worker", undefined, ""])
      assert.equal(
        assessZoneWorkerRoutes(routeBody([routeRow(pattern, script)])).diagnostics.reasonCode,
        "SITE_HOSTNAME_ROUTE_OVERLAP",
        pattern,
      );
});
test("unrelated Worker and bypass routes preserve SinglePage inventory acceptance", () => {
  for (const pattern of [
    "links.xpotato.net",
    "links.xpotato.net/*",
    "https://links.xpotato.net/path*",
    "*.xpotato.net/*",
  ])
    for (const script of ["other-worker", undefined, ""])
      assert.equal(
        assessZoneWorkerRoutes(routeBody([routeRow(pattern, script)])).code,
        null,
        pattern,
      );
});
test("route diagnostics are frozen enums and shape facts without values or API text", async () => {
  const sentinel = "synthetic-private-sentinel";
  const f = providerFixture((path, body) => {
    if (path.endsWith("/routes")) {
      delete body.result_info;
      body.result = [routeRow("xpotato.net/" + sentinel, sentinel, sentinel)];
    }
  });
  await assert.rejects(
    () => f.provider.snapshot(),
    (error) => {
      assert.ok(error instanceof ManualDeployError);
      assert.equal(error.message, "ROUTE_DRIFT");
      assert.equal(error.diagnostics.reasonCode, "SITE_HOSTNAME_ROUTE_OVERLAP");
      assert.equal(error.diagnostics.stage, "ZONE_WORKER_ROUTES");
      assert.ok(
        Object.isFrozen(error.diagnostics) &&
          Object.isFrozen(error.diagnostics.fields) &&
          Object.isFrozen(error.diagnostics.fields.result) &&
          Object.isFrozen(error.diagnostics.checks),
      );
      assert.ok(!JSON.stringify(error.diagnostics).includes(sentinel));
      return true;
    },
  );
  const a = assessZoneWorkerRoutes({ ...routeBody(), errors: [{ message: sentinel }] });
  assert.ok(!JSON.stringify(a).includes(sentinel));
});
for (const failedSnapshot of [1, 2, 3])
  test(
    "route subreason persists at snapshot " +
      failedSnapshot +
      " with the correct mutation boundary",
    async () => {
      let count = 0;
      const f = providerFixture((path, body) => {
        if (path.endsWith("/routes") && ++count === failedSnapshot) {
          delete body.result_info;
          body.result = [routeRow("xpotato.net/private-path")];
        }
      });
      const operation = fixture({ provider: f.provider }),
        result = await runManualDeployment(operation.input);
      assert.equal(result.code, "ROUTE_DRIFT");
      assert.equal(result.diagnostics.reasonCode, "SITE_HOSTNAME_ROUTE_OVERLAP");
      assert.equal(
        result.status,
        failedSnapshot === 3 ? "STOPPED_OWNER_RECOVERY_REQUIRED" : "STOPPED_BEFORE_DEPLOY",
      );
      assert.equal(result.deployCount, failedSnapshot === 3 ? 1 : 0);
      assert.equal(
        operation.calls.filter((call) => call === "deploy").length,
        failedSnapshot === 3 ? 1 : 0,
      );
      assert.ok(f.calls.every((call) => call.method === "GET"));
    },
  );
test("route response envelope failures are classified before generic provider envelope failure", async () => {
  const f = providerFixture((path, body) => {
    if (path.endsWith("/routes")) body.success = false;
  });
  await assert.rejects(
    () => f.provider.snapshot(),
    (error) =>
      error.message === "ROUTE_DRIFT" && error.diagnostics.reasonCode === "ROUTE_ENVELOPE_INVALID",
  );
});
test("only the reviewed frozen photo and social card table is admitted and all 23 are mandatory", async () => {
  const reviewed = JSON.parse(
    await readFile(
      new URL("../../apps/site/source-inputs/home-workshop/reviewed-recipe.json", import.meta.url),
      "utf8",
    ),
  );
  const delivery = reviewed.registryCandidate.assets[0].delivery;
  const expected = [
    delivery.master,
    ...delivery.variants,
    ...reviewed.mobileDelivery.objects,
    reviewed.socialDelivery.object,
  ].map((r) => ({ path: "/" + r.objectKey, bytes: r.sizeBytes, sha256: r.sha256 }));
  assert.deepEqual(homeWorkshopPublicObjects, expected);
  assert.equal(
    expected.reduce((n, r) => n + r.bytes, 0),
    4344763,
  );
  assert.ok(
    Object.isFrozen(homeWorkshopPublicObjects) && homeWorkshopPublicObjects.every(Object.isFrozen),
  );
  assert.equal(
    assertHomeWorkshopPublicObjects(structuredClone(expected)),
    homeWorkshopPublicObjects,
  );
  for (const rows of [
    expected.slice(1),
    [...expected, expected[0]],
    [expected[0], ...expected.slice(0, 12)],
    [],
    null,
  ])
    assert.throws(() => assertHomeWorkshopPublicObjects(rows), /HOME_WORKSHOP_PHOTO_SET/);
  for (const patch of [
    { bytes: expected[0].bytes + 1 },
    { sha256: "0".repeat(64) },
    { other: true },
  ])
    assert.throws(
      () => assertHomeWorkshopPublicObject({ ...expected[0], ...patch }),
      /UNAPPROVED_RASTER/,
    );
  for (const path of [
    "//" + expected[0].path.slice(1),
    "/../" + expected[0].path.slice(1),
    expected[0].path + "?x=1",
    expected[0].path + "#x",
    expected[0].path.toUpperCase(),
    expected[0].path.replace("/media/", "/%6dedia/"),
    "/private.jpg",
    "/image.bin",
  ])
    assert.throws(
      () => assertHomeWorkshopPublicObject({ ...expected[0], path }),
      /UNAPPROVED_RASTER/,
    );
});
test("social metadata accepts exact artifact bytes and rejects private, external, or aliased references", () => {
  const social = homeWorkshopPublicObjects.at(-1),
    assets = new Map([[social.path, { bytes: social.bytes, sha256: social.sha256 }]]);
  assert.doesNotThrow(() =>
    assertHomeWorkshopImageReferences(
      '<meta property="og:image" content="https://' +
        authority.hostname +
        social.path +
        '"><meta content="' +
        social.path +
        '" name="twitter:image">',
      "/",
      assets,
      authority.hostname,
    ),
  );
  for (const value of [
    "/private.jpg",
    "/.local/home-workshop-build/candidate.json",
    "https://example.test" + social.path,
    social.path + "?x=1",
    "/extra/.." + social.path,
  ]) {
    for (const name of ["og:image", "og:image:secure_url", "twitter:image"])
      assert.throws(
        () =>
          assertHomeWorkshopImageReferences(
            '<meta property="' + name + '" content="' + value + '">',
            "/",
            assets,
            authority.hostname,
          ),
        /UNAPPROVED_IMAGE_REFERENCE/,
      );
  }
});
test("raster magic is recognized even when extensions pretend to be text or other binary", () => {
  for (const hex of [
    "ffd8ffdb",
    "89504e470d0a1a0a",
    "474946383961",
    "424d",
    "49492a00",
    "4d4d002a",
    "49492b00",
    "4d4d002b",
    "ff0a",
    "0000000c4a584c200d0a870a",
  ])
    assert.equal(isRasterBytes(Buffer.from(hex, "hex")), true);
  for (const [prefix, brand] of [
    ["RIFF", "WEBP"],
    ["ftyp", "avif"],
    ["ftyp", "mif1"],
    ["ftyp", "heic"],
  ]) {
    const bytes = Buffer.alloc(12);
    bytes.write(prefix, prefix === "RIFF" ? 0 : 4, "ascii");
    bytes.write(brand, 8, "ascii");
    assert.equal(isRasterBytes(bytes), true);
  }
  for (const value of ["wOF2font", "<svg/>", "body{}", "<html/>", ""])
    assert.equal(isRasterBytes(Buffer.from(value)), false);
});
test("image references remain self-origin and only exact approved raster paths", () => {
  const photo = homeWorkshopPublicObjects[0].path,
    vector = "/xpotato-logo.svg",
    assets = new Map([
      [vector, {}],
      [photo, {}],
    ]);
  assert.doesNotThrow(() =>
    assertHomeWorkshopImageReferences(
      '<img src="' + vector + '"><img src="' + photo + '" srcset="' + photo + ' 640w">',
      "/",
      assets,
      authority.hostname,
    ),
  );
  assert.doesNotThrow(() =>
    assertHomeWorkshopImageReferences(
      "a{background:url(" + photo + ")}",
      "/style.css",
      assets,
      authority.hostname,
    ),
  );
  assert.doesNotThrow(() =>
    assertHomeWorkshopImageReferences(
      "<script>const u=new URL(e,document.baseURI)</script>",
      "/",
      assets,
      authority.hostname,
    ),
  );
  for (const text of [
    '<img src="/private.jpg">',
    '<img src="/image.bin">',
    '<source srcset="' + photo + ' 640w, /private.jpg 960w">',
    '<img src="https://example.test' + photo + '">',
    '<img src="' + photo + '?x=1">',
    '<img src="/extra/..' + photo + '">',
    "<img src=/private.jpg>",
    "<source srcset=/private.jpg>",
    '<div style="background:url(/image.bin)">',
    '<style>a{background:image-set("/private.jpg" 1x)}</style>',
    "a{background:url(/image.bin)}",
    "a{background:url(/private.p\\\\6eg)}",
    'a{background:image-set("/private.jpg" 1x)}',
    "a{background:url(https://example.test/private.jpg)}",
  ])
    assert.throws(
      () =>
        assertHomeWorkshopImageReferences(
          text,
          text.startsWith("a{") ? "/style.css" : "/",
          assets,
          authority.hostname,
        ),
      /UNAPPROVED_IMAGE_REFERENCE/,
    );
});
test("public artifact scan rejects disguised raster and approved-path byte substitution", async () => {
  for (const name of [
    "private.bin",
    "private.jpg.html",
    homeWorkshopPublicObjects[0].path.slice(1),
  ]) {
    const root = await mkdtemp(join(tmpdir(), "manual-photo-negative-"));
    try {
      const dist = join(root, "apps/site/dist");
      await mkdir(dist, { recursive: true });
      await writeFile(
        join(root, "release.json"),
        JSON.stringify({
          sourceSha: selection.sourceSha,
          productionEligible: true,
          event: "push",
          gitRef: "refs/heads/main",
          workflowRunId: selection.runId,
          workflowRunAttempt: 1,
          serverAuthoritySha: authority.serverSha,
          wranglerVersion: authority.wrangler,
          validation: { source: "PASS", final: "PASS" },
        }),
      );
      await writeFile(
        join(root, "apps/site/wrangler.jsonc"),
        JSON.stringify({
          name: authority.worker,
          compatibility_date: "2026-01-01",
          workers_dev: false,
          preview_urls: false,
          assets: { directory: "./dist", not_found_handling: "404-page" },
        }),
      );
      const path = join(dist, name);
      await mkdir(join(path, ".."), { recursive: true });
      await writeFile(path, Buffer.from("ffd8ffdb", "hex"));
      await assert.rejects(
        () =>
          readPublicTargets(
            root,
            selection,
            Array.from({ length: 44 }, (_, n) => uid(n + 1)),
          ),
        /UNAPPROVED_RASTER/,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});
