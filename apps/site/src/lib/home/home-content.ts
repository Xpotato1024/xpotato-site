import type { DerivedCatalogEntry } from '../discovery/catalog.js';
import { selectWebIndexableCatalog } from '../discovery/catalog.js';
import { sortNewestFirst } from '../discovery/discovery.js';

const projectOrder = ['pandocker-x', 'repo-audit', 'xpotato-site', 'meidaisai-mac', 'syu-katsu-management'];
const collectionLabels = { blog: '記事', notes: 'メモ', tools: 'ツール', projects: '制作物' } as const;

/** Home is a view of the public catalog, never a separate manually dated news source. */
export const selectHomeContent = (catalog: readonly DerivedCatalogEntry[]) => {
  const entries = selectWebIndexableCatalog(catalog);
  const activeProjects = entries.filter(entry => entry.source.collection === 'projects' && entry.source.data.status !== 'archived');
  const projectRank = (slug: string) => { const rank = projectOrder.indexOf(slug); return rank < 0 ? projectOrder.length : rank; };
  const projects = [...activeProjects].sort((a, b) => projectRank(a.source.slug) - projectRank(b.source.slug)
    || a.discoveryRecord.contentId.localeCompare(b.discoveryRecord.contentId)).map(entry => entry.discoveryRecord);
  const articles = sortNewestFirst(entries.filter(entry => entry.source.collection === 'blog').map(entry => entry.discoveryRecord)).slice(0, 3);
  const featuredTools = sortNewestFirst(entries.filter(entry => entry.source.collection === 'tools' && entry.discoveryRecord.featured).map(entry => entry.discoveryRecord)).slice(0, 3);
  const updates = entries.flatMap(entry => {
    const { collection } = entry.source;
    const item = entry.discoveryRecord;
    if (collection === 'pages' || !item.pubDate || (entry.source.collection === 'projects' && entry.source.data.status === 'archived')) return [];
    const updated = !!item.updatedDate && item.updatedDate > item.pubDate;
    return [{ item, date: updated ? item.updatedDate! : item.pubDate, label: collectionLabels[collection], action: updated ? '更新' : '公開' }];
  }).sort((a, b) => b.date.localeCompare(a.date) || a.item.contentId.localeCompare(b.item.contentId)).slice(0, 3);
  return { projects, articles, featuredTools, updates };
};
