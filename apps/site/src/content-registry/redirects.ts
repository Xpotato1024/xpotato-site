import { applicationRedirectRecordSchema } from "@xpotato/content-contracts";
import type {DerivedCatalogEntry} from '../lib/catalog.js';
import {selectWebIndexableCatalog} from '../lib/catalog.js';
import {generateArchivePages} from '../lib/discovery.js';
import {taxonomyRegistry} from './taxonomy/index.js';
import {articleUrlHistory} from '../lib/article-url-history.js';

// Application path redirects only. WordPress query identities are provider requirements.
export const applicationRedirects = [
  { id: "articles-root", sourcePath: "/blog/", targetPath: "/articles/", reason: "site_structure_change" },
  { id: "legacy-prime-factorizer", sourcePath: "/blog/prime-factorizer/", targetPath: "/tools/prime-factorizer/", contentId: "bca48f98-c89a-457f-84d8-168f941fe469", reason: "content_route_change" },
  { id: "legacy-blog-tools", sourcePath: "/blog/category/tools/", targetPath: "/tools/", reason: "legacy_path" },
  // Legacy display categories do not partition the accepted vNext taxonomy.
  // The Blog union archive preserves access without falsely assigning mixed diary entries.
  { id: "legacy-blog-diary", sourcePath: "/blog/category/diary/", targetPath: "/articles/", reason: "site_structure_change" },
  { id: "legacy-blog-infra", sourcePath: "/blog/category/infra/", targetPath: "/articles/", reason: "site_structure_change" },
  { id: "legacy-blog-network", sourcePath: "/blog/category/network/", targetPath: "/articles/", reason: "site_structure_change" },
  { id: "legacy-tool-calculation", sourcePath: "/tools/category/calculation/", targetPath: "/tools/", reason: "site_structure_change" },
].map((record) => applicationRedirectRecordSchema.parse({ ...record, status: 301, statusLifecycle: "active" }));

/** Emit compatibility only when its real public target is built. The frozen
 * 44-entry history remains a ledger while those articles are held. */
export function currentApplicationRedirects(catalog:readonly DerivedCatalogEntry[]){
 const records=[...applicationRedirects];
 for(const h of articleUrlHistory)if(catalog.some(e=>e.routeRecord.contentId===h.contentId&&e.disposition==='published'))records.push(applicationRedirectRecordSchema.parse({id:'article-history-'+h.contentId,...h,status:301,statusLifecycle:'active',reason:'content_route_change'}));
 for(const page of generateArchivePages(selectWebIndexableCatalog(catalog).map(e=>e.discoveryRecord),taxonomyRegistry)){
  if(page.collection!=='blog')continue;const sourcePath=page.route.replace(/^\/articles\//u,'/blog/');
  if(records.some(r=>r.sourcePath===sourcePath))continue;
  records.push(applicationRedirectRecordSchema.parse({id:'articles-archive-'+sourcePath.replaceAll('/','-').replace(/^-|-$/gu,''),sourcePath,targetPath:page.route,status:301,statusLifecycle:'active',reason:'site_structure_change'}));
 }
 const sources=records.map(r=>r.sourcePath);if(new Set(sources).size!==sources.length||records.some(r=>sources.includes(r.targetPath)))throw Error('ARTICLE_REDIRECT_GRAPH_CONFLICT');
 return records;
}
export const redirectArtifact = (records=applicationRedirects): string => records
  .filter((record) => record.statusLifecycle === "active")
  .slice().sort((a, b) => a.sourcePath < b.sourcePath ? -1 : 1)
  .map((record) => `${record.sourcePath} ${record.targetPath} ${record.status}\n`).join("");
