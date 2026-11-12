import type { DerivedCatalogEntry } from '../discovery/catalog.js';
import { selectWebIndexableCatalog } from '../discovery/catalog.js';
import { sortNewestFirst } from '../discovery/discovery.js';

const projectOrder = ['pandocker-x', 'repo-audit', 'xpotato-site', 'meidaisai-mac', 'syu-katsu-management'];
import type { UpdateEvent } from './update-activity.js';

/** Home is a view of the public catalog, never a separate manually dated news source. */
export const selectHomeContent = (catalog: readonly DerivedCatalogEntry[]) => {
  const entries = selectWebIndexableCatalog(catalog);
  const activeProjects = entries.filter(entry => entry.source.collection === 'projects' && entry.source.data.status !== 'archived');
  const projectRank = (slug: string) => { const rank = projectOrder.indexOf(slug); return rank < 0 ? projectOrder.length : rank; };
  const projects = [...activeProjects].sort((a, b) => projectRank(a.source.slug) - projectRank(b.source.slug)
    || a.discoveryRecord.contentId.localeCompare(b.discoveryRecord.contentId)).map(entry => entry.discoveryRecord);
  const articles = sortNewestFirst(entries.filter(entry => entry.source.collection === 'blog').map(entry => entry.discoveryRecord)).slice(0, 3);
  const featuredTools = sortNewestFirst(entries.filter(entry => entry.source.collection === 'tools' && entry.discoveryRecord.featured).map(entry => entry.discoveryRecord)).slice(0, 3);
  const events: UpdateEvent[] = entries.flatMap(entry => {
    const { collection } = entry.source, item = entry.discoveryRecord;
    if (collection === 'pages' || !item.pubDate) return [];
    const common = { contentId: item.contentId, kind: collection, title: item.title, route: item.route };
    const publication: UpdateEvent = { ...common, id: item.contentId + ':published', date: item.pubDate, action: '公開' };
    // Only the recorded publication and latest distinct revision are known. No invented history.
    const revision: UpdateEvent[] = item.updatedDate && item.updatedDate > item.pubDate
      ? [{ ...common, id: item.contentId + ':updated:' + item.updatedDate, date: item.updatedDate, action: '更新' }] : [];
    return [publication, ...revision];
  }).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  return { projects, articles, featuredTools, events };
};
