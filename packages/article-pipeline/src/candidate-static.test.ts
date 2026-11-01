import {describe,it,expect} from 'vitest';
import {fromHtml} from 'hast-util-from-html';
import {candidateBodyText} from './candidate-static.js';
const parse=(html:string)=>fromHtml(html) as Parameters<typeof candidateBodyText>[0];
const main=(inside:string)=>'<main id="main-content"><article>'+inside+'</article></main>';
describe('shared layout candidate body coverage',()=>{
 it('includes the separated lead and body, excluding navigation and unrelated prose',()=>{
  const html='<div class="prose">Unrelated</div>'+main('<div class="prose article-lead"><p>Lead sentence.</p></div><nav>TOC label</nav><div class="prose article-body"><h2>Body heading</h2><p>Body sentence.</p></div>')+'<footer class="prose">Footer</footer>';
  const text=candidateBodyText(parse(html));expect(text).toContain('Lead sentence.');expect(text).toContain('Body sentence.');
  expect(text).not.toMatch(/Unrelated|TOC label|Footer/u);
 });
 it('supports articles without a separate lead and refuses missing or ambiguous owned regions',()=>{
  const body='<div class="prose article-body">Body.</div>';
  expect(candidateBodyText(parse(main(body)))).toBe('Body.');
  for(const html of [main('<div class="prose article-lead">Only lead.</div>'),main(body+body),main('<div class="prose">Unowned prose</div>'),main(body)+main(body),'<article>'+body+'</article>'])
   expect(()=>candidateBodyText(parse(html))).toThrow('CANDIDATE_BODY_MISSING');
 });
});
