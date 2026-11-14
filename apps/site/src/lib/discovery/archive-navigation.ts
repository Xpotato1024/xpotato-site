import type { TaxonomyRegistry } from '@xpotato/content-contracts';
import type { DirectoryTag } from './tag-directory.js';

/** Keep every public tag reachable, while separating reading purpose from subject matter. */
export function groupArchiveTags(tags: readonly DirectoryTag[], taxonomy: TaxonomyRegistry) {
  const purposeIds = new Set(taxonomy.tags.filter(term => term.kind === 'purpose').map(term => term.id));
  return [
    { label: '技術・関連タグから探す', tags: tags.filter(tag => !purposeIds.has(tag.id)) },
    { label: '記事の目的から探す', tags: tags.filter(tag => purposeIds.has(tag.id)) },
  ].filter(group => group.tags.length > 0);
}
