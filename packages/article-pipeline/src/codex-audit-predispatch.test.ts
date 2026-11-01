import {describe,it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {codexConfigRejectedBeforeDispatch} from './codex-audit-predispatch.js';
import {fingerprint,sha256} from './canonical.js';
import {privateDraftOutputErrors} from '@xpotato/portable-content/private-output';
const fixture=()=>{
 const profile={executable:'C:\\dummy\\codex.exe',executableSha256:'a'.repeat(64),nativeNode:'C:\\dummy\\node.exe',model:'gpt-6.1-sol' as const,transport:'existing-chatgpt-codex-cli-v1' as const};
 const snapshot={request:{requestId:'fixture',stage:'content_audit'},profile:{freshContext:true}},prompt='dummy fixed prompt',schema='{}';
 const plan={operationId:'audit-fixture',stage:'content_audit',contextSha256:fingerprint({request:snapshot.request,profile:snapshot.profile,transport:profile})};
 const stdout=Buffer.alloc(0),stderr=Buffer.from('Error loading config.toml: unknown configuration field `tools.view_image` in -c/--config override\n');
 const processInput={protocol:'xpotato-codex-audit-process-v1',executable:profile.executable,executableSha256:profile.executableSha256,model:profile.model,prompt,schema,images:[]};
 const processRecord={protocol:processInput.protocol,executableSha256:profile.executableSha256,model:profile.model,exitCode:1,stopped:false,containmentFailed:false,
  freshContext:true,toolPolicy:'no-shell-apps-web-image-tools-v1',processId:123,startedAt:'2026-01-01T00:00:00Z',finishedAt:'2026-01-01T00:00:00.100Z',
  stdoutSha256:sha256(stdout),stderrSha256:sha256(stderr),promptSha256:sha256(prompt),schemaSha256:sha256(schema),imageSha256s:[]};
 return {plan,prior:{state:'unknown',planSha256:fingerprint(plan),resultSha256:'b'.repeat(64)},snapshot,profile,processInput,processRecord,stdout,stderr,prompt,schemaSha256:sha256(schema)};
};
describe('definite local config rejection before audit dispatch',()=>{
 it('records a distinct private observation without changing unknown into verified',()=>{
  const input=fixture(),r=codexConfigRejectedBeforeDispatch(input);
  expect(r.modelInvoked).toBe(false);expect(r.formalReceipt).toBe(false);expect(input.prior.state).toBe('unknown');
  expect(privateDraftOutputErrors('public.json',JSON.stringify(r))).not.toHaveLength(0);
 });
 it('does not classify network/auth errors, partial turns, timeouts, missing/changed hashes or another plan',()=>{
  for(const modify of [
   (f:ReturnType<typeof fixture>)=>{f.processRecord.exitCode=0;},
   (f:ReturnType<typeof fixture>)=>{f.stdout=Buffer.from('{"type":"thread.started"}');f.processRecord.stdoutSha256=sha256(f.stdout);},
   (f:ReturnType<typeof fixture>)=>{f.stderr=Buffer.from('network timeout');f.processRecord.stderrSha256=sha256(f.stderr);},
   (f:ReturnType<typeof fixture>)=>{f.processRecord.stopped=true;},
   (f:ReturnType<typeof fixture>)=>{f.processRecord.containmentFailed=true;},
   (f:ReturnType<typeof fixture>)=>{f.processRecord.stderrSha256='f'.repeat(64);},
   (f:ReturnType<typeof fixture>)=>{f.processInput.prompt='changed';},
   (f:ReturnType<typeof fixture>)=>{f.processRecord.executableSha256='f'.repeat(64);},
   (f:ReturnType<typeof fixture>)=>{f.plan.operationId='audit-other';},
   (f:ReturnType<typeof fixture>)=>{f.processRecord.finishedAt='2026-01-01T00:01:00Z';},
   (f:ReturnType<typeof fixture>)=>{f.prior.state='pending';},
  ]){const f=fixture();modify(f);expect(()=>codexConfigRejectedBeforeDispatch(f)).toThrow('PREDISPATCH_NOT_PROVEN');}
 });
 it('keeps supported image-tool disablement and strict config without the unsupported legacy field',async()=>{
  const text=await readFile(new URL('./codex-audit-process.mjs',import.meta.url),'utf8');
  expect(text).not.toContain('tools.view_image=false');expect(text).toContain("'view_image'");
  expect(text).toContain("'--strict-config'");expect(text).not.toContain('--ignore-rules');expect(text).not.toContain('--dangerously');
 });
});
