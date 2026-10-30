import {articleRoute,contentIdSchema} from '@xpotato/content-contracts';
import history from '../content-registry/article-url-history.json' with {type:'json'};
if(history.schemaVersion!==1||history.records.length!==44||history.activation!=='published-targets-only')throw Error('ARTICLE_HISTORY_SHAPE');
const sources=new Set<string>(),ids=new Set<string>();
for(const r of history.records){contentIdSchema.parse(r.contentId);if(!r.sourcePath.startsWith('/blog/')||r.targetPath!==articleRoute(r.contentId)||sources.has(r.sourcePath)||ids.has(r.contentId))throw Error('ARTICLE_HISTORY_IDENTITY');sources.add(r.sourcePath);ids.add(r.contentId);}
export const articleUrlHistory=Object.freeze(history.records.map(r=>Object.freeze(r)));
/** Resolve semantic same-site links at render time, leaving source/citation
 * bytes and external URLs intact. Existing tool exceptions remain explicit.
 */
export function currentArticleHref(href:string,origin:string):string {
 const url=new URL(href,origin);if(url.origin!==new URL(origin).origin)return href;
 const path=url.pathname;
 const special=path==='/blog/prime-factorizer/'?'/tools/prime-factorizer/':path==='/blog/category/tools/'?'/tools/':undefined;
 const target=special??articleUrlHistory.find(r=>r.sourcePath===path)?.targetPath
  ??(['/blog/category/diary/','/blog/category/infra/','/blog/category/network/'].includes(path)?'/articles/':undefined)
  ??(path==='/blog/'?'/articles/':/^\/blog\/(?:page|category|tag|archive)\//u.test(path)?path.replace(/^\/blog\//u,'/articles/'):undefined);
 if(!target)return href;
 return target+url.search+url.hash;
}
