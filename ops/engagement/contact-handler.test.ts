import { describe, expect, it, vi } from 'vitest';
import { createContactHandler, verifyTurnstile, type ContactIntake } from './contact-handler.js';

const origin = 'https://site.example';
const payload = { name: '読者', email: 'reader@example.invalid', subject: '質問', message: '本文\n続き', turnstileToken: 'test-token', website: '', privacyAccepted: true };
const request = (body: unknown = payload, init: RequestInit = {}) => new Request('https://intake.example/v1/contact', {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body), ...init,
});
function setup(overrides: Partial<ContactIntake> = {}) {
  const rateLimit = vi.fn<ContactIntake['rateLimit']>(async () => true), verify = vi.fn<ContactIntake['verify']>(async () => true), deliver = vi.fn<ContactIntake['deliver']>(async () => undefined);
  const config: ContactIntake = { origin, handling: { recipientVerified: true, privacyNoticePublished: true, retentionImplemented: true }, rateLimit, verify, deliver, ...overrides };
  return { handler: createContactHandler(config), rateLimit, verify, deliver };
}

describe('isolated contact intake candidate (no real provider calls)', () => {
  it('delivers bounded plain text to a fixed adapter only after rate limit and server challenge checks', async () => {
    const s = setup(), result = await s.handler(request(), 'trusted-opaque-key');
    expect(result.status).toBe(202); expect(await result.json()).toEqual({ code: 'accepted' });
    expect(result.headers.get('cache-control')).toBe('no-store');
    expect(result.headers.get('access-control-allow-origin')).toBe(origin);
    expect(result.headers.has('access-control-allow-credentials')).toBe(false);
    expect(s.rateLimit.mock.invocationCallOrder[0]).toBeLessThan(s.verify.mock.invocationCallOrder[0]!);
    expect(s.verify.mock.invocationCallOrder[0]).toBeLessThan(s.deliver.mock.invocationCallOrder[0]!);
    expect(s.deliver.mock.calls[0]?.[0]).toEqual({ name: '読者', email: payload.email, subject: '質問', message: '本文\n続き' });
  });
  it.each(['recipientVerified', 'privacyNoticePublished', 'retentionImplemented'] as const)('stays unavailable without %s', async key => {
    const s = setup({ handling: { recipientVerified: true, privacyNoticePublished: true, retentionImplemented: true, [key]: false } });
    expect((await s.handler(request(), 'key')).status).toBe(503); expect(s.rateLimit).not.toHaveBeenCalled(); expect(s.deliver).not.toHaveBeenCalled();
  });
  it.each([null, 'https://other.example', 'null'])('rejects untrusted origin %s before any provider call', async value => {
    const s = setup(), headers = new Headers({ 'Content-Type': 'application/json' }); if (value) headers.set('Origin', value);
    const response = await s.handler(request(payload, { headers }), 'key');
    expect(response.status).toBe(403); expect(response.headers.has('access-control-allow-origin')).toBe(false); expect(s.rateLimit).not.toHaveBeenCalled();
  });
  it('supports only exact, credential-free preflight and POST path', async () => {
    const s = setup();
    const options = (headers: Record<string, string>) => new Request('https://intake.example/v1/contact', { method: 'OPTIONS', headers: { Origin: origin, ...headers } });
    expect((await s.handler(options({ 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' }), null)).status).toBe(200);
    expect((await s.handler(options({ 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization' }), null)).status).toBe(403);
    expect((await s.handler(new Request('https://intake.example/v1/contact', { headers: { Origin: origin } }), 'key')).status).toBe(405);
    expect((await s.handler(new Request('https://intake.example/v1/contact?email=private', { headers: { Origin: origin } }), 'key')).status).toBe(404);
    expect((await s.handler(new Request('https://intake.example/other', { headers: { Origin: origin } }), 'key')).status).toBe(404);
    expect(s.rateLimit).not.toHaveBeenCalled();
  });
  it.each([
    { email: 'reader@example.invalid\r\nBcc: victim@example.invalid' }, { subject: 'Hello\nBcc: person' }, { name: 'x'.repeat(101) },
    { email: 'not-an-address' }, { message: '' }, { message: 'x'.repeat(5001) }, { message: 'x\u0000' }, { privacyAccepted: false },
    { privacyAccepted: 'true' }, { turnstileToken: '' }, { turnstileToken: 'x'.repeat(2049) }, { website: 'spam.example' }, { to: 'victim@example.invalid' },
  ])('rejects invalid content without verification, delivery or reflection: %j', async changes => {
    const s = setup(), response = await s.handler(request({ ...payload, ...changes }), 'key');
    expect(response.status).toBe(400); expect(await response.json()).toEqual({ code: 'invalid_request' }); expect(s.verify).not.toHaveBeenCalled(); expect(s.deliver).not.toHaveBeenCalled();
  });
  it('rejects unsupported type, absent trusted client identity, oversized declared/streamed body and malformed JSON', async () => {
    const s = setup();
    expect((await s.handler(request(payload, { headers: { Origin: origin, 'Content-Type': 'text/plain' } }), 'key')).status).toBe(415);
    expect((await s.handler(request(), null)).status).toBe(503);
    expect((await s.handler(request(payload, { headers: { Origin: origin, 'Content-Type': 'application/json', 'Content-Length': '25000' } }), 'key')).status).toBe(400);
    expect((await s.handler(request({}, { body: ' '.repeat(25000) }), 'key')).status).toBe(400);
    expect((await s.handler(request({}, { body: '{broken' }), 'key')).status).toBe(400);
    expect(s.verify).not.toHaveBeenCalled(); expect(s.deliver).not.toHaveBeenCalled();
  });
  it('stops before challenge and delivery when rate limited, and before delivery for a rejected challenge', async () => {
    const limited = setup({ rateLimit: async () => false });
    expect((await limited.handler(request(), 'key')).status).toBe(429); expect(limited.verify).not.toHaveBeenCalled();
    const rejected = setup({ verify: async () => false });
    expect((await rejected.handler(request(), 'key')).status).toBe(400); expect(rejected.deliver).not.toHaveBeenCalled();
  });
  it.each(['rateLimit', 'verify'] as const)('fails closed if %s throws', async key => {
    const s = setup({ [key]: async () => { throw Error('provider details and private data'); } });
    const response = await s.handler(request(), 'key');
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ code: 'unavailable' }); expect(s.deliver).not.toHaveBeenCalled();
  });
  it('bounds hanging providers; a late success cannot continue to delivery', async () => {
    let finish: (value: boolean) => void = () => undefined;
    const s = setup({ timeoutMs: 5, verify: () => new Promise<boolean>(resolve => { finish = resolve; }) });
    const response = await s.handler(request(), 'key'); expect(response.status).toBe(503);
    finish(true); await new Promise(resolve => setTimeout(resolve, 10)); expect(s.deliver).not.toHaveBeenCalled();
  });
  it('cancels a stalled body stream at the deadline without verification or delivery', async () => {
    const cancelled = vi.fn();
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode('{')); }, cancel: cancelled });
    const incoming = request({}, { body, duplex: 'half' } as RequestInit);
    const s = setup({ timeoutMs: 5 });
    expect((await s.handler(incoming, 'key')).status).toBe(503);
    expect(cancelled).toHaveBeenCalledTimes(1); expect(s.verify).not.toHaveBeenCalled(); expect(s.deliver).not.toHaveBeenCalled();
  });
  it('aborts the rate-limit adapter and ignores its late successful result', async () => {
    let finish: (value: boolean) => void = () => undefined;
    const rateLimit = vi.fn<ContactIntake['rateLimit']>(() => new Promise(resolve => { finish = resolve; }));
    const s = setup({ timeoutMs: 5, rateLimit });
    expect((await s.handler(request(), 'key')).status).toBe(503);
    expect(rateLimit.mock.calls[0]?.[1].aborted).toBe(true);
    finish(true); await new Promise(resolve => setTimeout(resolve, 10)); expect(s.verify).not.toHaveBeenCalled(); expect(s.deliver).not.toHaveBeenCalled();
  });
  it('passes the abort signal through verification and delivery adapters', async () => {
    const verify = vi.fn<ContactIntake['verify']>(async () => true);
    const deliver = vi.fn<ContactIntake['deliver']>(() => new Promise(() => undefined));
    const s = setup({ timeoutMs: 5, verify, deliver });
    expect((await s.handler(request(), 'key')).status).toBe(503);
    expect(verify.mock.calls[0]?.[1]).toBe(deliver.mock.calls[0]?.[1]);
    expect(deliver.mock.calls[0]?.[1].aborted).toBe(true);
  });
  it('does not retry or assert failure after an uncertain delivery', async () => {
    const deliver = vi.fn(async () => { throw Error('connection lost after sending'); });
    const s = setup({ deliver }); const response = await s.handler(request(), 'key');
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ code: 'delivery_unknown' }); expect(deliver).toHaveBeenCalledTimes(1);
    const hung = setup({ timeoutMs: 5, deliver: () => new Promise(() => undefined) });
    expect(await (await hung.handler(request(), 'key')).json()).toEqual({ code: 'delivery_unknown' });
  });
  it('requires an exact HTTPS origin and a bounded timeout', () => {
    for (const value of ['http://site.example', 'https://site.example/path', 'https://user:pass@site.example', 'https://site.example/']) expect(() => setup({ origin: value })).toThrow('CONTACT_ORIGIN_INVALID');
    for (const timeoutMs of [0, -1, Infinity, NaN, 15001]) expect(() => setup({ timeoutMs })).toThrow('CONTACT_TIMEOUT_INVALID');
  });
});

describe('Turnstile verification adapter', () => {
  const options = () => ({ secret: 'synthetic-test-secret', hostname: 'site.example', action: 'contact', signal: new AbortController().signal });
  it.each([
    [{ success: true, hostname: 'site.example', action: 'contact' }, true],
    [{ success: false, hostname: 'site.example', action: 'contact', 'error-codes': ['timeout-or-duplicate'] }, false],
    [{ success: true, hostname: 'wrong.example', action: 'contact' }, false],
    [{ success: true, hostname: 'site.example', action: 'login' }, false],
    [{ success: true }, false], [null, false],
  ])('requires success and exact hostname/action: %j', async (result, expected) => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(result))) as unknown as typeof fetch;
    expect(await verifyTurnstile('synthetic-token', options(), fetcher)).toBe(expected);
  });
  it('sends only the verification secret/token to the fixed endpoint, with no redirects or retry', async () => {
    const fetcher = vi.fn(async () => new Response('{}', { status: 502 }));
    expect(await verifyTurnstile('synthetic-token', options(), fetcher as unknown as typeof fetch)).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify'); expect(init.redirect).toBe('error');
    expect([...new URLSearchParams(init.body as URLSearchParams).keys()]).toEqual(['secret', 'response']);
  });
});
