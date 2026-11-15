import {describe,expect,it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {contentModuleRegistry} from '../../content-registry/content-modules.js';

const root=process.cwd();
const read=(path:string)=>readFile(resolve(root,path),'utf8');
const article='.agents/skills/japanese-technical-blog/SKILL.md';
const tool='.agents/skills/create-browser-tool/SKILL.md';
const runbook='docs/operations/content-production.md';
const composition='docs/content/page-composition.md';
const engineering='docs/operations/engineering-visuals.md';
const supportedFiles=[article,tool,'.agents/README.md','.agents/skills/site-content-publish/SKILL.md',
 '.agents/skills/update-site/SKILL.md',runbook,composition,engineering,'templates/content/tool-brief.md',
 'docs/design/adr/0078-content-production-and-static-technical-visuals.md'];

// These are routing/reference/ownership checks, not a semantic editorial audit or live publication proof.
describe('two end-to-end content entrypoints and shared composition',()=>{
 it.each(supportedFiles)('resolves local reference files in %s',async path=>{
  for(const match of (await read(path)).matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/gu)){
   const target=match[1]!;
   if(/^[a-z]+:/iu.test(target))continue;
   expect((await readFile(resolve(root,dirname(path),target),'utf8')).trim().length,path+' -> '+target).toBeGreaterThan(0);
  }
 });
 it('keeps the public entrypoint count small without erasing independent stage responsibilities',async()=>{
  const a=await read(article),t=await read(tool),index=await read('.agents/README.md');
  for(const source of [a,t]){
   expect(source).toContain('content-production.md');expect(source).toContain('page-composition.md');
   expect(source).toContain('目的');expect(source).toContain('preview');expect(source).toContain('配備準備');
   expect(source.trimEnd().split('\n').length).toBeLessThan(150);
  }
  expect(a).toContain('ツール実装');expect(t).toContain('記事執筆');
  for(const id of ['discover-article-sources','analyze-article-evidence','draft-japanese-technical-article',
   'independent-article-audit','revise-article-from-audit','plan-article-visual','independent-visual-audit'])expect(index).toContain(id);
  expect(index).toContain('独立context');expect(index).toContain('自己発行しない');
 });
 it('defines article fields and a tool-first operating order using the same component owners',async()=>{
  const text=await read(composition);
  for(const element of ['タイトル','リード文','主分類','技術タグ','目的タグ','公開日・更新日','ヒーロー','メインコンテンツ','補足aside','description'])expect(text).toContain(element);
  expect(text).toContain('入力と主要操作');expect(text).toContain('core');expect(text).toContain('adapter');
  expect(text).toContain('article ID/URL指定のCSS');expect(text).toContain('共通API/所有者');
  for(const id of ['Figure','Gallery','ArticleEndnote','BarChart'])expect(contentModuleRegistry.some(m=>m.id===id&&m.status==='active')).toBe(true);
 });
 it('does not describe local bytes, a PR candidate, or a private page as production publication',async()=>{
  const text=await read(runbook);
  for(const state of ['レビュー準備済み','配備準備済み','配信済み'])expect(text).toContain(state);
  expect(text).toContain('PR candidate artifactはProduction artifactではない');
  expect(text).toContain('未承認素材を先出ししない');expect(text).toContain('blind retry');
  expect(text).toContain('最初の未完了工程');expect(text).toContain('独立して進められる');
 });
 it('routes non-images separately and requires actual engineering sources rather than look-alike images',async()=>{
  const workflow=await read(runbook),eng=await read(engineering);
  expect(workflow).toContain('ZIP/CAD/CSV/バイナリを画像拡張子へ偽装しない');
  expect(workflow).toContain('実保存');expect(workflow).toContain('合成fixture');
  for(const source of ['kicad-cli sch erc','kicad-cli sch export svg','STEP','G-code','保存されたstate/実フレーム'])expect(eng).toContain(source);
  expect(eng).toContain('実機検査の証拠ではない');
 });
 it('selects update scope instead of hardcoding correction and retires stale Draft PR gating',async()=>{
  const update=await read('.agents/skills/update-site/SKILL.md');
  for(const kind of ['refresh','correction','expansion','restructure','metadata_only','media_only'])expect(update).toContain('`'+kind+'`');
  expect(update).toContain('--update-kind <kind>');
  expect(await read('.agents/skills/site-content-publish/SKILL.md')).not.toContain('optimize-site-seo');
  for(const path of [article,'.agents/skills/site-content-publish/SKILL.md',
   '.agents/skills/japanese-technical-blog/references/first-draft-integrated-workflow.md'])expect(await read(path)).not.toContain('別Draft PR #182');
 });
 it('separates changed experimental factors from controls, including a version comparison',async()=>{
  const gate=await read('.agents/skills/japanese-technical-blog/references/first-draft-quality-gate.md');
  expect(gate).toContain('意図して変える条件');expect(gate).toContain('版自体が変更条件');
 });
});
