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
export async function session(request: Request, env: Environment, write = false): Promise<Session> {
  if (!configured(env)) throw new APIError("AUTH_NOT_CONFIGURED", 503);
  const value = cookies(request).get(cookieName);
  if (!value) throw new APIError("AUTH_REQUIRED", 401);
  const result = await unseal<Session>(value, env.SESSION_SECRET);
  if (
    result.userId !== env.OWNER_GITHUB_ID ||
    !result.token ||
    result.expires < Date.now() ||
    result.issued > Date.now() + 60000
  )
    throw new APIError("AUTH_EXPIRED", 401);
  if (write) {
    assertOrigin(request, env);
    if (request.headers.get("X-CSRF-Token") !== result.csrf)
      throw new APIError("CSRF_REJECTED", 403);
  }
  return result;
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
  const exchange = await fetcher("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      code_verifier: saved.verifier,
      redirect_uri: env.EDITOR_ORIGIN + "/editor-api/auth/callback",
    }),
    redirect: "error",
  });
  if (!exchange.ok) throw new APIError("OAUTH_EXCHANGE_FAILED", 401);
  const data = (await exchange.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new APIError("OAUTH_EXCHANGE_FAILED", 401);
  const profile = await fetcher("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "Xpotato-Editor",
      Authorization: "Bearer " + data.access_token,
    },
    redirect: "error",
  });
  if (!profile.ok) throw new APIError("OWNER_VERIFICATION_FAILED", 403);
  const user = (await profile.json()) as { id: number; login: string };
  if (String(user.id) !== env.OWNER_GITHUB_ID) throw new APIError("OWNER_ONLY", 403);
  const maxAge = Math.min(3600, data.expires_in ?? 3600),
    value: Session = {
      userId: String(user.id),
      login: user.login,
      token: data.access_token,
      csrf: nonce(),
      issued: Date.now(),
      expires: Date.now() + maxAge * 1000,
    };
  const headers = new Headers({
    Location: env.EDITOR_ORIGIN + "/editor/",
    "Cache-Control": "no-store",
  });
  headers.append(
    "Set-Cookie",
    makeCookie(cookieName, await seal(value, env.SESSION_SECRET), maxAge),
  );
  headers.append("Set-Cookie", makeCookie(stateCookie, "", 0));
  return new Response(null, { status: 303, headers });
}
export function logout() {
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": makeCookie(cookieName, "", 0), "Cache-Control": "no-store" },
  });
}
