/** Candidate server core only. No deploy entry, provider binding, recipient or persistence is configured. */
export interface ContactMessage {
  readonly name: string;
  readonly email: string;
  readonly subject: string;
  readonly message: string;
}

export interface ContactIntake {
  /** All three values must refer to reviewed, implemented handling before an adapter is activated. */
  readonly handling: { readonly recipientVerified: boolean; readonly privacyNoticePublished: boolean; readonly retentionImplemented: boolean };
  readonly origin: string;
  /** The deployment adapter must derive this key from trusted transport metadata, not request JSON. */
  readonly rateLimit: (clientKey: string, signal: AbortSignal) => Promise<boolean>;
  readonly verify: (token: string, signal: AbortSignal) => Promise<boolean>;
  /** Fixed recipient; plain text only. Never use request fields as To, From, HTML or transport options. */
  readonly deliver: (message: ContactMessage, signal: AbortSignal) => Promise<void>;
  readonly timeoutMs?: number;
}

const maxBodyBytes = 24 * 1024;
const expectedKeys = ['name', 'email', 'subject', 'message', 'turnstileToken', 'website', 'privacyAccepted'];
const responseHeaders = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin' };
const singleLine = (value: unknown, maximum: number, required = true): value is string =>
  typeof value === 'string' && value.length <= maximum && (!required || value.trim().length > 0) && !/[\u0000-\u001f\u007f]/u.test(value);

function parseMessage(value: unknown): { message: ContactMessage; token: string; honeypot: boolean } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (Object.keys(data).length !== expectedKeys.length || Object.keys(data).some(key => !expectedKeys.includes(key))) return null;
  if (!singleLine(data.name, 100, false) || !singleLine(data.email, 254) || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/u.test(data.email)
    || !singleLine(data.subject, 150) || typeof data.message !== 'string' || !data.message.trim() || data.message.length > 5000
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(data.message) || !singleLine(data.turnstileToken, 2048)
    || !singleLine(data.website, 200, false) || data.privacyAccepted !== true) return null;
  return { message: { name: data.name.trim(), email: data.email.trim(), subject: data.subject.trim(), message: data.message.trim() }, token: data.turnstileToken, honeypot: data.website.length > 0 };
}

async function readBody(request: Request, signal: AbortSignal): Promise<unknown> {
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/u.test(length) || Number(length) > maxBodyBytes)) throw Error('size');
  const reader = request.body?.getReader();
  if (!reader) throw Error('body');
  const cancel = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener('abort', cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBodyBytes) throw Error('size');
      chunks.push(value);
    }
    const combined = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(combined));
  } finally {
    signal.removeEventListener('abort', cancel);
    void reader.cancel().catch(() => undefined);
  }
}

/** A timeout bounds the response even if an adapter ignores cancellation. It does not prove delivery failed. */
async function bounded<T>(operation: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(Error('timeout')); }, timeoutMs); }),
    ]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}

export function createContactHandler(config: ContactIntake) {
  const origin = new URL(config.origin);
  if (origin.protocol !== 'https:' || origin.origin !== config.origin) throw Error('CONTACT_ORIGIN_INVALID');
  const timeoutMs = config.timeoutMs ?? 8000;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 15000) throw Error('CONTACT_TIMEOUT_INVALID');
  return async (request: Request, clientKey: string | null): Promise<Response> => {
    const fromSite = request.headers.get('origin') === config.origin;
    const reply = (status: number, code: string, extra: Record<string, string> = {}) => new Response(JSON.stringify({ code }), {
      status, headers: { ...responseHeaders, ...(fromSite ? { 'Access-Control-Allow-Origin': config.origin } : {}), ...extra },
    });
    const url = new URL(request.url);
    if (url.pathname !== '/v1/contact' || url.search) return reply(404, 'not_found');
    if (!fromSite) return reply(403, 'origin_rejected');
    if (request.method === 'OPTIONS') {
      const headers = (request.headers.get('access-control-request-headers') ?? '').toLowerCase().split(',').map(value => value.trim()).filter(Boolean);
      if (request.headers.get('access-control-request-method') !== 'POST' || headers.some(value => value !== 'content-type')) return reply(403, 'preflight_rejected');
      return reply(200, 'preflight', { 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' });
    }
    if (request.method !== 'POST') return reply(405, 'method_rejected', { Allow: 'POST, OPTIONS' });
    if (!config.handling.recipientVerified || !config.handling.privacyNoticePublished || !config.handling.retentionImplemented) return reply(503, 'not_configured');
    if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(request.headers.get('content-type') ?? '')) return reply(415, 'content_type_rejected');
    if (!clientKey || clientKey.length > 256) return reply(503, 'unavailable');
    let deliveryStarted = false;
    try {
      return await bounded(async signal => {
        if (!await config.rateLimit(clientKey, signal)) return reply(429, 'rate_limited');
        signal.throwIfAborted();
        let input: ReturnType<typeof parseMessage>;
        try { input = parseMessage(await readBody(request, signal)); } catch { return reply(400, 'invalid_request'); }
        if (!input || input.honeypot) return reply(400, 'invalid_request');
        signal.throwIfAborted();
        if (!await config.verify(input.token, signal)) return reply(400, 'challenge_rejected');
        signal.throwIfAborted();
        deliveryStarted = true;
        await config.deliver(input.message, signal);
        signal.throwIfAborted();
        // Provider acceptance is not proof that an email reached the recipient's inbox.
        return reply(202, 'accepted');
      }, timeoutMs);
    } catch {
      // No body, address, token, IP or provider exception is logged or echoed. Never retry automatically.
      return reply(503, deliveryStarted ? 'delivery_unknown' : 'unavailable');
    }
  };
}

export async function verifyTurnstile(token: string, options: { secret: string; hostname: string; action: string; signal: AbortSignal }, fetcher: typeof fetch = fetch): Promise<boolean> {
  if (!options.secret || !options.hostname || !options.action || !singleLine(token, 2048)) return false;
  const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', body: new URLSearchParams({ secret: options.secret, response: token }), signal: options.signal, redirect: 'error',
  });
  if (!response.ok) return false;
  const result: unknown = await response.json();
  if (!result || typeof result !== 'object' || Array.isArray(result)) return false;
  const data = result as Record<string, unknown>;
  return data.success === true && data.hostname === options.hostname && data.action === options.action;
}
