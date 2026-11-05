import { describe, expect, it } from 'vitest';
import { siteConfig } from './site-config.js';

describe('public section navigation', () => {
  it('uses Japanese labels in both menus while retaining stable IDs, order and URLs', () => {
    for (const location of ['header', 'footer'] as const) {
      const links = siteConfig.navigation
        .filter(link => link.status === 'active' && link.location.includes(location))
        .sort((left, right) => left.order - right.order);
      expect(links.slice(0, 5).map(({ id, label, href }) => ({ id, label, href }))).toEqual([
        { id: 'blog', label: '記事', href: '/articles/' },
        { id: 'education', label: '教育資料', href: '/education/' },
        { id: 'projects', label: '制作物', href: '/projects/' },
        { id: 'tools', label: 'ツール', href: '/tools/' },
        { id: 'about', label: 'このサイトについて', href: '/about/' },
      ]);
    }
  });
});
