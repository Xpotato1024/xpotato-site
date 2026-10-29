import {describe,it,expect} from 'vitest';
import {layoutSocialTitle} from './social-title-layout.mjs';
import cases from '../../../../tests/fixtures/blog-foundation/social-card-titles.json';
const measure=(text:string,size:number)=>Array.from(text).reduce((sum,c)=>sum+(/[\x00-\x7f]/u.test(c)?size*.52:size),0);
describe('display-only social title line layout',()=>{
 it('keeps the canonical title unchanged while honoring editorial phrase lines',()=>{
  const item=cases.cases[0]!,title=item.title,lines=item.cardDisplay!.lines;
  const result=layoutSocialTitle(title,{lines},measure);
  expect(result.title).toBe(title);expect(result.title).not.toContain('\n');expect(result.lines).toEqual(lines);expect(result.fontSize).toBe(54);
 });
 it('automatically balances Japanese, mixed scripts, brackets and whole Latin tokens',()=>{
  for(const item of cases.cases.filter(item=>!item.expectedError)){
   const result=layoutSocialTitle(item.title,{},measure);expect(result.title).toBe(item.title);
   expect(result.lines.join('').replace(/\s/gu,'')).toBe(item.title.replace(/\s/gu,''));
   expect(result.fontSize).toBeGreaterThanOrEqual(48);
   for(const line of result.lines){expect(line).not.toMatch(/^[、。？！）」』】]/u);expect(line).not.toMatch(/[（「『【]$/u);expect(measure(line,result.fontSize)).toBeLessThanOrEqual(540);}
   for(const token of item.title.match(/[A-Za-z0-9][A-Za-z0-9._+:/#%=-]*/gu)??[])expect(result.lines.some(line=>line.includes(token))).toBe(true);
  }
 });
 it('rejects text changes, empty/HTML-shaped additions, embedded newlines and forbidden breaks',()=>{
  for(const lines of [['充填率100%なら','丈夫になる？'],['<b>充填率100%なら</b>','丈夫になる？','壊れ方で選ぶ設定'],[''],['充填率100%なら\n丈夫になる？','壊れ方で選ぶ設定']])expect(()=>layoutSocialTitle(cases.cases[0]!.title,{lines},measure)).toThrow();
  expect(()=>layoutSocialTitle('設定（外周）',{lines:['設定（','外周）']},measure)).toThrow('CARD_LINES_KINSOKU');
  expect(()=>layoutSocialTitle('TypeScript入門',{lines:['Type','Script入門']},measure)).toThrow('CARD_LINES_SPLIT_LATIN_TOKEN');
  expect(()=>layoutSocialTitle('改行\n付きタイトル',{},measure)).toThrow('CARD_TITLE_INVALID');
  expect(()=>layoutSocialTitle('改行\u2028付きタイトル',{},measure)).toThrow('CARD_TITLE_INVALID');
  expect(()=>layoutSocialTitle('Cafe\u0301入門',{lines:['Cafe','\u0301入門']},measure)).toThrow('CARD_LINES_SPLIT_GRAPHEME');
  expect(()=>layoutSocialTitle('A \u0301B',{lines:['A','\u0301B']},()=>10)).toThrow('CARD_LINES_SPLIT_GRAPHEME');
  expect(()=>layoutSocialTitle('安全な見出し',{html:'<img>'} as never,measure)).toThrow('CARD_LAYOUT_OPTIONS_INVALID');
 });
 it('reports capacity failure instead of shrinking below the minimum or dropping text',()=>{
  for(const item of cases.cases.filter(item=>item.expectedError))expect(()=>layoutSocialTitle(item.title,{},measure)).toThrow('CARD_TITLE_CANNOT_FIT');
  expect(()=>layoutSocialTitle('あ'.repeat(181),{},measure)).toThrow('CARD_TITLE_TOO_LONG');
  expect(()=>layoutSocialTitle('小さくしない',{minSize:36},measure)).toThrow('CARD_LAYOUT_OPTIONS_INVALID');
 });
});
