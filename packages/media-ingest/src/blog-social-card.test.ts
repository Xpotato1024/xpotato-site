import {describe,it,expect} from 'vitest';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {blogFrontmatterSchema} from '@xpotato/content-contracts';
import {deterministicBlogSocialCard} from './blog-social-card.js';
import {bundledOutlineFont} from './bundled-outline-font.js';
const input={repositoryRoot:resolve('.'),contentId:'00000000-0000-4000-8000-000000000001',title:'充填率100%なら丈夫になる？ 壊れ方で選ぶ設定',categoryLabel:'工作 / 3Dプリンタ',cardDisplay:{lines:['充填率100%なら','丈夫になる？','壊れ方で選ぶ設定']}};
describe('selected C social card',()=>{
 it('repeats outline and raster bytes, with all font/toolchain/layout identities and no runtime references',async()=>{
  const a=await deterministicBlogSocialCard(input),b=await deterministicBlogSocialCard(input);
  expect(a.svg.equals(b.svg)).toBe(true);expect(a.derivationSha256).toBe(b.derivationSha256);
  expect(a.binding.layout).toMatchObject({lines:input.cardDisplay.lines,fontSize:54,mode:'manual'});
  expect(a.binding.fonts.title).toMatchObject({family:'Noto Serif JP',weight:400,fallback:false});
  expect(a.binding.toolchain.icu).toBeTruthy();expect(a.binding.layoutImplementationSha256).toMatch(/^[a-f0-9]{64}$/u);
  expect(a.svg.toString()).not.toMatch(/<text\b|<image\b|<use\b|href=|url\(|<script/iu);
  const png=await sharp(a.svg).png().toBuffer();expect(png.equals(await sharp(b.svg).png().toBuffer())).toBe(true);
  expect(await sharp(png).metadata()).toMatchObject({width:1200,height:630,format:'png'});
  const changed=await deterministicBlogSocialCard({...input,cardDisplay:undefined});
  expect(changed.binding.layout.mode).toBe('automatic');expect(changed.derivationSha256).not.toBe(a.derivationSha256);
 },30000);
 it('shapes new Japanese, brackets, Latin tokens and combining characters without dropped text',async()=>{
  const font=bundledOutlineFont(input.repositoryRoot,{family:'Noto Serif JP',weight:400});
  expect(font.shapedPaths('Cafe\u0301',0,54,54,'#15141d')).toBe(font.shapedPaths('Café',0,54,54,'#15141d'));
  for(const title of ['検証から始める、小さな電子工作','非同期処理の境界を考える（Node.jsとC++の実装比較）','Rust 2024とSQLiteで記録を残す','Cafe\u0301とUTF-8の文字を読む']){
   const card=await deterministicBlogSocialCard({...input,title,cardDisplay:undefined});
   expect(card.binding.layout.lines.join('').replace(/\s/gu,'')).toBe(title.replace(/\s/gu,''));expect(card.binding.layout.fontSize).toBeGreaterThanOrEqual(48);
  }
 },30000);
 it('refuses unsupported glyphs, oversized labels, title edits, unknown display options and overflow',async()=>{
  for(const value of [{title:'未対応 🫠'},{categoryLabel:'長'.repeat(40)},{title:'SupercalifragilisticexpialidociousSupercalifragilisticexpialidocious'},
   {title:'x\u0301の未対応結合'},
   {cardDisplay:{lines:['勝手に変更']}},{cardDisplay:{html:'<b>bad</b>'} as never}]){
   await expect(deterministicBlogSocialCard({...input,cardDisplay:undefined,...value})).rejects.toThrow();
  }
 });
 it('accepts display-only Blog settings without modifying title or SEO overrides, rejecting unsafe line structures',()=>{
  const fm={id:input.contentId,title:input.title,description:'検証用',pubDate:'2026-10-29',category:'robotics',tags:[],draft:true,cardDisplay:input.cardDisplay,seo:{titleOverride:'検索向けの一行タイトル'}};
  expect(blogFrontmatterSchema.parse(fm)).toEqual(fm);
  for(const cardDisplay of [{html:'<img>'},{lines:['充填率100%なら','書換え']},{lines:['充填率100%なら\n丈夫になる？','壊れ方で選ぶ設定']}]){
   expect(()=>blogFrontmatterSchema.parse({...fm,cardDisplay})).toThrow();
  }
 });
});
