import {it,expect,vi} from 'vitest';
import {mkdtemp,readFile,writeFile,readdir} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {RuntimeOperationJournal,type RuntimeOperationPlan} from './runtime-journal.js';import {fingerprint} from './canonical.js';
const hash='a'.repeat(64),job={jobId:'job-1',jobFingerprint:hash},plan:RuntimeOperationPlan={operationId:'call-1',kind:'semantic',stage:'author',attemptId:'attempt-1',inputSha256:hash,contextSha256:hash};
async function setup(){const j=new RuntimeOperationJournal(await mkdtemp(join(tmpdir(),'runtime-recovery-')),job,{total:1,perStage:{author:1}});await j.run(plan,{timeoutMs:1000,preflight:()=>{},execute:async()=>{throw Error('transport lost');}});return j;}
const observation=()=>({planSha256:fingerprint(plan),status:'verified' as const,outputSha256:hash,readbackSha256:hash,observedAt:new Date().toISOString()});
const options=(readback=async()=>observation())=>({scope:'test_fixture' as const,recoveryId:'read-1',timeoutMs:1000,preflight:vi.fn(),readback:vi.fn(readback)});

it('appends a restart-safe readback record without changing unknown evidence or permitting resends',async()=>{
 const j=await setup(),path=join(j.directory,'call-1/result.json'),before=await readFile(path,'utf8'),o=options();
 const record=await j.reconcile(plan,o);expect(record).toMatchObject({status:'verified',outputSha256:hash,priorState:'unknown',scope:'test_fixture',productionEligible:false,formalReceipt:false});expect(o.preflight).toHaveBeenCalledTimes(2);
 const resumed=new RuntimeOperationJournal(j.directory,job,j.limits);expect(await resumed.inspectRecovery(plan,'read-1')).toEqual(record);expect((await resumed.inspect(plan)).state).toBe('unknown');expect(await readFile(path,'utf8')).toBe(before);
 const execute=vi.fn();await expect(resumed.run(plan,{timeoutMs:1000,preflight:()=>{},execute})).rejects.toThrow('NO_RESEND');expect(execute).not.toHaveBeenCalled();
 await expect(resumed.reconcile(plan,o)).rejects.toThrow('ALREADY_RECORDED');expect(o.readback).toHaveBeenCalledTimes(1);
});

it('does not invoke recovery callbacks for live scope, absent or already verified operations',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'runtime-recovery-gate-')),j=new RuntimeOperationJournal(directory,job,{total:1,perStage:{author:1}}),o=options();
 await expect(j.reconcile(plan,{...o,scope:'operator_runtime'})).rejects.toThrow('LIVE_ACTIVATION');expect(await readdir(directory)).toEqual([]);
 await expect(j.reconcile(plan,o)).rejects.toThrow('NOT_UNCERTAIN');await j.run(plan,{timeoutMs:1000,preflight:()=>{},execute:async()=>({outputSha256:hash})});
 await expect(j.reconcile(plan,o)).rejects.toThrow('NOT_UNCERTAIN');expect(o.readback).not.toHaveBeenCalled();expect(o.preflight).not.toHaveBeenCalled();
});

it('rejects stale, future and cross-plan evidence without recording it as a successful observation',async()=>{
 for(const changed of [{observedAt:'2026-01-01T00:00:00Z'},{observedAt:'2099-01-01T00:00:00Z'},{planSha256:'b'.repeat(64)}]){
  const j=await setup(),record=await j.reconcile(plan,options(async()=>({...observation(),...changed})));
  expect(record).toMatchObject({status:'unknown',outputSha256:null,readbackSha256:null,observedAt:null});
 }
});

it('retains negative observations and bounds recovery attempts without renewing the execution budget',async()=>{
 const j=await setup();
 for(const [i,status]of ['absent','conflict','unknown'].entries())expect(await j.reconcile(plan,{...options(),recoveryId:'read-'+i,readback:async()=>({...observation(),status:status as 'absent'|'conflict'|'unknown',outputSha256:null})})).toMatchObject({status,outputSha256:null});
 const o=options();await expect(j.reconcile(plan,{...o,recoveryId:'read-4'})).rejects.toThrow('BUDGET_EXHAUSTED');expect(o.readback).not.toHaveBeenCalled();
 await expect(j.run({...plan,operationId:'call-2'},{timeoutMs:1000,preflight:()=>{},execute:vi.fn()})).rejects.toThrow('BUDGET_EXHAUSTED');
});

it('preserves uncertainty on timeout or revoked postflight and never persists raw callback errors',async()=>{
 const j=await setup();let finish:(()=>void)|undefined;const record=await j.reconcile(plan,{...options(),timeoutMs:15,readback:()=>new Promise(resolve=>{finish=()=>resolve(observation());})});
 expect(record.status).toBe('unknown');finish?.();await Promise.resolve();expect((await j.inspectRecovery(plan,'read-1'))?.status).toBe('unknown');
 const o=options();o.preflight.mockImplementationOnce(()=>{}).mockImplementationOnce(()=>{throw Error('Authorization: inert-fixture-secret');});
 const next=await j.reconcile(plan,{...o,recoveryId:'read-2'});expect(next).toMatchObject({status:'unknown',readbackSha256:null});expect(await readFile(join(j.directory,'call-1/recovery-read-2.json'),'utf8')).not.toContain('Authorization');
});

it('does not perform readback when preflight is denied or cancelled',async()=>{
 const j=await setup(),o=options();o.preflight.mockImplementation(()=>{throw Error('denied');});await expect(j.reconcile(plan,o)).rejects.toThrow('PREFLIGHT_REJECTED');
 const c=new AbortController();c.abort();await expect(j.reconcile(plan,{...o,signal:c.signal})).rejects.toThrow('PREFLIGHT_REJECTED');expect(o.readback).not.toHaveBeenCalled();expect(await j.inspectRecovery(plan,'read-1')).toBe(null);
});

it('detects an altered operation or stored recovery record instead of reusing stale evidence',async()=>{
 const j=await setup(),record=await j.reconcile(plan,options()),path=join(j.directory,'call-1/recovery-read-1.json');
 await expect(j.inspectRecovery({...plan,contextSha256:'b'.repeat(64)},'read-1')).rejects.toThrow('CONFLICT');
 await writeFile(path,JSON.stringify({...record,outputSha256:'b'.repeat(64)}));await expect(j.inspectRecovery(plan,'read-1')).rejects.toThrow('CONFLICT');
 const k=await setup();await expect(k.reconcile(plan,options(async()=>{const p=join(k.directory,'call-1/result.json'),r=JSON.parse(await readFile(p,'utf8'));r.outputSha256=hash;await writeFile(p,JSON.stringify(r));return observation();}))).rejects.toThrow();expect(await readdir(join(k.directory,'call-1'))).not.toContain('recovery-read-1.json');
});
