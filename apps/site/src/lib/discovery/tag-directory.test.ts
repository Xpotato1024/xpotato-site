import { describe, expect, it } from 'vitest';
import type { ContentDiscoveryRecord, TaxonomyRegistry } from '@xpotato/content-contracts';
import { taxonomyRegistry } from '../../content-registry/taxonomy/index.js';
import { generateArchivePages, paginate } from './discovery.js';
import { buildTagDirectory, filterTags, previewTags, tagDirectoryRoute, TAG_PAGE_SIZE, type DirectoryTag } from './tag-directory.js';

const tags = (count: number): DirectoryTag[] => Array.from({ length: count }, (_, i) => ({
  id: `tag-${i}`, label: `タグ${i}`, aliases: [], route: `/articles/tag/tag-${i}/`, count: i + 1,
}));

describe('tag discovery', () => {
  it('has an empty state and leaves small directories intact', () => {
    expect(buildTagDirectory([], taxonomyRegistry)).toEqual([]);
    expect(filterTags([], 'タグ')).toEqual([]);
    expect(previewTags([], '/articles/')).toEqual([]);
    expect(previewTags(tags(3), '/articles/')).toHaveLength(3);
  });

  it('bounds previews, prioritizes counts, and retains the current tag outside the top six', () => {
    const many = tags(121);
    expect(previewTags(many, '/articles/').map(tag => tag.id)).not.toContain(many[0]!.id);
    const preview = previewTags(many, many[0]!.route);
    expect(preview).toHaveLength(6);
    expect(preview[0]).toEqual(many[0]);
    expect(preview[1]).toEqual(many[120]);
    expect(new Set(preview.map(tag => tag.id)).size).toBe(6);
    expect(many[0]!.count).toBe(1);
  });

  it.each([0, 6, 7, 24, 25, 121])('preserves the summary and final-page boundary at %i tags', size => {
    const directory = tags(size);
    const preview = previewTags(directory, '/articles/');
    expect(preview).toHaveLength(Math.min(size, 6));
    expect(size - preview.length).toBe(Math.max(0, size - 6));
    const pages = paginate(directory, TAG_PAGE_SIZE);
    expect(pages).toHaveLength(Math.ceil(size / 24));
    expect(pages.flat()).toEqual(directory);
    expect(pages.at(-1)?.length ?? 0).toBe(size ? (size - 1) % 24 + 1 : 0);
  });

  it('keeps every tag reachable once in static pages of at most 24', () => {
    for (const size of [0, 1, 6, 7, 24, 25, 120, 121, 1000]) {
      const directory = tags(size);
      const pages = paginate(directory, TAG_PAGE_SIZE);
      expect(pages.flat()).toEqual(directory);
      expect(pages.every(page => page.length <= 24)).toBe(true);
    }
    expect(tagDirectoryRoute()).toBe('/articles/tags/');
    expect(tagDirectoryRoute(2)).toBe('/articles/tags/page/2/');
  });

  it('matches Japanese, aliases, width/case variants, punctuation and multiple words literally', () => {
    const directory: DirectoryTag[] = [
      { ...tags(1)[0]!, label: 'FDM/FFF 設計', aliases: ['積層造形', '3D printing'] },
      { ...tags(2)[1]!, label: 'C++', aliases: [] },
      { ...tags(3)[2]!, label: 'とても長いタグ'.repeat(40), aliases: [] },
    ];
    for (const query of [' ＦＤＭ ', 'fff 設計', '積層', '3d PRINTING']) expect(filterTags(directory, query)).toEqual([directory[0]]);
    expect(filterTags(directory, 'C++')).toEqual([directory[1]]);
    expect(filterTags(directory, '[.*')).toEqual([]);
    expect(filterTags(directory, 'ないタグ')).toEqual([]);
    expect(filterTags(directory, ' \n ')).toEqual(directory);
    expect(filterTags(directory, '長い')).toEqual([directory[2]]);
  });

  it('uses only generated archives and counts all pages without leaking unused or held terms', () => {
    const taxonomy: TaxonomyRegistry = { ...taxonomyRegistry, tags: [
      ...taxonomyRegistry.tags,
      { id: 'unused', slug: 'unused', label: '未使用', aliases: [], kind: 'topic', status: 'active', archive: true, indexable: true },
    ] };
    const records: ContentDiscoveryRecord[] = Array.from({ length: 30 }, (_, i) => ({
      contentId: `article-${i}`, collection: 'blog', route: `/articles/article-${i}/`, title: 'fixture', description: 'fixture',
      pubDate: '2026-11-01', categoryId: 'software', tagIds: ['fdm'], featured: false, siteSearchEligible: true, webIndexable: i !== 29,
    }));
    const directory = buildTagDirectory(generateArchivePages(records, taxonomy), taxonomy);
    expect(directory).toHaveLength(1);
    expect(directory[0]).toMatchObject({ id: 'fdm', label: 'FDM/FFF', route: '/articles/tag/fdm/', count: 29 });
    expect(filterTags(directory, 'FFF')).toHaveLength(1);
    expect(buildTagDirectory(generateArchivePages(records.map(record => ({...record,webIndexable:false})),taxonomy),taxonomy)).toEqual([]);
    for(const change of [{archive:false}, {status:'retired' as const}]) {
      const inactive: TaxonomyRegistry = {...taxonomy,tags:taxonomy.tags.map(term=>term.id==='fdm'?{...term,...change}:term)};
      expect(buildTagDirectory(generateArchivePages(records,inactive),inactive)).toEqual([]);
    }
  });
});
