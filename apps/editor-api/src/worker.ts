import { connectionStatus } from "./connection.js";
import { acceptGitHubActivity } from "./webhook.js";
import {
  GitRepository,
  createGitHubTransport,
  defaultRepository,
  GitError,
} from "@xpotato/editor-core/git";
import { APIError, type Environment, type Execution, type Session } from "./types.js";
import { configured, session, login, callback, logout, assertOrigin } from "./auth.js";
import { DraftStore } from "./state.js";
import { collectDraftMedia, reconcileReservations } from "./media.js";
import { json } from "./http.js";
import { handleGitRoute } from "./routes/git.js";
import { handleDraftRoute } from "./routes/drafts.js";
import { authenticateCLI, type CLIPrincipal } from "./cli-auth.js";
import { handleCLIMediaRoute, isCLIMediaRoute } from "./routes/cli-media.js";

export interface RuntimePorts {
  authenticate?: (request: Request, env: Environment, write: boolean) => Promise<Session>;
  git?: (session: Session, env: Environment) => GitRepository;
  cliAuthenticate?: (request: Request, env: Environment) => Promise<CLIPrincipal>;
  cliGit?: (principal: CLIPrincipal, env: Environment) => GitRepository;
  now?: () => number;
}

export function createHandler(ports: RuntimePorts = {}) {
  return async function handle(request: Request, env: Environment): Promise<Response> {
    try {
      const url = new URL(request.url);
      const route = url.pathname.replace(/^\/editor-api(?=\/|$)/u, "") || "/";
      const write = !["GET", "HEAD", "OPTIONS"].includes(request.method);
      if (route === "/cli" || route.startsWith("/cli/")) {
        if (!isCLIMediaRoute(route, request.method)) {
          return json({ error: "NOT_FOUND" }, 404);
        }
        const principal = await (ports.cliAuthenticate ?? authenticateCLI)(request, env);
        if (!env.DRAFT_MEDIA) {
          throw new APIError("DRAFT_STORAGE_NOT_CONFIGURED", 503);
        }
        const repository =
          ports.cliGit?.(principal, env) ??
          new GitRepository(
            createGitHubTransport(principal.token, principal.repository),
            principal.repository,
          );
        return await handleCLIMediaRoute({
          request,
          url,
          route,
          store: new DraftStore(env.DRAFT_MEDIA, ports.now ?? Date.now),
          repository,
        });
      }
      if (request.method === "OPTIONS") {
        assertOrigin(request, env);
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": env.EDITOR_ORIGIN,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,X-CSRF-Token",
            Vary: "Origin",
          },
        });
      }
      // Webhookはcookieではなく署名で検証する。ブラウザ用CSRF経路へ混ぜない。
      if (route === "/github/activity" && request.method === "POST") {
        return await acceptGitHubActivity(request, env, (ports.now ?? Date.now)());
      }
      if (route === "/auth/start" && request.method === "GET") {
        return await login(request, env);
      }
      if (route === "/auth/callback" && request.method === "GET") {
        return await callback(request, env);
      }
      if (route === "/session" && request.method === "GET") {
        try {
          const current = await (ports.authenticate ?? session)(request, env, false);
          return json({
            authenticated: true,
            configured: true,
            user: current.login,
            csrf: current.csrf,
            expires: current.expires,
            repository: env.EDITOR_REPOSITORY || defaultRepository,
          });
        } catch (error) {
          if (error instanceof APIError && [401, 503].includes(error.status)) {
            return json({
              authenticated: false,
              configured: configured(env),
              repository: env.EDITOR_REPOSITORY || defaultRepository,
            });
          }
          throw error;
        }
      }
      // Browser routes retain their owner cookie and same-origin CSRF boundary.
      const current = await (ports.authenticate ?? session)(request, env, write);
      if (route === "/auth/logout" && request.method === "POST") {
        return await logout(request, env);
      }
      const repository =
        ports.git?.(current, env) ??
        new GitRepository(
          createGitHubTransport(current.token, env.EDITOR_REPOSITORY || defaultRepository),
          env.EDITOR_REPOSITORY || defaultRepository,
        );

      if (route === "/connection" && request.method === "GET") {
        return json(await connectionStatus(env, repository));
      }

      // awaitしないとhandler内の非同期失敗がこの共通エラー応答を通らない。
      const gitResponse = await handleGitRoute({ request, url, route, repository, current });
      if (gitResponse) {
        return gitResponse;
      }
      if (!env.DRAFT_MEDIA) {
        throw new APIError("DRAFT_STORAGE_NOT_CONFIGURED", 503);
      }
      const store = new DraftStore(env.DRAFT_MEDIA, ports.now ?? Date.now);
      const draftResponse = await handleDraftRoute({ request, url, route, store });
      return draftResponse ?? json({ error: "NOT_FOUND" }, 404);
    } catch (error) {
      if (error instanceof APIError || error instanceof GitError) {
        return json({ error: error.code }, error.status);
      }
      // providerの例外本文には秘密値が含まれ得るため、そのまま返さない。
      const message =
        error instanceof Error && /^[A-Z][A-Z0-9_]+$/u.test(error.message)
          ? error.message
          : "REQUEST_FAILED";
      return json({ error: message }, message === "REQUEST_FAILED" ? 500 : 400);
    }
  };
}

export default {
  fetch: createHandler(),
  async scheduled(_controller: unknown, env: Environment, ctx: Execution) {
    // Git更新を観測できない状態で、活動中の下書きを放置と誤判定しない。
    if (env.GC_ENABLED !== "true" || !env.DRAFT_MEDIA || !env.GITHUB_WEBHOOK_SECRET) {
      return;
    }
    ctx.waitUntil(
      (async () => {
        const store = new DraftStore(env.DRAFT_MEDIA);
        await reconcileReservations(store);
        await collectDraftMedia(store, false);
      })(),
    );
  },
};
