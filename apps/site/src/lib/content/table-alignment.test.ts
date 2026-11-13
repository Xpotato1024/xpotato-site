import {describe,it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {createMarkdownProcessor} from '@astrojs/markdown-remark';
import {fromHtml} from 'hast-util-from-html';
import type {Element,Root} from 'hast';
import {rehypeTableAlignment} from './table-alignment.mjs';
import {candidateAstroConfiguration} from '../../../../../packages/article-pipeline/src/candidate/candidate-astro.js';
const cells=(tree:Root|Element):Element[]=>tree.children.flatMap(node=>node.type==='element'?[...(node.tagName==='th'||node.tagName==='td'?[node]:[]),...cells(node)]:[]);
describe('CSP-safe GFM table alignment',()=>{
 it('preserves text and column alignment as finite static attributes',async()=>{
  const source='| Left | Center | Right | Plain |\n| :--- | :---: | ---: | --- |\n| a | b | 1,060 | d |';
  const plain=await createMarkdownProcessor({syntaxHighlight:false});
  const styled=await createMarkdownProcessor({syntaxHighlight:false,rehypePlugins:[rehypeTableAlignment]});
  const before=cells(fromHtml((await plain.render(source)).code,{fragment:true}));
  const html=(await styled.render(source)).code,after=cells(fromHtml(html,{fragment:true}));
  const semantic=(nodes:Element[])=>JSON.stringify(nodes.map(n=>n.children),(key,value)=>key==='position'?undefined:value);
  expect(semantic(after)).toBe(semantic(before));
  expect(after.map(n=>n.properties.dataCellAlign)).toEqual(['left','center','right',undefined,'left','center','right',undefined]);
  expect(html).not.toMatch(/\s(?:style|align)=/u);
 });
 it('does not sanitize arbitrary inline styles or unsupported alignment into admitted styling',()=>{
  const tree={type:'root',children:[
   {type:'element',tagName:'td',properties:{style:'color:red',align:'right'},children:[]},
   {type:'element',tagName:'td',properties:{align:'justify'},children:[]},
   {type:'element',tagName:'div',properties:{align:'right'},children:[]},
  ]};
  rehypeTableAlignment()(tree);
  expect(tree.children[0]!.properties).toEqual({style:'color:red',dataCellAlign:'right'});
  expect(tree.children[1]!.properties).toEqual({align:'justify'});
  expect(tree.children[2]!.properties).toEqual({align:'right'});
  const once=JSON.stringify(tree);rehypeTableAlignment()(tree);expect(JSON.stringify(tree)).toBe(once);
 });
 it('uses the same transform in production Markdown/MDX and private candidate rendering',async()=>{
  const config=await readFile('apps/site/astro.config.mjs','utf8');
  expect(config.match(/rehypePlugins: \[rehypeFootnoteBacklinks, rehypeTableAlignment\]/gu)).toHaveLength(2);
  const candidate=candidateAstroConfiguration(process.cwd(),'https://example.invalid/articles/fixture/');
  expect(candidate.match(/rehypePlugins:\[rehypeFootnoteBacklinks,rehypeTableAlignment\]/gu)).toHaveLength(2);
  const css=await readFile('apps/site/src/styles/content.css','utf8');
  for(const alignment of ['left','center','right'])expect(css).toContain('[data-cell-align="'+alignment+'"]');
 });
});
