import {mkdir,readdir} from "node:fs/promises";
import {join} from "node:path";
import {z} from "zod";
import {sha256Schema,stableIdSchema} from "@xpotato/content-contracts";
import {canonicalJson,fingerprint} from "./canonical.js";
import {immutable,locked,noLinks,safeRead} from "./private-files.js";
import {runtimeDeadline} from "./runtime-deadline.js";

const planSchema=z.object({operationId:stableIdSchema.max(120),kind:z.enum(["semantic","media"]),stage:z.string().regex(/^[a-z]+(?:_[a-z]+)*$/u),
 attemptId:stableIdSchema,inputSha256:sha256Schema,contextSha256:sha256Schema}).strict();
const resultSchema=z.object({protocol:z.literal("xpotato-runtime-result-v1"),planSha256:sha256Schema,
 state:z.enum(["verified","unknown"]),outputSha256:sha256Schema.nullable(),productionEligible:z.literal(false),resultSha256:sha256Schema}).strict()
 .refine(x=>(x.state==="verified")===(x.outputSha256!==null));
export type RuntimeOperationPlan=z.infer<typeof planSchema>;
type Result=z.infer<typeof resultSchema>;
export type RuntimeJournalLimits={total:number;perStage:Readonly<Record<string,number>>};
const missing=(error:unknown)=>(error as NodeJS.ErrnoException).code==="ENOENT";

/** Transport-side evidence only. Never writes an Article Job state, approval,
 * storage receipt or canonical content. Unknown/pending operations cannot be
 * resent through this API, including after process restart.
 */
export class RuntimeOperationJournal{
 constructor(readonly directory:string,readonly job:{jobId:string;jobFingerprint:string},readonly limits:RuntimeJournalLimits){}
 private async initialize(){
  stableIdSchema.parse(this.job.jobId);sha256Schema.parse(this.job.jobFingerprint);
  if(!Number.isSafeInteger(this.limits.total)||this.limits.total<1||this.limits.total>1536
   ||Object.entries(this.limits.perStage).some(([s,n])=>!/^[a-z]+(?:_[a-z]+)*$/u.test(s)||!Number.isSafeInteger(n)||n<1||n>this.limits.total))throw Error("RUNTIME_LIMITS_INVALID");
  await noLinks(this.directory);await mkdir(this.directory,{recursive:true,mode:0o700});
  await immutable(join(this.directory,"binding.json"),canonicalJson({protocol:"xpotato-runtime-journal-v1",job:this.job,limits:this.limits})+"\n");
 }
 async inspect(input:RuntimeOperationPlan):Promise<{state:"absent"|"pending"}|Result>{
  const plan=planSchema.parse(input);await this.initialize();
  const folder=join(this.directory,plan.operationId),hash=fingerprint(plan);
  try{const saved=JSON.parse(await safeRead(join(folder,"intent.json")));if(fingerprint(saved)!==hash)throw Error("RUNTIME_OPERATION_CONFLICT");}
  catch(error){if(missing(error))return {state:"absent"};throw error;}
  try{const result=resultSchema.parse(JSON.parse(await safeRead(join(folder,"result.json"))));const {resultSha256,...body}=result;if(result.planSha256!==hash||fingerprint(body)!==resultSha256)throw Error("RUNTIME_RESULT_CONFLICT");return result;}
  catch(error){if(missing(error))return {state:"pending"};throw error;}
 }
 async run(input:RuntimeOperationPlan,options:{timeoutMs:number;signal?:AbortSignal|undefined;
  preflight:(signal:AbortSignal)=>void|Promise<void>;execute:(signal:AbortSignal)=>Promise<{outputSha256:string}>}):Promise<Result&{reused:boolean}>{
  const plan=planSchema.parse(input);
  if(!Number.isSafeInteger(options.timeoutMs)||options.timeoutMs<1||options.timeoutMs>240000)throw Error("RUNTIME_DEADLINE_INVALID");
  await this.initialize();
  return locked(this.directory,async()=>{
   options.signal?.throwIfAborted();await runtimeDeadline(Math.min(10000,options.timeoutMs),options.signal,async signal=>{await options.preflight(signal);});options.signal?.throwIfAborted();
   const prior=await this.inspect(plan);
   if(prior.state==="verified")return {...prior,reused:true};
   if(prior.state!=="absent")throw Error("RUNTIME_READBACK_REQUIRED_NO_RESEND");
   const intents:RuntimeOperationPlan[]=[];
   const entries=await readdir(this.directory,{withFileTypes:true});if(entries.length>this.limits.total+2)throw Error("RUNTIME_JOURNAL_MEMBER_INVALID");
   for(const entry of entries){
    if(entry.name==="binding.json"||entry.name===".lock")continue;
    if(!entry.isDirectory()||!stableIdSchema.safeParse(entry.name).success)throw Error("RUNTIME_JOURNAL_MEMBER_INVALID");
    intents.push(planSchema.parse(JSON.parse(await safeRead(join(this.directory,entry.name,"intent.json")))));
   }
   const stageLimit=this.limits.perStage[plan.stage];
   if(stageLimit===undefined||intents.length>=this.limits.total||intents.filter(x=>x.stage===plan.stage).length>=stageLimit)throw Error("RUNTIME_BUDGET_EXHAUSTED");
   const folder=join(this.directory,plan.operationId);await noLinks(folder);await mkdir(folder,{mode:0o700});
   await immutable(join(folder,"intent.json"),canonicalJson(plan)+"\n");
   const control=new AbortController(),abort=()=>control.abort();options.signal?.addEventListener("abort",abort,{once:true});
   let timer:ReturnType<typeof setTimeout>|undefined,stop:(()=>void)|undefined;
   const expired=new Promise<never>((_,reject)=>{
    stop=()=>reject(Error("RUNTIME_OPERATION_ABORTED"));control.signal.addEventListener("abort",stop,{once:true});
    timer=setTimeout(abort,options.timeoutMs);if(options.signal?.aborted)abort();
   });
   let result:Result;
   try{
    const response=await Promise.race([Promise.resolve().then(()=>{control.signal.throwIfAborted();return options.execute(control.signal);}),expired]);control.signal.throwIfAborted();
    const body={protocol:"xpotato-runtime-result-v1" as const,planSha256:fingerprint(plan),state:"verified" as const,outputSha256:sha256Schema.parse(response.outputSha256),productionEligible:false as const};
    result=resultSchema.parse({...body,resultSha256:fingerprint(body)});
   }catch{
    // No raw provider/locator exception is persisted. A write/run may have
    // happened even if transport failed; unknown is never absence or failure.
    const body={protocol:"xpotato-runtime-result-v1" as const,planSha256:fingerprint(plan),state:"unknown" as const,outputSha256:null,productionEligible:false as const};
    result={...body,resultSha256:fingerprint(body)};
   }finally{clearTimeout(timer);if(stop)control.signal.removeEventListener("abort",stop);options.signal?.removeEventListener("abort",abort);}
   await immutable(join(folder,"result.json"),canonicalJson(result)+"\n");return {...result,reused:false};
  });
 }
}
