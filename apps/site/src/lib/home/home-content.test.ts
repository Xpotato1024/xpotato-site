import { describe, expect, it } from 'vitest';
import type { BlogFrontmatter, ProjectFrontmatter } from '@xpotato/content-contracts';
import { deriveContentCatalog, type CatalogSourceRecord } from '../discovery/catalog.js';
import { taxonomyRegistry } from '../../content-registry/taxonomy/index.js';
import { selectHomeContent } from './home-content.js';

const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const blog = (n: number, overrides: Partial<BlogFrontmatter> = {}): CatalogSourceRecord => ({
  collection: 'blog', slug: `article-${n}`, data: {
    id: id(n), title: `Article ${n}`, description: 'Published article', pubDate: '2026-10-01',
    category: 'software', tags: [], draft: false, ...overrides,
  },
});
const project = (n: number, slug: string, overrides: Partial<ProjectFrontmatter> = {}): CatalogSourceRecord => ({
  collection: 'projects', slug, data: {
    id: id(n), title: slug, description: 'Project', pubDate: '2026-01-01', status: 'active',
    tags: [], draft: false, ...overrides,
  },
});
const select = (...records: CatalogSourceRecord[]) => selectHomeContent(deriveContentCatalog(records, taxonomyRegistry));

describe('home content selection', () => {
  it('shows real publication and update dates, newest first, without changing article publication order', () => {
    const result = select(blog(1, { updatedDate: '2026-11-11' }), blog(2, { pubDate: '2026-11-10' }));
    expect(result.updates.map(update => [update.date, update.action, update.label])).toEqual([
      ['2026-11-11', '更新', '記事'], ['2026-11-10', '公開', '記事'],
    ]);
    expect(result.articles.map(item => item.contentId)).toEqual([id(2), id(1)]);
  });
  it('never exposes draft or noindex records through any home section', () => {
    const result = select(blog(1, { draft: true }), blog(2, { seo: { noindex: true } }),
      project(3, 'hidden', { draft: true }), project(4, 'fixture', { seo: { noindex: true } }));
    expect(result).toEqual({ projects: [], articles: [], featuredTools: [], updates: [] });
  });
  it('excludes archived projects using status rather than a hard-coded slug', () => {
    const result = select(project(1, 'csv2g', { status: 'archived' }), project(2, 'future-archive', { status: 'archived' }),
      project(3, 'new-active'), project(4, 'pandocker-x'));
    expect(result.projects.map(item => item.title)).toEqual(['pandocker-x', 'new-active']);
    expect(result.updates.map(update => update.item.title)).not.toContain('csv2g');
    expect(result.updates.map(update => update.item.title)).not.toContain('future-archive');
  });
  it('bounds both lists and resolves same-day ties deterministically', () => {
    const input = [blog(4), blog(2), blog(1), blog(3)];
    const forward = select(...input), reverse = select(...input.reverse());
    expect(forward).toEqual(reverse);
    expect(forward.articles).toHaveLength(3);
    expect(forward.updates).toHaveLength(3);
    expect(forward.updates[0]?.action).toBe('公開');
  });
});
