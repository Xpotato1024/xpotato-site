import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {splitArticleLead} from './article-lead.js';
import {semanticContentModulePropsSchemas as schemas} from '@xpotato/content-contracts';
describe('article lead and responsive panels',()=>{
 it('keeps the general explanation independent of software and all panels present',()=>{const article=readFileSync(new URL('../../../../tests/fixtures/article-concrete/article.mdx',import.meta.url),'utf8');const common=article.split('## 使っているスライサーで設定名を探す')[0]!;expect(common).not.toMatch(/Bambu|Cura|Orca|PrusaSlicer/);expect(article.match(/layout="diagrams"/g)).toHaveLength(3);expect(article.match(/<Figure /g)).toHaveLength(9);expect(article).not.toContain('| ---');});

 it('moves only two leading paragraphs, preserving inline semantics',()=>{const html='<p>一<strong>強調</strong></p><p>二</p><h2 id="x">節</h2><p>三</p>';const r=splitArticleLead(html);expect(r.lead).toBe('<p>一<strong>強調</strong></p><p>二</p>');expect(r.body).toContain('<h2 id="x">');expect(r.lead+r.body).toBe(html)});
 it('does not promote images or modules to the prose lead',()=>{for(const html of ['<figure>図</figure><p>説明</p>','<p><img src="x"></p><h2>節</h2>','<aside>注意</aside><p>本文</p>'])expect(splitArticleLead(html)).toEqual({lead:'',body:html})});
 it('keeps markup and comments without duplication',()=>{const r=splitArticleLead('<!-- lead --><p><a href="#h">見出し</a></p><h2 id="h">本文</h2>');expect(r.lead).toContain('href="#h"');expect((r.lead+r.body).match(/id="h"/g)).toHaveLength(1)});
 it('does not manufacture a lead for heading-first articles',()=>{const s='<h2>節</h2><p>本文</p>';expect(splitArticleLead(s).body).toBe(s);expect(splitArticleLead(s).lead).toBe('')});
 it('accepts compact figures and semantic diagram galleries',()=>{expect(schemas.Figure.parse({asset:'x',alt:'図',width:'compact'}).width).toBe('compact');expect(schemas.Gallery.parse({label:'比較',layout:'diagrams'}).layout).toBe('diagrams');expect(()=>schemas.Gallery.parse({layout:'anything'})).toThrow()});
});
