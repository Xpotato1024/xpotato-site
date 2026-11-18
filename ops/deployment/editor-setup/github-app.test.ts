import { describe, it, expect } from "vitest";
import { request as httpRequest } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { appManifest, registerGitHubApp, validateRegistration } from "./github-app.js";
import type { EditorTarget } from "./config.js";
import { editorGitHubPermissions } from "../../../apps/editor-api/src/github-access.js";

const target = {
  origin: "https://editor.example",
  repository: "owner/site",
  ownerGitHubId: "9",
} as EditorTarget;
const registration = () => ({
  id: 123,
  slug: "owner-editor",
  client_id: "synthetic-client",
  client_secret: "synthetic-private-client-secret",
  webhook_secret: "synthetic-private-hook-secret",
  owner: { id: 9 },
  permissions: { ...editorGitHubPermissions },
  events: ["push"],
});

describe("native GitHub App bootstrap", () => {
  it("uses the narrow App permissions and starts a normal stateful login only after installation", () => {
    const manifest = appManifest(target, "http://127.0.0.1:1234/callback");
    expect(manifest.public).toBe(false);
    expect(manifest.default_permissions).toEqual(editorGitHubPermissions);
    expect(manifest.default_events).toEqual(["push"]);
    expect(manifest.request_oauth_on_install).toBe(false);
    expect(manifest.setup_url).toBe("https://editor.example/editor-api/auth/start");
  });
  it("does not accept an App belonging to someone else or requesting extra permissions", () => {
    expect(() => validateRegistration({ ...registration(), owner: { id: 10 } }, target)).toThrow();
    expect(() =>
      validateRegistration(
        { ...registration(), permissions: { ...editorGitHubPermissions, administration: "write" } },
        target,
      ),
    ).toThrow();
  });
  it("requires the local cookie and state, exchanges once, and never displays the received secrets", async () => {
    let exchangeCount = 0,
      persisted = 0;
    let browserFinished!: () => void;
    const browserDone = new Promise<void>((resolve) => {
      browserFinished = resolve;
    });
    let browserFailure: unknown;
    const done = registerGitHubApp(
      target,
      async (value, sessionSecret) => {
        expect(value.client_secret).toBe("synthetic-private-client-secret");
        expect(sessionSecret.length).toBeGreaterThanOrEqual(32);
        persisted++;
      },
      {
        timeoutMs: 10000,
        fetcher: (async (url: string | URL | Request, options?: RequestInit) => {
          exchangeCount++;
          expect(String(url)).toBe(
            "https://api.github.com/app-manifests/temporary-code/conversions",
          );
          expect(options?.method).toBe("POST");
          return Response.json({ ...registration(), pem: "synthetic-unused-private-key" });
        }) as typeof fetch,
        open: (origin) => {
          void (async () => {
            const page = await fetch(origin);
            const cookie = page.headers.get("set-cookie")!.split(";")[0]!;
            const html = await page.text();
            const state = /new\?state=([a-f0-9]+)/u.exec(html)![1]!;
            expect(html).not.toContain("private-client-secret");
            const wrong = await fetch(origin + "/callback?state=" + state + "&code=temporary-code");
            expect(wrong.status).toBe(403);
            expect(exchangeCount).toBe(0);
            const malformed = await fetch(
              origin +
                "/callback?state=" +
                encodeURIComponent("あ".repeat(64)) +
                "&code=temporary-code",
              { headers: { Cookie: cookie } },
            );
            expect(malformed.status).toBe(403);
            expect(exchangeCount).toBe(0);
            const correct = await fetch(
              origin + "/callback?state=" + state + "&code=temporary-code",
              { headers: { Cookie: cookie } },
            );
            const result = await correct.text();
            expect(correct.status).toBe(200);
            expect(result).toContain("https://github.com/apps/owner-editor/installations/new");
            expect(result).not.toMatch(/synthetic-private|unused-private-key/u);
          })()
            .catch((error) => {
              browserFailure = error;
            })
            .finally(browserFinished);
        },
      },
    );
    expect(await done).toEqual({ id: 123, slug: "owner-editor" });
    await browserDone;
    if (browserFailure) {
      throw browserFailure;
    }
    expect(exchangeCount).toBe(1);
    expect(persisted).toBe(1);
  });

  it("finishes a saved registration when the browser closes during credential storage", async () => {
    let beginPersistence!: () => void;
    let finishPersistence!: () => void;
    const persistenceStarted = new Promise<void>((resolve) => {
      beginPersistence = resolve;
    });
    const persistenceReleased = new Promise<void>((resolve) => {
      finishPersistence = resolve;
    });
    let browserFinished!: () => void;
    const browserDone = new Promise<void>((resolve) => {
      browserFinished = resolve;
    });
    let browserFailure: unknown;
    let persisted = 0;
    const done = registerGitHubApp(
      target,
      async () => {
        persisted++;
        beginPersistence();
        await persistenceReleased;
      },
      {
        timeoutMs: 2000,
        fetcher: (async () => Response.json(registration())) as typeof fetch,
        open: (origin) => {
          void (async () => {
            const page = await fetch(origin);
            const cookie = page.headers.get("set-cookie")!.split(";")[0]!;
            const html = await page.text();
            const state = /new\?state=([a-f0-9]+)/u.exec(html)![1]!;
            const request = httpRequest(
              origin + "/callback?state=" + state + "&code=temporary-code",
              { headers: { Cookie: cookie }, agent: false },
            );
            request.on("error", () => {});
            request.end();
            await persistenceStarted;
            await new Promise<void>((resolve) => {
              request.once("close", resolve);
              request.destroy();
            });
            await delay(20);
            finishPersistence();
          })()
            .catch((error) => {
              browserFailure = error;
              finishPersistence();
            })
            .finally(browserFinished);
        },
      },
    );
    expect(await done).toEqual({ id: 123, slug: "owner-editor" });
    await browserDone;
    if (browserFailure) {
      throw browserFailure;
    }
    expect(persisted).toBe(1);
  });
});
