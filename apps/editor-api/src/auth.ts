import { verifyGitHubInstallation } from "./github-access.js";
import { APIError, type Environment, type Session } from "./types.js";
const cookieName = "__Host-xpotato-editor",
  stateCookie = "__Host-xpotato-editor-oauth";
const encoder = new TextEncoder(),
  decoder = new TextDecoder();
function base64(bytes: Uint8Array) {
  let s = "";
  for (const byte of bytes) s += String.fromCharCode(byte);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}
function unbase64(text: string) {
  return Uint8Array.from(atob(text.replaceAll("-", "+").replaceAll("_", "/")), (s) =>
    s.charCodeAt(0),
  );
}
export const nonce = () => base64(crypto.getRandomValues(new Uint8Array(24)));
async function key(secret: string) {
  if (secret.length < 32) throw new APIError("AUTH_NOT_CONFIGURED", 503);
  return crypto.subtle.importKey(
    "raw",
    await crypto.subtle.digest("SHA-256", encoder.encode(secret)),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function seal(value: unknown, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode("xpotato-editor-v1") },
    await key(secret),
    encoder.encode(JSON.stringify(value)),
  );
  return base64(iv) + "." + base64(new Uint8Array(bytes));
}
export async function unseal<T>(text: string, secret: string): Promise<T> {
  try {
    const [iv, data] = text.split(".");
    if (!iv || !data) throw Error();
    const clear = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: unbase64(iv), additionalData: encoder.encode("xpotato-editor-v1") },
      await key(secret),
      unbase64(data),
    );
    return JSON.parse(decoder.decode(clear)) as T;
  } catch {
    throw new APIError("AUTH_EXPIRED", 401);
  }
}
const cookies = (request: Request) =>
  new Map(
    (request.headers.get("Cookie") ?? "").split(";").map((part) => {
      const index = part.indexOf("=");
      return [part.slice(0, index).trim(), part.slice(index + 1)];
    }),
  );
const makeCookie = (name: string, value: string, maxAge: number) =>
  name + "=" + value + "; Path=/; Max-Age=" + maxAge + "; Secure; HttpOnly; SameSite=Lax";
export function configured(env: Environment): boolean {
  return Boolean(
    /^[1-9][0-9]*$/u.test(env.GITHUB_APP_ID ?? "") &&
    env.EDITOR_REPOSITORY &&
    env.GITHUB_CLIENT_ID &&
    env.GITHUB_CLIENT_SECRET &&
    env.OWNER_GITHUB_ID &&
    env.SESSION_SECRET?.length >= 32 &&
    /^https:\/\//u.test(env.EDITOR_ORIGIN),
  );
}
export function assertOrigin(request: Request, env: Environment) {
  if (request.headers.get("Origin") !== env.EDITOR_ORIGIN)
    throw new APIError("ORIGIN_REJECTED", 403);
}
// GitHub's refresh tokens are single-use. A conditional R2 lease prevents simultaneous
// Worker requests from exchanging the same refresh token twice.
const lifetimeSeconds = 14 * 24 * 60 * 60;
const refreshWindowMs = 5 * 60 * 1000;
const credentialPrefix = "internal/auth-sessions/v1/";
interface Ticket {
  sid: string;
  login: string;
  userId: string;
  csrf: string;
  issued: number;
  expires: number;
}
interface Credentials {
  token: string;
  accessExpires: number;
  refreshToken: string;
  refreshExpires: number;
  expires: number;
  rotation?: { id: string; until: number };
}
const recordKey = (sid: string) => credentialPrefix + sid;
const validSid = (sid: unknown): sid is string =>
  typeof sid === "string" && /^[A-Za-z0-9_-]{32}$/u.test(sid);
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
function verifyTicket(ticket: Ticket, env: Environment, now: number): void {
  if (
    ticket.userId !== env.OWNER_GITHUB_ID ||
    !ticket.csrf ||
    !Number.isFinite(ticket.issued) ||
    !Number.isFinite(ticket.expires) ||
    ticket.issued > now + 60000 ||
    ticket.expires <= now ||
    ticket.expires - ticket.issued > lifetimeSeconds * 1000 + 60000
  )
    throw new APIError("AUTH_EXPIRED", 401);
}
async function refreshCredentials(
  value: Credentials,
  env: Environment,
  fetcher: typeof fetch,
): Promise<Credentials> {
  if (!value.refreshToken || value.refreshExpires <= Date.now())
    throw new APIError("AUTH_EXPIRED", 401);
  const response = await oauthStage("REFRESH_EXCHANGE", () =>
    fetcher("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: value.refreshToken,
      }),
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    }),
  );
  if (!response.ok) throw new APIError("AUTH_REFRESH_FAILED", 401);
  const data = (await oauthStage("REFRESH_RESPONSE", () => response.json())) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    refresh_token_expires_in?: number;
  };
  if (
    !data.access_token ||
    !data.refresh_token ||
    !Number.isFinite(data.expires_in) ||
    (data.expires_in ?? 0) <= 0 ||
    !Number.isFinite(data.refresh_token_expires_in) ||
    (data.refresh_token_expires_in ?? 0) <= 0
  )
    throw new APIError("AUTH_REFRESH_FAILED", 401);
  const now = Date.now();
  return {
    token: data.access_token,
    accessExpires: now + data.expires_in! * 1000,
    refreshToken: data.refresh_token,
    refreshExpires: now + data.refresh_token_expires_in! * 1000,
    expires: value.expires,
  };
}
async function activeToken(sid: string, env: Environment, fetcher: typeof fetch): Promise<string> {
  const keyName = recordKey(sid);
  for (let attempt = 0; attempt < 110; attempt++) {
    const object = await env.DRAFT_MEDIA.get(keyName);
    if (!object) throw new APIError("AUTH_EXPIRED", 401);
    const value = await unseal<Credentials>(await object.text(), env.SESSION_SECRET);
    const now = Date.now();
    if (
      !value.token ||
      !Number.isFinite(value.accessExpires) ||
      !Number.isFinite(value.expires) ||
      value.expires <= now
    )
      throw new APIError("AUTH_EXPIRED", 401);
    if (value.rotation?.until && value.rotation.until > now) {
      await pause(200);
      continue;
    }
    if (value.accessExpires > now + refreshWindowMs) return value.token;
    if (!value.refreshToken || value.refreshExpires <= now) {
      if (value.accessExpires > now) return value.token;
      throw new APIError("AUTH_EXPIRED", 401);
    }
    const leased: Credentials = {
      ...value,
      rotation: { id: nonce(), until: now + 20000 },
    };
    const lock = await env.DRAFT_MEDIA.put(keyName, await seal(leased, env.SESSION_SECRET), {
      onlyIf: { etagMatches: object.etag },
    });
    if (!lock) continue;
    let refreshed: Credentials;
    try {
      refreshed = await refreshCredentials(value, env, fetcher);
    } catch (error) {
      await env.DRAFT_MEDIA.put(keyName, await seal(value, env.SESSION_SECRET), {
        onlyIf: { etagMatches: lock.etag },
      }).catch(() => null);
      throw error;
    }
    const saved = await env.DRAFT_MEDIA.put(keyName, await seal(refreshed, env.SESSION_SECRET), {
      onlyIf: { etagMatches: lock.etag },
    });
    if (!saved) throw new APIError("AUTH_REFRESH_FAILED", 503);
    return refreshed.token;
  }
  throw new APIError("AUTH_REFRESH_BUSY", 503);
}

export async function session(
  request: Request,
  env: Environment,
  write = false,
  fetcher: typeof fetch = fetch,
): Promise<Session> {
  if (!configured(env)) throw new APIError("AUTH_NOT_CONFIGURED", 503);
  const value = cookies(request).get(cookieName);
  if (!value) throw new APIError("AUTH_REQUIRED", 401);
  const result = await unseal<Session & Partial<Ticket>>(value, env.SESSION_SECRET);
  const now = Date.now();
  if (result.sid) {
    verifyTicket(result as Ticket, env, now);
  } else if (
    result.userId !== env.OWNER_GITHUB_ID ||
    !result.token ||
    result.expires <= now ||
    result.issued > now + 60000
  ) {
    throw new APIError("AUTH_EXPIRED", 401);
  }
  if (write) {
    assertOrigin(request, env);
    if (request.headers.get("X-CSRF-Token") !== result.csrf)
      throw new APIError("CSRF_REJECTED", 403);
  }
  // Previously issued one-hour cookies remain valid until their original expiry.
  if (!result.sid) {
    if (!result.token) throw new APIError("AUTH_EXPIRED", 401);
    return result;
  }
  if (!validSid(result.sid)) throw new APIError("AUTH_EXPIRED", 401);
  const token = await activeToken(result.sid, env, fetcher);
  return {
    login: result.login,
    userId: result.userId,
    csrf: result.csrf,
    issued: result.issued,
    expires: result.expires,
    token,
  };
}
export async function login(request: Request, env: Environment): Promise<Response> {
  if (!configured(env)) throw new APIError("AUTH_NOT_CONFIGURED", 503);
  const state = nonce(),
    verifier = nonce() + nonce();
  const challenge = base64(
    new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(verifier))),
  );
  const callback = env.EDITOR_ORIGIN + "/editor-api/auth/callback";
  const url = new URL("https://github.com/login/oauth/authorize");
  url.search = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: callback,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return new Response(null, {
    status: 302,
    headers: {
      Location: url.href,
      "Set-Cookie": makeCookie(
        stateCookie,
        await seal({ state, verifier, expires: Date.now() + 600000 }, env.SESSION_SECRET),
        600,
      ),
      "Cache-Control": "no-store",
    },
  });
}
// OAuth通信の実行段階のみを公開し、providerからの例外本文や秘密情報は返さない。
async function oauthStage<T>(stage: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof APIError) throw error;
    throw new APIError(`OAUTH_${stage}_UNEXPECTED`, 500);
  }
}

export async function callback(
  request: Request,
  env: Environment,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  if (!configured(env)) throw new APIError("AUTH_NOT_CONFIGURED", 503);
  const url = new URL(request.url),
    code = url.searchParams.get("code"),
    state = url.searchParams.get("state"),
    stored = cookies(request).get(stateCookie);
  if (!code || !state || !stored) throw new APIError("OAUTH_STATE_INVALID", 403);
  const saved = await unseal<{ state: string; verifier: string; expires: number }>(
    stored,
    env.SESSION_SECRET,
  );
  if (saved.expires < Date.now() || saved.state !== state)
    throw new APIError("OAUTH_STATE_INVALID", 403);
  const exchange = await oauthStage("TOKEN_EXCHANGE", () =>
    fetcher("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        code_verifier: saved.verifier,
        redirect_uri: env.EDITOR_ORIGIN + "/editor-api/auth/callback",
      }),
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    }),
  );
  if (!exchange.ok) {
    throw new APIError("OAUTH_EXCHANGE_FAILED", 401);
  }
  const data = (await oauthStage("TOKEN_RESPONSE", () => exchange.json())) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    refresh_token_expires_in?: number;
  };
  if (!data.access_token) throw new APIError("OAUTH_EXCHANGE_FAILED", 401);
  const profile = await oauthStage("USER_LOOKUP", () =>
    fetcher("https://api.github.com/user", {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "Xpotato-Editor",
        Authorization: "Bearer " + data.access_token,
      },
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    }),
  );
  if (!profile.ok) {
    throw new APIError("OWNER_VERIFICATION_FAILED", 403);
  }
  const user = (await oauthStage("USER_RESPONSE", () => profile.json())) as {
    id: number;
    login: string;
  };
  if (String(user.id) !== env.OWNER_GITHUB_ID) throw new APIError("OWNER_ONLY", 403);
  await oauthStage("INSTALLATION_CHECK", () =>
    verifyGitHubInstallation(data.access_token!, env, fetcher),
  );
  if (
    data.expires_in !== undefined &&
    (!Number.isFinite(data.expires_in) || data.expires_in <= 0)
  ) {
    throw new APIError("OAUTH_EXCHANGE_FAILED", 401);
  }
  const renewable = Boolean(
    data.refresh_token &&
    Number.isFinite(data.refresh_token_expires_in) &&
    (data.refresh_token_expires_in ?? 0) > 0 &&
    Number.isFinite(data.expires_in) &&
    (data.expires_in ?? 0) > 0,
  );
  const maxAge = renewable ? lifetimeSeconds : Math.min(3600, data.expires_in ?? 3600);
  const now = Date.now();
  const identity: Session = {
    userId: String(user.id),
    login: user.login,
    token: data.access_token,
    csrf: nonce(),
    issued: now,
    expires: now + maxAge * 1000,
  };
  let browserCookie: unknown = identity;
  if (renewable) {
    const sid = nonce();
    const credentials: Credentials = {
      token: data.access_token,
      accessExpires: now + data.expires_in! * 1000,
      refreshToken: data.refresh_token!,
      refreshExpires: now + data.refresh_token_expires_in! * 1000,
      expires: identity.expires,
    };
    const saved = await env.DRAFT_MEDIA.put(
      recordKey(sid),
      await seal(credentials, env.SESSION_SECRET),
      { onlyIf: { etagDoesNotMatch: "*" } },
    );
    if (!saved) throw new APIError("AUTH_SESSION_STORE_FAILED", 503);
    const ticket: Ticket = {
      sid,
      userId: identity.userId,
      login: identity.login,
      csrf: identity.csrf,
      issued: identity.issued,
      expires: identity.expires,
    };
    browserCookie = ticket;
  }
  const headers = new Headers({
    Location: env.EDITOR_ORIGIN + "/editor/",
    "Cache-Control": "no-store",
  });
  headers.append(
    "Set-Cookie",
    makeCookie(
      cookieName,
      await oauthStage("SESSION_COOKIE", () => seal(browserCookie, env.SESSION_SECRET)),
      maxAge,
    ),
  );
  headers.append("Set-Cookie", makeCookie(stateCookie, "", 0));
  return new Response(null, { status: 303, headers });
}
export async function logout(request: Request, env: Environment) {
  const value = cookies(request).get(cookieName);
  if (value) {
    const ticket = await unseal<Partial<Ticket>>(value, env.SESSION_SECRET);
    if (validSid(ticket.sid)) await env.DRAFT_MEDIA.delete(recordKey(ticket.sid));
  }
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": makeCookie(cookieName, "", 0), "Cache-Control": "no-store" },
  });
}
