import type { TaxonomyRegistry } from '@xpotato/content-contracts';
import type { GeneratedArchivePage } from './discovery.js';

export interface DirectoryTag {
  id: string;
  label: string;
  aliases: readonly string[];
  route: string;
  count: number;
}

export const TAG_PAGE_SIZE = 24;
export const TAG_PREVIEW_SIZE = 6;
export const tagDirectoryRoute = (page = 1): string => page === 1 ? '/articles/tags/' : `/articles/tags/page/${page}/`;

/** Only generated public tag archives belong in discovery, never unused registry terms. */
export const buildTagDirectory = (pages: readonly GeneratedArchivePage[], taxonomy: TaxonomyRegistry): DirectoryTag[] => {
  const tags: DirectoryTag[] = [];
  for (const term of taxonomy.tags.filter(term => term.status === 'active' && term.archive)) {
    const archives = pages.filter(page => page.collection === 'blog' && page.scope.kind === 'tag' && page.scope.id === term.id);
    const first = archives.find(page => page.page === 1);
    if (!first) continue;
    tags.push({ id: term.id, label: term.label, aliases: term.aliases, route: first.route,
      count: new Set(archives.flatMap(page => page.itemContentIds)).size });
  }
  return tags.sort((a, b) => a.label.localeCompare(b.label, 'ja', { numeric: true }) || a.id.localeCompare(b.id));
};

export const previewTags = (tags: readonly DirectoryTag[], currentRoute: string): DirectoryTag[] => {
  const popular = [...tags].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ja') || a.id.localeCompare(b.id));
  const current = tags.find(tag => tag.route === currentRoute);
  return (current ? [current, ...popular.filter(tag => tag.id !== current.id)] : popular).slice(0, TAG_PREVIEW_SIZE);
};

const normalize = (value: string): string => value.normalize('NFKC').toLocaleLowerCase('ja');
export const filterTags = (tags: readonly DirectoryTag[], query: string): DirectoryTag[] => {
  const words = normalize(query).trim().split(/\s+/u).filter(Boolean);
  return tags.filter(tag => {
    const text = normalize([tag.label, ...tag.aliases].join(' '));
    return words.every(word => text.includes(word));
  });
};
