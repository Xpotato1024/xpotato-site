import { describe, expect, it } from 'vitest';
import { contactEmail, getToolIssueLink, siteIssueUrl } from './contact.js';
import { siteConfig } from './site-config.js';

describe('public contact destinations', () => {
  it('keeps site and calculation reports on their respective public repositories', () => {
    expect(siteIssueUrl).toBe('https://github.com/Xpotato1024/xpotato-site/issues');
    expect(getToolIssueLink('prime-factorizer')?.href).toBe('https://github.com/Xpotato1024/browser-prime-toolkit/issues');
    expect(getToolIssueLink('unknown-tool')).toBeUndefined();
    expect(getToolIssueLink(undefined)).toBeUndefined();
    expect(contactEmail).toBe('321miyuto@xpotato.net');
  });
  it('publishes only the supplied profiles, without tracking queries or a fabricated LinkedIn account', () => {
    expect(siteConfig.socialLinks.map(({ id, href }) => ({ id, href }))).toEqual([
      { id: 'instagram', href: 'https://www.instagram.com/miyu_to_x/' },
      { id: 'x', href: 'https://twitter.com/bael_fps' },
      { id: 'github', href: 'https://github.com/Xpotato1024' },
    ]);
    for (const link of siteConfig.socialLinks) {
      expect(new URL(link.href).search).toBe('');
      expect(link.rel).toContain('noreferrer');
    }
  });
});
