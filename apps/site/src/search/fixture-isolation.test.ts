import {it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {parse} from 'yaml';
import {readSiteContent} from '../../../../packages/site-validators/src/site-content.js';
import {validatePortableMdx} from '@xpotato/portable-content';
import {tokenize} from './tokenizer.js';
it('uses the relocated Japanese/technical fixture without registering it in the normal content or media catalog',async()=>{
 const source=await readFile(new URL('../../../../tests/fixtures/search/article.mdx',import.meta.url),'utf8'),parts=/^---\r?\n([\s\S]+?)\r?\n---([\s\S]*)$/u.exec(source)!;
 const draft={frontmatter:parse(parts[1]!),body:parts[2]!};
 expect(validatePortableMdx(draft.body)).toEqual([]);
 expect(tokenize(draft.body)).toEqual(expect.arrayContaining(['新幹','幹線','c++','c#','gpt-5.6','astro','mdx']));
 expect(draft.frontmatter.draft).toBe(true);
 expect((await readSiteContent()).catalog.some(c=>c.routeRecord.contentId===draft.frontmatter.id)).toBe(false);
 const registry=await readFile(new URL('../content-registry/media/index.ts',import.meta.url),'utf8');
 expect(registry).not.toContain(draft.frontmatter.id);
});
