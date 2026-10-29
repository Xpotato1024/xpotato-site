import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
const fixture=new URL('../../../../tests/fixtures/article-concrete/',import.meta.url);
const read=(name:string)=>readFileSync(new URL(name,fixture),'utf8');
const supports=/<path d="M[\d.]+ 83L[\d.]+ 162" fill="none" stroke="#8e7aab" stroke-width="2"\/>/g;
describe('infill article comparison coverage',()=>{
 it('keeps baseline and dense-support panel identical except for support spacing',()=>{const a=read('roof-a.svg'),c=read('roof-c.svg');expect([...a.matchAll(supports)]).toHaveLength(5);expect([...c.matchAll(supports)]).toHaveLength(10);expect(a.replace(supports,'')).toBe(c.replace(supports,''));});
 it('illustrates both claimed top-surface improvements',()=>{const s=read('article.mdx').split('## 上面がへこむなら')[1]!.split('## 使っている')[0]!;for(const id of ['roof-a','roof-b','roof-c'])expect(s).toContain('asset="'+id+'"');expect(s).toContain('C 支えだけ密に：上面0.6mm・充填30%');});
 it('distinguishes material allocation from a universal strength ranking',()=>{const s=read('article.mdx');expect(s).toContain('外周4周＋充填率100%');expect(s).toContain('外周を増やせば100%充填より強い');expect(s).toContain('という意味ではありません');});
});
