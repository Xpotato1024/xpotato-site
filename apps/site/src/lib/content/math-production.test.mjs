import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compile,createProcessor} from '@mdx-js/mdx';
import {renderSafeMath,remarkMathBlocks} from './math-blocks.mjs';

for(const [label,source] of [
  ['fraction','\\frac{1}{2}+\\frac{1}{3}=\\frac{5}{6}'],
  ['matrix','\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}'],
  ['aligned','\\begin{aligned}2x+4&=10\\\\2x&=6\\\\x&=3\\end{aligned}'],
]) test('actual KaTeX MathML: '+label,async()=>{
  const math=JSON.stringify(renderSafeMath(source,'式の内容を説明するラベル'));
  assert.match(math,/"tagName":"math"/u);assert.doesNotMatch(math,/"style"|"script"|"href"/u);
  const mdx='```math label="式の説明" print="source"\n'+source+'\n```';
  const compiled=String(await compile(mdx,{remarkPlugins:[remarkMathBlocks]}));
  assert.match(compiled,/math-source-print/u);assert.match(compiled,/math-print-source/u);
});
for(const source of ['\\notACommand','\\frac{1}{','\\def\\x{x}\\x','\\renewcommand{\\x}{x}',
  '\\let\\x=\\alpha','\\href{https://example.com}{x}','\\htmlStyle{color:red}{x}',
  '\\color{red}x','x'.repeat(4097),'']) test('rejects invalid/unsafe math '+source.slice(0,35),()=>assert.throws(()=>renderSafeMath(source,'式')));
test('nearby currency, code spans, nonmath fences and legacy metadata remain portable',async()=>{
  const source='価格は $5 と $10。`$x$` はコード。\n\n```js\nconst price = "$5";\n```\n\n```math label="既存ラベル"\nx+1\n```';
  const processor=createProcessor();const tree=processor.parse(source);remarkMathBlocks()(tree);
  const nodes=JSON.stringify(tree);assert.match(nodes,/価格は \$5 と \$10/u);assert.match(nodes,/"type":"inlineCode","value":"\$x\$"/u);
  assert.match(nodes,/"lang":"js"/u);assert.match(nodes,/math-block/u);
  await assert.rejects(compile('```math\nx\n```',{remarkPlugins:[remarkMathBlocks]}),/label/u);
  await assert.rejects(compile('```math label="式" print="unknown"\nx\n```',{remarkPlugins:[remarkMathBlocks]}),/label/u);
});
test('long formulas choose existing print fallback and a labelled keyboard scroll group',()=>{
  const tree={type:'root',children:[{type:'code',lang:'math',meta:'label="横長の合成式"',value:Array.from({length:90},(_,i)=>String(i)).join('+')}]};
  remarkMathBlocks()(tree);const result=JSON.stringify(tree);assert.match(result,/math-source-print/u);
  assert.match(result,/"name":"tabIndex","value":"0"/u);assert.match(result,/横長の合成式/u);
  assert.match(result,/式の原文（TeX）/u);
  assert.throws(()=>renderSafeMath('x','改行\nラベル'));
});
