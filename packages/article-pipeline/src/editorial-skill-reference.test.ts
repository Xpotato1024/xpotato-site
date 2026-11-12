import {describe,expect,it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {z} from 'zod';
import {existingAuditReferencePaths} from './review/existing-audit-material.js';

// These tests validate fixture/reference wiring, never reader comprehension.
const root=process.cwd(),skillRoot='.agents/skills/japanese-technical-blog';
const gate=skillRoot+'/references/first-draft-quality-gate.md';
const detail=skillRoot+'/references/reader-first-visual-updates.md';
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
  expect(s).toContain('response schema');
 });
 it('pins both shared criteria into future existing-article audit reference snapshots',async()=>{
  expect(existingAuditReferencePaths).toContain(gate);expect(existingAuditReferencePaths).toContain(detail);
  for(const path of existingAuditReferencePaths)expect((await text(path)).length).toBeGreaterThan(0);
 });
 it('routes the authoring entrypoint to twelve bounded checks and to semantic fixtures',async()=>{
  const main=await text(skillRoot+'/SKILL.md'),g=await text(gate);
  expect(main).toContain('references/first-draft-quality-gate.md');
  for(let n=1;n<=12;n++)expect(g).toContain('| F'+String(n).padStart(2,'0')+' |');
  expect(g).toContain('指標自体が主題');expect(g).toContain('表の直前');
  expect(g).toContain('初使用位置');expect(g).toContain('保存/配備回数');
 });
});
