import { describe, expect, it } from 'vitest';
import type { BlogFrontmatter, ProjectFrontmatter } from '@xpotato/content-contracts';
import { deriveContentCatalog, type CatalogSourceRecord } from '../discovery/catalog.js';
import { taxonomyRegistry } from '../../content-registry/taxonomy/index.js';
import { selectHomeContent } from './home-content.js';
import { isNewUpdate, updateActivity } from './update-activity.js';

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
  it('passes authored instants through schema, public catalog and the shared home NEW policy', () => {
    const now = Date.parse('2026-11-12T12:00:00+09:00');
    const result = select(blog(1, { pubDate: '2026-11-10', publishedAt: '2026-11-10T12:00:00+09:00' }),
      project(2, 'project', { pubDate: '2026-11-01', updatedDate: '2026-11-10', updatedAt: '2026-11-10T03:00:00Z' }));
    expect(result.articles[0]?.publishedAt).toBe('2026-11-10T12:00:00+09:00');
    expect(result.projects[0]?.updatedAt).toBe('2026-11-10T03:00:00Z');
    expect(result.events.filter(event => isNewUpdate(event, now)).map(event => event.contentId).sort()).toEqual([id(1), id(2)]);
    expect(result.events.filter(event => isNewUpdate(event, now + 24 * 3600000 + 1))).toEqual([]);
    expect(updateActivity(result.events, now).banner?.occurredAt).toBe('2026-11-10T03:00:00Z');
  });
  it('coalesces same-day explicit revisions without inventing or duplicating history', () => {
    const result = select(blog(1, { pubDate: '2026-11-12', publishedAt: '2026-11-12T01:00:00+09:00', updatedDate: '2026-11-12', updatedAt: '2026-11-12T12:00:00+09:00' }));
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({ action: '更新', occurredAt: '2026-11-12T12:00:00+09:00' });
    expect(select(blog(2)).events[0]?.occurredAt).toBeUndefined();
  });
  it('shows real publication and update dates, newest first, without changing article publication order', () => {
    const result = select(blog(1, { updatedDate: '2026-11-11' }), blog(2, { pubDate: '2026-11-10' }));
    expect(result.events.map(update => [update.date, update.action, update.kind])).toEqual([
      ['2026-11-11', '更新', 'blog'], ['2026-11-10', '公開', 'blog'], ['2026-10-01', '公開', 'blog'],
    ]);
    expect(result.articles.map(item => item.contentId)).toEqual([id(2), id(1)]);
  });
  it('never exposes draft or noindex records through any home section', () => {
    const result = select(blog(1, { draft: true }), blog(2, { seo: { noindex: true } }),
      project(3, 'hidden', { draft: true }), project(4, 'fixture', { seo: { noindex: true } }));
    expect(result).toEqual({ projects: [], articles: [], featuredTools: [], events: [] });
  });
  it('excludes archived projects using status rather than a hard-coded slug', () => {
    const result = select(project(1, 'csv2g', { status: 'archived' }), project(2, 'future-archive', { status: 'archived' }),
      project(3, 'new-active'), project(4, 'pandocker-x'));
    expect(result.projects.map(item => item.title)).toEqual(['pandocker-x', 'new-active']);
    expect(result.events.map(update => update.title)).toContain('csv2g'); // Public history stays honest; only the carousel excludes archived projects.
    expect(result.events.map(update => update.title)).toContain('future-archive');
  });
  it('bounds articles while retaining known update events and resolves same-day ties deterministically', () => {
    const input = [blog(4), blog(2), blog(1), blog(3)];
    const forward = select(...input), reverse = select(...input.reverse());
    expect(forward).toEqual(reverse);
    expect(forward.articles).toHaveLength(3);
    expect(forward.events).toHaveLength(4);
    expect(forward.events[0]?.action).toBe('公開');
  });
});
