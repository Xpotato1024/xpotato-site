import { expandedCss } from "../../styles/expanded-css-test-helper.js";
import {readFile} from 'node:fs/promises';
import {describe,it,expect} from 'vitest';
const get=(p:string)=>readFile(new URL(p,import.meta.url),'utf8');
describe('conditional article motion styles',()=>{
 it('loads motion CSS with the same rendered-body condition as its script, alongside independent code CSS',async()=>{
  const layout=await get('../../layouts/ContentLayout.astro');
  expect(layout).toContain('const hasAnimatedMedia = bodyHtml.includes("data-article-motion");');
  expect(layout).toContain('import articleMotionCssHref from "../styles/article-motion.css?url&no-inline";');
  expect(layout).toContain('pageCssHrefs={[...(hasCodeBlocks ? [codeCssHref] : []), ...(hasAnimatedMedia ? [articleMotionCssHref] : []), ...(hasMediaCredits ? [mediaCreditCssHref] : [])]}');
  expect(layout).toContain('{hasAnimatedMedia && <script is:inline src="/scripts/article-motion.js"');
 });
 it('keeps ordinary figure CSS free of motion controls without removing caption styles or tool isolation',async()=>{
  const modules=await get('../../styles/article-modules.css'),motion=expandedCss(await get('../../styles/article-motion.css'));
  expect(modules).not.toContain('article-motion');
  expect(modules).toContain('.article-figure>figcaption');
  expect(motion).toContain('.article-motion-toggle');
  expect(motion).toContain('grid-column: 1 / -1; grid-row: 1;');
  for(const selector of motion.matchAll(/[.]prose[^{}]+[{]/gu))expect(selector[0]).toContain('[data-bt]');
 });
 it('exercises the extracted stylesheet in the shared-renderer browser regression',async()=>{
  const fixture=await get('../../../../../tools/qa/article-motion-layout.mjs');
  expect(fixture).toContain('"article-modules.css","article-motion.css"');
 });
});
