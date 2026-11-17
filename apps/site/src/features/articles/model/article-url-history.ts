import {articleUrlHistory} from '../../../../../../content/registry/article-url-history.js';
export {articleUrlHistory} from '../../../../../../content/registry/article-url-history.js';
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
