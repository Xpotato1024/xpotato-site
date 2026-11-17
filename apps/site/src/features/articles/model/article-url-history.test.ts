import {it,expect} from 'vitest';
import identityMap from "../../../../../../content/registry/publication-holds.json";
import {articleUrlHistory,currentArticleHref} from './article-url-history.js';
import {currentApplicationRedirects} from "../../../../../../content/registry/redirects.js";
import {deriveContentCatalog} from "@xpotato/portable-content/catalog";import {taxonomyRegistry} from "../../../../../../content/registry/taxonomy/index.js";
import {articleRoute} from '@xpotato/content-contracts';
it('preserves exactly the frozen 44 legacy identities and every full-bit destination',()=>{
 expect(articleUrlHistory.map(h=>h.contentId).sort()).toEqual(identityMap.records.map(r=>r.contentId).sort());
 for(const row of articleUrlHistory){expect(row.sourcePath).toMatch(/^\/blog\/[^/]+\/$/);expect(row.targetPath).toBe(articleRoute(row.contentId));}
 expect(new Set(articleUrlHistory.map(h=>h.sourcePath)).size).toBe(44);
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
