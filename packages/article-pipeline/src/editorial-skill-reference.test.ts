import {describe,expect,it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {z} from 'zod';
import {existingAuditReferencePaths} from './review/existing-audit-material.js';

// These tests validate fixture/reference wiring, never reader comprehension.
const root=process.cwd(),skillRoot='.agents/skills/japanese-technical-blog';
const gate=skillRoot+'/references/first-draft-quality-gate.md';
const detail=skillRoot+'/references/reader-first-visual-updates.md';
const workflow=skillRoot+'/references/first-draft-integrated-workflow.md';
const brief='templates/content/article-brief.md';
const text=(path:string)=>readFile(join(root,path),'utf8');
const caseSchema=z.object({id:z.string().regex(/^[a-z0-9-]+$/u),accept:z.boolean(),candidate:z.string().min(1),context:z.string().min(1).optional(),reason:z.string().min(1).optional()}).strict();
const corpusSchema=z.object({schema_version:z.literal(1),purpose:z.string().min(1),cases:z.array(caseSchema).min(1)}).strict();
const stageSkills=['draft-japanese-technical-article','independent-article-audit','revise-article-from-audit','analyze-article-evidence','plan-article-visual','independent-visual-audit'];

describe('editorial Skill reference and regression corpus wiring (not semantic evaluation)',()=>{
 it.each(['reader-first-visual','definition-placement'])('validates %s cases without pretending to judge their prose',async name=>{
  const corpus=corpusSchema.parse(JSON.parse(await text(skillRoot+'/evals/'+name+'.json')));
  expect(new Set(corpus.cases.map(c=>c.id)).size).toBe(corpus.cases.length);
  expect(corpus.cases.some(c=>c.accept)).toBe(true);expect(corpus.cases.some(c=>!c.accept)).toBe(true);
  if(name==='definition-placement')for(const item of corpus.cases){expect(item.context).toBeTruthy();expect(item.reason).toBeTruthy();}
 });
 it('keeps paired context cases, including definitions as primary topics and known metrics',async()=>{
  const c=corpusSchema.parse(JSON.parse(await text(skillRoot+'/evals/definition-placement.json'))).cases;
  const byId=Object.fromEntries(c.map(i=>[i.id,i]));
  expect(byId['rtf-support-before-context']?.accept).toBe(false);
  expect(byId['rtf-support-before-table']?.accept).toBe(true);
  expect(byId['rtf-primary-definition-first']?.accept).toBe(true);
  expect(byId['rtf-known-omit-repeat']?.accept).toBe(true);
  expect(byId['new-topic-p95-before-context']?.accept).toBe(false);
  expect(byId['new-topic-volumetric-transfer']?.accept).toBe(true);
  expect(byId['rtf-support-before-context']?.context).toBe(byId['rtf-support-before-table']?.context);
 });
 it.each(stageSkills)('connects %s to shared criteria without a new response schema',async id=>{
  const s=await text('.agents/skills/'+id+'/SKILL.md');
  expect(s).toContain('../japanese-technical-blog/references/first-draft-quality-gate.md');
  expect(s).toContain('../japanese-technical-blog/references/reader-first-visual-updates.md');
  expect(s).toContain('../japanese-technical-blog/references/first-draft-integrated-workflow.md');
  expect(s).toContain('response schema');
 });
 it('pins both shared criteria into future existing-article audit reference snapshots',async()=>{
  expect(existingAuditReferencePaths).toContain(gate);expect(existingAuditReferencePaths).toContain(detail);expect(existingAuditReferencePaths).toContain(workflow);
  for(const path of existingAuditReferencePaths)expect((await text(path)).length).toBeGreaterThan(0);
 });
 it('routes the authoring entrypoint to twelve bounded checks and to semantic fixtures',async()=>{
  const main=await text(skillRoot+'/SKILL.md'),g=await text(gate);
  expect(main).toContain('references/first-draft-quality-gate.md');
  expect(main).toContain('references/first-draft-integrated-workflow.md');
  expect(main).toContain('../../../templates/content/article-brief.md');
  expect(g).toContain('first-draft-integrated-workflow.md');
  for(let n=1;n<=12;n++)expect(g).toContain('| F'+String(n).padStart(2,'0')+' |');
  expect(g).toContain('指標自体が主題');expect(g).toContain('表の直前');
  expect(g).toContain('初使用位置');expect(g).toContain('保存/配備回数');
 });
 it('keeps explicit paired first-draft decisions with context and rationale',async()=>{
  const corpus=corpusSchema.parse(JSON.parse(await text(skillRoot+'/evals/reader-first-visual.json')));
  const byId=new Map(corpus.cases.map(c=>[c.id,c]));
  const topics=['alias-search','search-title','description','hero','local-detail','real-source','fracture','design-scope','jargon','symptom-image','optional-endnote','conclusion','rtf-context','data-prose','number-conditions'];
  for(const topic of topics){
   const accept=byId.get('integrated-'+topic+'-accept'),reject=byId.get('integrated-'+topic+'-reject');
   expect(accept?.accept,topic).toBe(true);expect(reject?.accept,topic).toBe(false);
   expect(accept?.context,topic).toBeTruthy();expect(reject?.context,topic).toBeTruthy();
   expect(accept?.reason,topic).toBeTruthy();expect(reject?.reason,topic).toBeTruthy();
  }
 });
 it('connects private planning, replaceable starter and bounded workflow without publishing the brief',async()=>{
  const w=await text(workflow),b=await text(brief),starter=await text('templates/content/article.md');
  expect(w.trimEnd().split('\n').length).toBeGreaterThanOrEqual(80);
  expect(w.trimEnd().split('\n').length).toBeLessThanOrEqual(160);
  expect(w).toContain('../../../../templates/content/article-brief.md');
  expect(w).toContain('../../../../templates/content/article.md');
  for(const mode of ['release notes','tutorial','troubleshooting','comparative review']){
   expect(w).toContain(mode);expect(b).toContain(mode);
  }
  expect(starter.trimEnd().split('\n').length).toBeLessThan(20);
  expect(starter).not.toMatch(/(?:^---|media:|https?:\/\/|<ArticleEndnote|article-brief|F0[1-9])/u);
  const operations=await text('docs/operations/content-workflows.md');
  expect(operations).toContain('../../templates/content/article-brief.md');
  expect(operations).toContain('../../templates/content/article.md');
  expect(operations).toContain('first-draft-integrated-workflow.md');
 });
 it('resolves local file links in the canonical workflow and private brief',async()=>{
  for(const path of [workflow,brief]){
   const content=await text(path);
   for(const match of content.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/gu)){
    const target=match[1]!;
    if(/^[a-z]+:/iu.test(target))continue;
    expect((await readFile(resolve(root,dirname(path),target),'utf8')).length,path+' -> '+target).toBeGreaterThan(0);
   }
  }
 });
 it('routes SEO and publication integration to rendered output and optional approved modules',async()=>{
  const seo=await text('.agents/skills/site-seo-review/SKILL.md');
  for(const term of ['seo.titleOverride','WebPage','BlogPosting','JSON-LD','実render','充填率 100','インフィル 100'])expect(seo).toContain(term);
  const publish=await text('.agents/skills/site-content-publish/SKILL.md');
  expect(publish).toContain('ArticleEndnote');expect(publish).toContain('利用可能かつ承認済み');
 });
 it('routes shared taxonomy semantics through planning, author and audit without new schema requirements',async()=>{
  const policy=await text('docs/content/editorial-policy.md');
  for(const term of ['technology','purpose','topic','feature-overview','release','未登録','空の行'])expect(policy).toContain(term);
  expect(await text(brief)).toContain('registry.kind');
  expect(await text(workflow)).toContain('更新紹介をreleaseだけで分類しない');
  expect(await text('.agents/skills/draft-japanese-technical-article/SKILL.md')).toContain('metadata/taxonomy proposalは共通分類基準');
  expect(await text('.agents/skills/independent-article-audit/SKILL.md')).toContain('taxonomy未供給なら未検査');
 });

});
