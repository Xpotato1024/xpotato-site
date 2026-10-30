import {it,expect} from 'vitest';
import identityMap from '../../../../docs/migration/content-id-map-v1.json';
import {articleUrlHistory,currentArticleHref} from './article-url-history.js';
import {currentApplicationRedirects} from '../content-registry/redirects.js';
import {deriveContentCatalog} from './catalog.js';import {taxonomyRegistry} from '../content-registry/taxonomy/index.js';
import {articleRoute} from '@xpotato/content-contracts';
it('preserves exactly the frozen 44 legacy identities and every full-bit destination',()=>{
 const expected=identityMap.entries.filter(e=>e.collection==='blog').map(e=>[e.vNextContentId,'/blog/'+e.legacyContentId.slice(5)+'/',articleRoute(e.vNextContentId)].join(' ')).sort();
 expect(articleUrlHistory.map(h=>[h.contentId,h.sourcePath,h.targetPath].join(' ')).sort()).toEqual(expected);
});
it('defers held targets, activates published/noindex targets and flattens archive/tool redirects',()=>{
 const h=articleUrlHistory[0]!,source={collection:'blog' as const,slug:'legacy-filename',data:{id:h.contentId,title:'T',description:'D',pubDate:'2026-10-01',category:'software',tags:['astro'],draft:true}};
 const held=deriveContentCatalog([source],taxonomyRegistry),published=deriveContentCatalog([{...source,data:{...source.data,draft:false}}],taxonomyRegistry);
 expect(currentApplicationRedirects(held).some(r=>r.sourcePath===h.sourcePath)).toBe(false);
 const active=currentApplicationRedirects(published);expect(active.find(r=>r.sourcePath===h.sourcePath)?.targetPath).toBe(h.targetPath);
 expect(active.find(r=>r.sourcePath==='/blog/category/software/')?.targetPath).toBe('/articles/category/software/');
 expect(active.find(r=>r.sourcePath==='/blog/prime-factorizer/')?.targetPath).toBe('/tools/prime-factorizer/');
 expect(active.every(r=>!active.some(s=>s.sourcePath===r.targetPath))).toBe(true);
 expect(currentApplicationRedirects(deriveContentCatalog([{...source,data:{...source.data,draft:false,seo:{noindex:true}}}],taxonomyRegistry)).some(r=>r.sourcePath===h.sourcePath)).toBe(true);
});
it('resolves same-site semantic references without changing external URLs or fragment/query identities',()=>{
 const h=articleUrlHistory[0]!,origin='https://xpotato.net/';
 expect(currentArticleHref(h.sourcePath+'?view=1#section',origin)).toBe(h.targetPath+'?view=1#section');
 expect(currentArticleHref('https://elsewhere.example'+h.sourcePath,origin)).toBe('https://elsewhere.example'+h.sourcePath);
 expect(currentArticleHref('/blog/',origin)).toBe('/articles/');
 expect(currentArticleHref('/blog/prime-factorizer/',origin)).toBe('/tools/prime-factorizer/');
});
