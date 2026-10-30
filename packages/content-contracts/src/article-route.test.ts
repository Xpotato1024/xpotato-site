import {describe,it,expect} from 'vitest';import {randomUUID} from 'node:crypto';
import {articleUrlId,articleContentId,articleRoute,assertArticleRoute} from './article-route.js';
describe('immutable article URLs',()=>{
 it('encodes all UUID bits without a second identity',()=>{
  const id='e7562440-e0bf-42a9-8a90-d66f4e1a4eb8';
  expect(articleUrlId(id)).toBe('77arj41r5z8amrn46pdx71mknr');
  const ids=Array.from({length:1000},()=>randomUUID());const urls=ids.map(articleUrlId);
  expect(new Set(urls).size).toBe(ids.length);expect(urls.map(articleContentId)).toEqual(ids);
  expect(articleRoute(id)).toBe('/articles/77arj41r5z8amrn46pdx71mknr/');
 });
 it('rejects aliases, overflow, invalid UUIDs and route-ID substitution',()=>{
  const id='e7562440-e0bf-42a9-8a90-d66f4e1a4eb8',url=articleUrlId(id);
  for(const bad of [url.toUpperCase(),url.slice(1),url+'0','8'+url.slice(1),'o'+url.slice(1),'0'.repeat(26),'../'+url])expect(()=>articleContentId(bad)).toThrow();
  expect(()=>articleUrlId(id.toUpperCase())).toThrow();
  expect(()=>assertArticleRoute(articleRoute(id),randomUUID())).toThrow();
 });
});
