import { describe, expect, it } from 'vitest';
import { validateOptionalServicesAbsent } from './optional-services.js';
import { renderSecurityHeaderArtifact } from './security-headers.js';
import { headersForPath, parseStaticHeaderRules } from './static-headers.mjs';

describe('optional service activation boundary', () => {
  it.each(['/tools/prime-factorizer/index.html', '/contact/index.html', '/articles/example/index.html'])('rejects inactive UI and runtime on %s', path => {
    for (const html of ['<div data-comments></div>', '<div data-contact-form></div>', '<div class="cf-turnstile"></div>', '<script data-cf-beacon="{}"></script>', '<form method="post" action="/contact/"></form>', '<template><form method="post"></form></template>', '<script src="https://static.cloudflareinsights.com/beacon.min.js"></script>', '<iframe src="https://giscus.app/test"></iframe>', '<script>fetch("/v1/contact")</script>']) {
      expect(validateOptionalServicesAbsent([{ path, html }], []).length).toBeGreaterThan(0);
    }
  });
  it('allows plain privacy links, source citations, search, and the local calculator without activating a service', () => {
    expect(validateOptionalServicesAbsent([{ path: '/privacy/index.html', html: '<a href="https://challenges.cloudflare.com/">Reference</a><form action="/search/" method="get"></form><a href="mailto:person@example.invalid">Email</a><p>解析、コメントについて</p><script src="/_astro/calculator.js"></script>' }], [{ path: '/_astro/calculator.js', source: 'export const multiply = (a,b) => a*b;' }])).toEqual([]);
  });
  it('inspects emitted JS too, so indirect loads are not hidden behind same-origin script URLs', () => {
    expect(validateOptionalServicesAbsent([], [{ path: '/_astro/optional.js', source: 'const url="https://challenges.cloudflare.com/turnstile/v0/api.js";' }])).toHaveLength(1);
  });
  it('keeps tool documents unable to connect/frame external services while the PWA worker only fetches its own files', () => {
    const route = '/tools/prime-factorizer/';
    const rules = parseStaticHeaderRules(renderSecurityHeaderArtifact({ scriptHashes: [], styleHashes: [], toolRoutes: [route], toolCapabilities: [{ route, worker: true, wasm: true }], primeOffline: true }));
    const doc = headersForPath(route, rules)['content-security-policy'];
    expect(doc).toContain("connect-src 'none'"); expect(doc).toContain("frame-src 'none'"); expect(doc).not.toMatch(/cloudflareinsights|challenges\.cloudflare|giscus/);
    expect(headersForPath(route + 'sw.js', rules)['content-security-policy']).toContain("connect-src 'self'");
  });
});
