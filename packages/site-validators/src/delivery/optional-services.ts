import { parse, type DefaultTreeAdapterTypes } from 'parse5';
import type { BuiltHtmlInput, BuiltSecurityAssetInput } from './security-headers.js';

const serviceResource = /(?:challenges\.cloudflare\.com|static\.cloudflareinsights\.com|cloudflareinsights\.com\/cdn-cgi\/rum|google-analytics\.com|googletagmanager\.com|giscus\.app|utteranc\.es|disqus\.com|\/v1\/contact\b)/iu;
const serviceAttributes = new Set(['data-optional-service', 'data-contact-form', 'data-comments', 'data-cf-beacon', 'data-turnstile']);

/** Current public release has no active intake/analytics/comments. This gate must change with reviewed activation, not a dashboard toggle. */
export function validateOptionalServicesAbsent(inputs: readonly BuiltHtmlInput[], assets: readonly BuiltSecurityAssetInput[]): string[] {
  const errors: string[] = [];
  for (const { path, html } of inputs) {
    const visit = (node: DefaultTreeAdapterTypes.Node) => {
      if ('tagName' in node) {
        const attrs = Object.fromEntries(node.attrs.map(attr => [attr.name, attr.value]));
        if (Object.keys(attrs).some(name => serviceAttributes.has(name)) || /(?:^|\s)cf-turnstile(?:\s|$)/u.test(attrs.class ?? '')) errors.push(`${path}: OPTIONAL_SERVICE_NOT_ACTIVATED`);
        const resource = ['script', 'iframe', 'img', 'link', 'form'].includes(node.tagName) ? [attrs.src, attrs.href, attrs.action].filter(Boolean).join(' ') : '';
        const script = node.tagName === 'script' ? node.childNodes.filter(child => 'value' in child).map(child => (child as DefaultTreeAdapterTypes.TextNode).value).join('') : '';
        if (serviceResource.test(resource + script)) errors.push(`${path}: OPTIONAL_SERVICE_RESOURCE_NOT_ACTIVATED`);
        if (node.tagName === 'form' && (attrs.method ?? 'get').toLowerCase() !== 'get') errors.push(`${path}: CONTACT_INTAKE_NOT_ACTIVATED`);
      }
      if ('childNodes' in node) for (const child of node.childNodes) visit(child);
      if ('content' in node && node.tagName === 'template') visit(node.content);
    };
    visit(parse(html));
  }
  for (const asset of assets) if (serviceResource.test(asset.source)) errors.push(`${asset.path}: OPTIONAL_SERVICE_RESOURCE_NOT_ACTIVATED`);
  return errors;
}
