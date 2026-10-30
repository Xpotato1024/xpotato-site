import {it,expect,vi} from "vitest";
import {mkdtemp,readFile,writeFile,mkdir} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {RuntimeOperationJournal,type RuntimeOperationPlan} from "./runtime-journal.js";
const hash="a".repeat(64),job={jobId:"job-1",jobFingerprint:hash};
const plan:RuntimeOperationPlan={operationId:"call-1",kind:"semantic",stage:"author",attemptId:"attempt-1",inputSha256:hash,contextSha256:hash};
async function setup(total=2){const directory=await mkdtemp(join(tmpdir(),"runtime-journal-"));return new RuntimeOperationJournal(directory,job,{total,perStage:{author:total}});}
it("persists intent before execution, reuses one verified operation after restart and rechecks preflight",async()=>{
 const j=await setup(),preflight=vi.fn(),execute=vi.fn(async()=>{expect(JSON.parse(await readFile(join(j.directory,"call-1/intent.json"),"utf8"))).toEqual(plan);return {outputSha256:hash};});
 expect(await j.run(plan,{timeoutMs:1000,preflight,execute})).toMatchObject({state:"verified",reused:false,productionEligible:false});
 const resumed=new RuntimeOperationJournal(j.directory,job,j.limits);
 expect(await resumed.run(plan,{timeoutMs:1000,preflight,execute})).toMatchObject({state:"verified",reused:true});
 expect(execute).toHaveBeenCalledTimes(1);expect(preflight).toHaveBeenCalledTimes(2);
 await expect(resumed.run(plan,{timeoutMs:1000,preflight:()=>{throw Error("revoked");},execute})).rejects.toThrow("revoked");
});
it("keeps uncertain results and pending crashes, never resending or leaking provider errors",async()=>{
 const j=await setup(),execute=vi.fn(async()=>{throw Error("Authorization: fixture-secret-not-real");});
 expect(await j.run(plan,{timeoutMs:1000,preflight:()=>{},execute})).toMatchObject({state:"unknown",outputSha256:null});
 expect(await readFile(join(j.directory,"call-1/result.json"),"utf8")).not.toContain("Authorization");
 await expect(j.run(plan,{timeoutMs:1000,preflight:()=>{},execute})).rejects.toThrow("NO_RESEND");expect(execute).toHaveBeenCalledTimes(1);
 await mkdir(join(j.directory,"call-2"));await writeFile(join(j.directory,"call-2/intent.json"),JSON.stringify({...plan,operationId:"call-2"}));
 await expect(j.run({...plan,operationId:"call-2"},{timeoutMs:1000,preflight:()=>{},execute})).rejects.toThrow("NO_RESEND");
 await expect(j.run({...plan,contextSha256:"b".repeat(64)},{timeoutMs:1000,preflight:()=>{},execute})).rejects.toThrow("CONFLICT");
});
it("bounds a hung call, propagates abort and does not promote late completion",async()=>{
 const j=await setup();let finish:((x:{outputSha256:string})=>void)|undefined,signal:AbortSignal|undefined;
 const result=await j.run(plan,{timeoutMs:15,preflight:()=>{},execute:s=>{signal=s;return new Promise(resolve=>{finish=resolve;});}});
 expect(result.state).toBe("unknown");expect(signal?.aborted).toBe(true);finish?.({outputSha256:hash});await Promise.resolve();
 expect((await j.inspect(plan)).state).toBe("unknown");
 const c=new AbortController();c.abort();const execute=vi.fn();await expect(j.run({...plan,operationId:"call-2"},{timeoutMs:1000,signal:c.signal,preflight:()=>{},execute})).rejects.toThrow();expect(execute).not.toHaveBeenCalled();
});
it("counts attempted operations against immutable budgets and rejects altered result bytes",async()=>{
 const j=await setup(1),execute=vi.fn(async()=>({outputSha256:hash}));await j.run(plan,{timeoutMs:1000,preflight:()=>{},execute});
 await expect(j.run({...plan,operationId:"call-2"},{timeoutMs:1000,preflight:()=>{},execute})).rejects.toThrow("BUDGET");
 const altered=new RuntimeOperationJournal(j.directory,job,{total:2,perStage:{author:2}});await expect(altered.inspect(plan)).rejects.toThrow();
 const p=join(j.directory,"call-1/result.json"),r=JSON.parse(await readFile(p,"utf8"));r.outputSha256="b".repeat(64);await writeFile(p,JSON.stringify(r));await expect(j.inspect(plan)).rejects.toThrow("CONFLICT");expect(execute).toHaveBeenCalledTimes(1);
});
it("bounds a hung read-only preflight without creating an intent or executing later",async()=>{
 const j=await setup(),execute=vi.fn(async()=>({outputSha256:hash}));let finish:(()=>void)|undefined;
 await expect(j.run(plan,{timeoutMs:15,preflight:()=>new Promise<void>(resolve=>{finish=resolve;}),execute})).rejects.toThrow("DEADLINE");
 finish?.();await Promise.resolve();expect(execute).not.toHaveBeenCalled();expect((await j.inspect(plan)).state).toBe("absent");
});
