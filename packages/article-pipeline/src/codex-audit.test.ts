import {describe,it,expect} from 'vitest';
import {parseCodexAuditEvents,hasRecordedAuditProof,readRecordedAuditProof,validateCodexJudgment,assertNoUncertainAudit,assertCompletedAuditReadback} from './codex-audit.js';
import {assertExistingAuditPhysicalSet,assertGrantInventory} from './existing-audit-material.js';
import {containsHardDenyMaterial} from './disclosure.js';
import {sha256,fingerprint} from './canonical.js';
import {RuntimeOperationJournal} from './runtime-journal.js';
import {mkdtemp,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {EventEmitter} from 'node:events';
import {privateDraftOutputErrors} from '@xpotato/portable-content/private-output';
import {controlAuditChild} from './codex-audit-child.mjs';
const response={protocol:'xpotato-private-existing-ai-content-audit-response-v1',independentlyExtractedClaims:[],coveredClaimIds:[],materialCoverage:'incomplete',
 findings:[],conclusion:'blocked',limitations:['fixture judgment, no real audit']};
const events=()=>[{type:'thread.started',thread_id:'e7562440-e0bf-42a9-8a90-d66f4e1a4eb8'},{type:'turn.started'},
 {type:'item.completed',item:{type:'agent_message',text:JSON.stringify(response)}},{type:'turn.completed',usage:{input_tokens:1,output_tokens:1}}];
const bytes=(e:unknown[])=>Buffer.from(e.map(v=>JSON.stringify(v)).join('\n'));
describe('fixed Codex audit transport',()=>{
 it('blocks pass without actual reference-page images for figure-bearing content or factual inline plans',()=>{
  const pass={...response,conclusion:'pass',limitations:[]};
  const artifacts=[{artifactId:'audit-evidence',bytes:Buffer.from('{"evidence":[]}')},{artifactId:'audit-body',bytes:Buffer.from('<Figure asset="diagram" alt="Fixed diagram" />')}];
  expect(()=>validateCodexJudgment(pass,{requiredClaimIds:[]},artifacts,'content')).toThrow('RENDER_CONTEXT');
  expect(()=>validateCodexJudgment(response,{requiredClaimIds:[]},artifacts,'content')).not.toThrow();
  expect(()=>validateCodexJudgment(pass,{},[{artifactId:'audit-plan',bytes:Buffer.from('{"visualPlan":{"plans":[{"role":"inline","decorative":false}]}}')}],'visual')).toThrow('RENDER_CONTEXT');
 });
 it.each(['xpotato-operational-codex-audit-v1','xpotato-codex-audit-process-v1','xpotato-fixed-audit-task-v1'])('keeps process proof private: %s',protocol=>{expect(privateDraftOutputErrors('public.json',JSON.stringify({protocol}))).not.toHaveLength(0);});
 it('parses only a complete fresh single-response turn; this parser does not grant trust',()=>{
  expect(parseCodexAuditEvents(bytes(events()),'content').response.conclusion).toBe('blocked');
  expect(hasRecordedAuditProof({protocol:'xpotato-recorded-codex-audit-proof-v1'},response,'a'.repeat(64))).toBe(false);
 });
 it('accepts known pre-turn disabled-capability diagnostics and one bounded progress preamble, preserving one JSON final',()=>{
  const e=events();e.splice(1,0,{type:'item.completed',item:{type:'error',message:'Code Mode is unavailable because code-mode host is disabled. Code mode will fail closed; enable `features.code_mode_host` and install `codex-code-mode-host`.'}} as any);
  e.splice(3,0,{type:'item.completed',item:{type:'agent_message',text:'I will audit the fixed supplied artifacts.'}} as any);
  expect(parseCodexAuditEvents(bytes(e),'content').response.conclusion).toBe('blocked');
  const late=events();late.splice(2,0,e[1] as any);expect(()=>parseCodexAuditEvents(bytes(late),'content')).toThrow('TURN_OR_TOOL');
  const unexpected=events();unexpected.splice(1,0,{type:'item.completed',item:{type:'error',message:'provider connection lost'}} as any);
  expect(()=>parseCodexAuditEvents(bytes(unexpected),'content')).toThrow('TURN_OR_TOOL');
  const oversized=events();oversized.splice(2,0,{type:'item.completed',item:{type:'agent_message',text:'x'.repeat(1025)}} as any);
  expect(()=>parseCodexAuditEvents(bytes(oversized),'content')).toThrow('FINAL_MESSAGE');
 });
 it('binds completed readback to the original unknown and actual receipt/process/input; a bare record mints no proof',()=>{
  const expected={planSha256:'a'.repeat(64),priorResultSha256:'b'.repeat(64),receiptSha256:'c'.repeat(64),processSha256:'d'.repeat(64),invocationSha256:'e'.repeat(64)};
  const record={protocol:'xpotato-private-codex-audit-readback-v1',...expected};
  expect(()=>assertCompletedAuditReadback({...record,recordSha256:fingerprint(record)},expected)).not.toThrow();
  for(const key of Object.keys(expected))expect(()=>assertCompletedAuditReadback({...record,recordSha256:fingerprint(record)},{...expected,[key]:'f'.repeat(64)})).toThrow();
  expect(hasRecordedAuditProof({protocol:'xpotato-recorded-codex-audit-proof-v1'},record,'a'.repeat(64))).toBe(false);
 });
 it.each(['command_execution','mcp_tool_call','web_search','view_image','collab_tool_call'])('rejects actual or attempted model tool activity: %s',type=>{
  const e=events();e.splice(2,0,{type:'item.started',item:{type,text:''}} as any);expect(()=>parseCodexAuditEvents(bytes(e),'content')).toThrow('TURN_OR_TOOL');
 });
 it('rejects failed, partial, duplicated and malformed turns',()=>{
  const e=events();for(const invalid of [e.slice(0,-1),[...e,{type:'turn.failed'}],[...e,e[0]], [...e,e[2]]])expect(()=>parseCodexAuditEvents(bytes(invalid),'content')).toThrow();
  expect(()=>parseCodexAuditEvents(Buffer.from('{'),'content')).toThrow();
 });
 it('does not accept a standalone agent observation or a forged proof object',async()=>{
  await expect(readRecordedAuditProof('/unused',{scope:'existing_ai',reviewer:{execution:{contextRef:'codex-thread:fixture'}}},{},'content')).rejects.toThrow('TRUSTED_EXECUTION_REQUIRED');
  expect(await readRecordedAuditProof('/unused',{scope:'human_local'},{},'content')).toBeUndefined();
 });
 it('enforces the declared final response limit',()=>{expect(()=>parseCodexAuditEvents(bytes(events()),'content',10)).toThrow('RESPONSE_LIMIT');});
 it('binds a stage grant to exact Job, target, destination and physical inventory; same intake cannot admit another private source',()=>{
  const inventory=[{artifactId:'audit-body',sha256:'a'.repeat(64),sizeBytes:10}],expected={protocol:'xpotato-private-existing-audit-disclosure-grant-v1' as const,
   jobId:'job-fixture',attemptId:'attempt-fixture',contentId:'e7562440-e0bf-42a9-8a90-d66f4e1a4eb8',intakeSha256:'b'.repeat(64),inputSha256:'c'.repeat(64),targetRequestSha256:'d'.repeat(64),
   destination:'openai-existing-chatgpt-codex-cli' as const,stage:'content_audit' as const,inventory,inventorySha256:fingerprint(inventory)};
  const grant={...expected,authorizedBy:'user'};expect(()=>assertGrantInventory(grant,expected)).not.toThrow();
  const other=[{...inventory[0]!,sha256:'f'.repeat(64)}];
  for(const patch of [{jobId:'job-other'},{stage:'visual_audit'},{targetRequestSha256:'e'.repeat(64)},{inventory:other,inventorySha256:fingerprint(other)},{destination:'another-provider'}])
   expect(()=>assertGrantInventory({...grant,...patch},expected)).toThrow();
 });
 it.each(['password','api_token','api_key','Authorization','Cookie','Set-Cookie'])('hard denies quoted credential/header keys before execution: %s',key=>{
  expect(containsHardDenyMaterial(Buffer.from(JSON.stringify({[key]:'harmless-marker'})))).toBe(true);
 });
 it('requires every real image/body/evidence byte and rejects extra or substituted physical inputs',()=>{
  const materials={'audit-body':Buffer.from('fixed body'),'audit-image-hero':Buffer.from('fixed image')};
  const all=Object.entries(materials).map(([artifactId,bytes])=>({artifactId,bytes,sha256:sha256(bytes)}));
  expect(()=>assertExistingAuditPhysicalSet(all,materials)).not.toThrow();
  expect(()=>assertExistingAuditPhysicalSet(all.slice(0,1),materials)).toThrow('PHYSICAL_SET');
  expect(()=>assertExistingAuditPhysicalSet([...all,{...all[0]!,artifactId:'extra'}],materials)).toThrow('PHYSICAL_SET');
  expect(()=>assertExistingAuditPhysicalSet(all.map(a=>({...a,bytes:Buffer.from('replacement')})),materials)).toThrow('PHYSICAL_SET');
 });
 it('rejects empty independent extraction, stale spans, unknown evidence and unresolved pass',()=>{
  const artifacts=[{artifactId:'audit-body',bytes:Buffer.from('Fixed fact.')},{artifactId:'audit-evidence',bytes:Buffer.from('{"evidence":[{"evidenceId":"e1"}]}')}];
  const good={...response,conclusion:'pass',limitations:[],independentlyExtractedClaims:[{text:'Fixed fact.',span:{start:0,end:11},evidenceIds:['e1']}]};
  expect(()=>validateCodexJudgment(good,{requiredClaimIds:['c1']},artifacts,'content')).not.toThrow();
  expect(()=>validateCodexJudgment({...good,independentlyExtractedClaims:[]},{requiredClaimIds:['c1']},artifacts,'content')).toThrow('INDEPENDENT_EXTRACTION');
  expect(()=>validateCodexJudgment({...good,limitations:['missing']},{requiredClaimIds:['c1']},artifacts,'content')).toThrow('LIMITATIONS');
  for(const change of [{text:'changed'},{evidenceIds:['unknown']},{evidenceIds:[]}])expect(()=>validateCodexJudgment({...good,independentlyExtractedClaims:[{...good.independentlyExtractedClaims[0],...change}]},{requiredClaimIds:['c1']},artifacts,'content')).toThrow();
 });
 it('rechecks unknown under the journal lock after an earlier unlocked scan',async()=>{
  const root=await mkdtemp(join(tmpdir(),'audit-unknown-'));
  try{
   const journal=new RuntimeOperationJournal(root,{jobId:'job-fixture',jobFingerprint:'a'.repeat(64)},{total:3,perStage:{content_audit:3}}),binding={attemptId:'attempt-fixture',stage:'content_audit',inputSha256:'b'.repeat(64)};
   await assertNoUncertainAudit(journal,binding);
   const first={...binding,operationId:'audit-first',kind:'semantic' as const,contextSha256:'c'.repeat(64)};
   expect((await journal.run(first,{timeoutMs:1000,preflight:()=>{},execute:async()=>{throw Error('fixture unknown');}})).state).toBe('unknown');
   let executed=false;
   await expect(journal.run({...first,operationId:'audit-second'},{timeoutMs:1000,preflight:()=>assertNoUncertainAudit(journal,binding),execute:async()=>{executed=true;return {outputSha256:'d'.repeat(64)};}})).rejects.toThrow('PREFLIGHT_REJECTED');
   expect(executed).toBe(false);expect(await readdir(root)).not.toContain('audit-second');
  }finally{await rm(root,{recursive:true,force:true});}
 });
 it('waits for an actual owned child to close after cancellation',async()=>{
  const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
  const result=await controlAuditChild(child,{timeoutMs:1000,cancelled:()=>true}).result;
  expect(result.stopped).toBe(true);expect(result.containmentFailed).toBe(false);expect(child.exitCode!==null||child.signalCode!==null).toBe(true);
 });
 it('bounds an unconfirmed stop and reports containment failure rather than completion',async()=>{
  let stdinClosed=false;const child=Object.assign(new EventEmitter(),{pid:123,exitCode:null,kill:()=>false,unref:()=>{},stdin:{destroy:()=>{stdinClosed=true;}},stdout:{destroy:()=>{}},stderr:{destroy:()=>{}}});
  const result=await controlAuditChild(child as any,{timeoutMs:100,cancelled:()=>true,stopGraceMs:30}).result;
  expect(result).toEqual({exitCode:null,stopped:true,containmentFailed:true});
  expect(stdinClosed).toBe(true);
 });
});
