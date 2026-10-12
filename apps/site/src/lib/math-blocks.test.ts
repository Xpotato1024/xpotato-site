import {describe,expect,it} from 'vitest';
import {renderSafeMath,remarkMathBlocks} from './math-blocks.mjs';
import {validatePortableMdx} from '../../../../packages/site-validators/src/portable-mdx.js';
describe('build-time MathML fences',()=>{
  it.each(['\\frac{1}{2}+\\frac{1}{3}=\\frac{5}{6}','\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}','\\begin{aligned}2x+4&=10\\\\2x&=6\\\\x&=3\\end{aligned}'])('renders fraction/matrix/transformation without style or runtime %s',source=>{
    const result=JSON.stringify(renderSafeMath(source,'合成検証用の式'));
    expect(result).toContain('"tagName":"math"');expect(result).not.toContain('"style":');expect(result).not.toContain('"script"');expect(result).not.toContain('"href":');
  });
  it.each(['\\href{https://example.com}{x}','\\htmlStyle{color:red}{x}','\\gdef\\x{x}\\x','\\unknowncommand','x'.repeat(4097)])('rejects unsupported/unsafe/budget input %s',source=>expect(()=>renderSafeMath(source,'式')).toThrow());
  it('retains portable MDX restrictions and requires a label',()=>{
    const source='```math label="分数"\n\\frac{1}{2}\n```';expect(validatePortableMdx(source)).toEqual([]);
    expect(validatePortableMdx('<math><mi>x</mi></math>')).not.toEqual([]);
    const transform=remarkMathBlocks();expect(()=>transform({type:'root',children:[{type:'code',lang:'math',value:'x'}]})).toThrow();
  });
  it('emits actual MDX elements, rather than ignored paragraph hChildren, with a safe print fallback',()=>{
    const tree={type:'root',children:[{type:'code',lang:'math',meta:'label="横長式" print="source"',value:'x+y'}]};
    remarkMathBlocks()(tree);
    expect(tree.children[0]).toMatchObject({type:'mdxJsxFlowElement',name:'div'});
    expect(JSON.stringify(tree)).toContain('"name":"math"');expect(JSON.stringify(tree)).toContain('math-source-print');
    expect(JSON.stringify(tree)).toContain('式の原文（TeX）');
  });
});
