import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {z} from 'zod';
import {existingAiContentAuditResponseSchema,existingAiVisualAuditResponseSchema,compactAiRunRefSchema} from '@xpotato/content-contracts';
import {articleMediaReferences} from '@xpotato/portable-content/media';
import {canonicalJson,fingerprint,sha256} from './canonical.js';
import {containsHardDenyMaterial} from './disclosure.js';
import {safeRead,safeReadBytes,immutable,immutableBytes,noLinks} from './private-files.js';
import {prepareSemanticInvocation,semanticRuntimeLimits} from './semantic-runtime.js';
import {RuntimeOperationJournal} from './runtime-journal.js';
import {readDraftStore} from './draft-job.js';
import type {prepareExistingAuditInvocation} from './existing-audit-invocation.js';
import {requiredExistingAuditMaterial,assertExistingAuditPhysicalSet,fixedAuditInstruction,assertExistingAuditDisclosureGrant} from './existing-audit-material.js';
export type ExistingAuditInvocationInput=Parameters<typeof prepareExistingAuditInvocation>[0];

const proofs=new WeakMap<object,{auditSha256:string;requestSha256:string;lineage:z.infer<typeof compactAiRunRefSchema>}>();
export type RecordedAuditProof=Readonly<{protocol:'xpotato-recorded-codex-audit-proof-v1'}>;
export const hasRecordedAuditProof=(proof:RecordedAuditProof|undefined,audit:unknown,requestSha256:string)=>
 Boolean(proof&&proofs.get(proof)?.auditSha256===fingerprint(audit)&&proofs.get(proof)?.requestSha256===requestSha256);
const hash=z.string().regex(/^[a-f0-9]{64}$/u);
const profileSchema=z.object({executable:z.string().min(1),executableSha256:hash,nativeNode:z.string().min(1),
 model:z.literal('gpt-6.1-sol'),transport:z.literal('existing-chatgpt-codex-cli-v1')}).strict();
export type CodexAuditProfile=z.infer<typeof profileSchema>;
const nativePath=(path:string)=>process.platform==='win32'?resolve(path):/^\/mnt\/[a-z]\//u.test(path)?path[5]!.toUpperCase()+':\\'+path.slice(7).replaceAll('/','\\'):(()=>{throw Error('CODEX_NATIVE_PATH_REQUIRED');})();
const localPath=(path:string)=>process.platform==='win32'?path:/^[A-Za-z]:\\/u.test(path)?'/mnt/'+path[0]!.toLowerCase()+'/'+path.slice(3).replaceAll('\\','/'):path;

/** Reject tool activity, partial/failed turns and extra messages. The model
 * supplies judgments only; process/thread identity is taken from CLI events. */
export function parseCodexAuditEvents(bytes:Uint8Array,stage:'content'|'visual',maxOutputBytes=4*1024*1024){
 if(containsHardDenyMaterial(bytes))throw Error('CODEX_AUDIT_SECRET_RESPONSE');
 const events=new TextDecoder('utf-8',{fatal:true}).decode(bytes).trim().split('\n').map(line=>JSON.parse(line));
 const threads=events.filter(e=>e.type==='thread.started'),turns=events.filter(e=>e.type==='turn.completed');
 const allowed=new Set(['thread.started','turn.started','turn.completed','item.started','item.completed']);
 const start=events.findIndex(e=>e.type==='turn.started');
 const startupError=(e:any,index:number)=>e.type==='item.completed'&&e.item?.type==='error'&&index<start&&(
  /^Under-development features enabled: skip_host_skill_discovery\. Under-development features are incomplete and may behave unpredictably\. To suppress this warning, set `suppress_unstable_features_warning = true` in [^\r\n]+config\.toml\.$/u.test(e.item.message??'')
  ||e.item.message==='Code Mode is unavailable because code-mode host is disabled. Code mode will fail closed; enable `features.code_mode_host` and install `codex-code-mode-host`.');
 if(threads.length!==1||turns.length!==1||events.filter(e=>e.type==='turn.started').length!==1
  ||!z.uuid().safeParse(threads[0].thread_id).success||events.filter(startupError).length>2
  ||events.some((e,i)=>!allowed.has(e.type)
   ||e.type.startsWith('item.')&&!['reasoning','agent_message'].includes(e.item?.type)&&!startupError(e,i)))throw Error('CODEX_AUDIT_TURN_OR_TOOL_INVALID');
 const messages=events.filter(e=>e.type==='item.completed'&&e.item?.type==='agent_message');
 // Native CLI serializes a brief progress preamble as agent_message too. It
 // is not an extra final: permit at most one leading bounded non-JSON message,
 // then exactly one schema-valid JSON final. Never accept another JSON final.
 if(messages.length<1||messages.length>2)throw Error('CODEX_AUDIT_FINAL_MESSAGE_REQUIRED');
 if(messages.length===2){const preamble=messages[0].item.text;
  if(Buffer.byteLength(preamble)>1024)throw Error('CODEX_AUDIT_FINAL_MESSAGE_REQUIRED');
  let parsed=false;try{JSON.parse(preamble);parsed=true;}catch{}if(parsed)throw Error('CODEX_AUDIT_FINAL_MESSAGE_REQUIRED');
 }
 const final=messages.at(-1)!.item.text;
 if(Buffer.byteLength(final)>maxOutputBytes)throw Error('CODEX_AUDIT_RESPONSE_LIMIT');
 const response=(stage==='content'?existingAiContentAuditResponseSchema:existingAiVisualAuditResponseSchema).parse(JSON.parse(final));
 return {contextRef:'codex-thread:'+threads[0].thread_id,response,usage:turns[0].usage??null};
}
const folderFor=(directory:string,attempt:string,request:string)=>join(directory,'attempts',attempt,'agent-runs',request);
const stageFor=(stage:string)=>stage==='content_audit'?'content' as const:stage==='visual_audit'?'visual' as const:(()=>{throw Error('CODEX_AUDIT_STAGE_INVALID');})();
export async function assertNoUncertainAudit(journal:RuntimeOperationJournal,binding:{attemptId:string;stage:string;inputSha256:string},context?:{directory:string;profile:CodexAuditProfile}){
 const {readdir}=await import('node:fs/promises');let names:string[]=[];
 try{names=await readdir(journal.directory);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 for(const name of names.filter(n=>n.startsWith('audit-'))){
  const prior=JSON.parse(await safeRead(join(journal.directory,name,'intent.json')));
  if(prior.attemptId===binding.attemptId&&prior.stage===binding.stage&&prior.inputSha256===binding.inputSha256){
   const state=await journal.inspect(prior);
   if(state.state==='unknown'&&context&&await recordDefiniteConfigRejection(journal,prior,state,context))continue;
   if(state.state==='pending'||state.state==='unknown')throw Error('CODEX_AUDIT_PRIOR_UNKNOWN_READBACK_REQUIRED');
  }
 }
}
async function recordDefiniteConfigRejection(journal:RuntimeOperationJournal,plan:any,prior:any,context:{directory:string;profile:CodexAuditProfile}){
 try{
  const {readdir}=await import('node:fs/promises'),root=join(context.directory,'attempts',plan.attemptId,'agent-runs');
  const names=await readdir(root);if(names.length>15)return false;
  for(const name of names){
   if(!hash.safeParse(name).success)return false;
   const folder=join(root,name),snapshot=JSON.parse(await safeRead(join(folder,'invocation.json'),24*1024*1024));
   if('audit-'+snapshot.request.requestId!==plan.operationId)continue;
   if(snapshot.request.requestSha256!==name||fingerprint(snapshot.spec)!==journal.job.jobFingerprint)return false;
   const decoded=decodeSnapshot(snapshot),stage=stageFor(plan.stage),schema=stage==='content'?existingAiContentAuditResponseSchema:existingAiVisualAuditResponseSchema;
   const {semanticResponseContract}=await import('./semantic-runtime.js');
   const prepared=prepareSemanticInvocation({...decoded,contract:semanticResponseContract<unknown>(snapshot.contract.schemaId,schema)});
   const target=JSON.parse(new TextDecoder().decode(prepared.artifacts.find(a=>a.artifactId==='audit-target')!.bytes));
   if(target.attemptId!==plan.attemptId||target.inputSha256!==plan.inputSha256||target.jobId!==journal.job.jobId)return false;
   const required=await requiredExistingAuditMaterial(context.directory,target,stage);
   assertExistingAuditPhysicalSet(prepared.artifacts,required.materials);await assertExistingAuditDisclosureGrant(context.directory,stage);
   if(sha256(await safeReadBytes(localPath(context.profile.executable),512*1024*1024))!==context.profile.executableSha256)return false;
   const processInput=JSON.parse(await safeRead(join(folder,'process-input.json'),24*1024*1024)),processRecord=JSON.parse(await safeRead(join(folder,'process/process.json')));
   const stdout=await safeReadBytes(join(folder,'process/stdout.jsonl'),4*1024*1024),stderr=await safeReadBytes(join(folder,'process/stderr.txt'),65536);
   const {codexConfigRejectedBeforeDispatch}=await import('./codex-audit-predispatch.js');
   const record=codexConfigRejectedBeforeDispatch({plan,prior,snapshot,profile:context.profile,processInput,processRecord,stdout,stderr,prompt:promptFor(prepared),schemaSha256:prepared.contract.sha256});
   await immutable(join(journal.directory,plan.operationId,'codex-predispatch.json'),canonicalJson(record)+'\n');return true;
  }
 }catch{/* Incomplete, changed or non-local failures remain uncertain. */}
 return false;
}
const projectAudit=(target:any,response:any,contextRef:string,finishedAt:string,receiptSha256:string)=>{
 const principalId='agent-'+contextRef.slice('codex-thread:'.length),stage=target.profile==='existing-ai-content-audit-v1'?'content':'visual';
 const common={schemaVersion:1,scope:'existing_ai',requestSha256:target.requestSha256,reviewer:{kind:'agent',principalId},reviewedAt:finishedAt};
 const projected=stage==='content'?{...common,independence:{separateReview:true,authorIdentityConfirmed:true,basis:'Fresh isolated Codex CLI turn; fixed request, Skill and admitted evidence.'},
  coveredClaimIds:response.coveredClaimIds,materialCoverage:response.materialCoverage,findings:response.findings,conclusion:response.conclusion}:
  {...common,protocol:'xpotato-private-visual-audit-v1',publicationSafetyReviewed:response.publicationSafetyReviewed,
   independence:{separateReview:true,identitiesConfirmed:true,basis:'Fresh isolated Codex CLI vision turn; fixed plan, Skill and admitted images.'},
   findings:response.findings,records:response.records,conclusion:response.conclusion};
 return {...projected,reviewer:{...projected.reviewer,execution:{protocol:'xpotato-private-hosted-agent-audit-observation-v1',contextRef,freshContext:true,
  stage,skillId:target.skill.skillId,skillSha256:target.skill.skillSha256,requestSha256:target.requestSha256,responseSha256:fingerprint(projected),completedAt:finishedAt,receiptSha256}}};
};
const promptFor=(p:ReturnType<typeof prepareSemanticInvocation>)=>canonicalJson({protocol:'xpotato-fixed-audit-task-v1',
 instruction:fixedAuditInstruction,
 request:p.request,disclosureManifest:p.manifest,artifacts:p.artifacts.filter(a=>!a.artifactId.startsWith('audit-image-')).map(a=>({id:a.artifactId,sha256:a.sha256,text:new TextDecoder('utf-8',{fatal:true}).decode(a.bytes)})),
 attachedImages:p.artifacts.filter(a=>a.artifactId.startsWith('audit-image-')).map(a=>({id:a.artifactId,sha256:a.sha256}))});
const decodeSnapshot=(raw:any)=>({...raw,artifacts:raw.artifacts.map((a:any)=>({...a,bytes:Buffer.from(a.bytes,'base64')}))});
const normalizeResponse=(response:any,stage:'content'|'visual')=>stage==='content'?response:{...response,records:response.records.map((r:any)=>{const {auditSha256:_hash,...unsigned}=r;return {...unsigned,auditSha256:fingerprint(unsigned)};})};
export function validateCodexJudgment(response:any,target:any,artifacts:readonly {artifactId:string;bytes:Uint8Array}[],stage:'content'|'visual'){
 if(response.conclusion==='pass'&&response.limitations.length)throw Error('CODEX_AUDIT_UNRESOLVED_LIMITATIONS');
 if(stage!=='content'){
  const planArtifact=artifacts.find(a=>a.artifactId==='audit-plan');
  if(response.conclusion==='pass'&&planArtifact&&JSON.parse(new TextDecoder().decode(planArtifact.bytes)).visualPlan.plans.some((p:any)=>p.role==='inline'&&!p.decorative)
   &&!artifacts.some(a=>a.artifactId==='audit-render-context'))throw Error('CODEX_AUDIT_RENDER_CONTEXT_REQUIRED');
  return;
 }
 if(response.conclusion==='pass'&&target.requiredClaimIds.length&&!response.independentlyExtractedClaims.length)throw Error('CODEX_AUDIT_INDEPENDENT_EXTRACTION_REQUIRED');
 const evidence=JSON.parse(new TextDecoder().decode(artifacts.find(a=>a.artifactId==='audit-evidence')!.bytes));
 const body=new TextDecoder().decode(artifacts.find(a=>a.artifactId==='audit-body')!.bytes);
 if(response.conclusion==='pass'&&articleMediaReferences(body).length&&!artifacts.some(a=>a.artifactId==='audit-render-context'))throw Error('CODEX_AUDIT_RENDER_CONTEXT_REQUIRED');
 for(const claim of response.independentlyExtractedClaims)if(body.slice(claim.span.start,claim.span.end)!==claim.text||claim.span.end<=claim.span.start
   ||claim.evidenceIds.some((id:string)=>!evidence.evidence.some((e:any)=>e.evidenceId===id))||response.conclusion==='pass'&&!claim.evidenceIds.length)throw Error('CODEX_AUDIT_CLAIM_SPAN_INVALID');
}

/** Only this fixed native subprocess transport can record an operational audit.
 * No adapter injection or receipt/JSON import can stand in for execution. */
export async function runExistingCodexAudit(input:ExistingAuditInvocationInput,profileInput:CodexAuditProfile){
 const profile=profileSchema.parse(profileInput),{prepareExistingAuditInvocation:prepare}=await import('./existing-audit-invocation.js');
 const p=await prepare(input),stage=stageFor(p.request.stage);
 if(p.profile.provider!=='openai'||p.profile.model!==profile.model||!p.profile.freshContext||p.profile.timeoutMs<20000)throw Error('CODEX_AUDIT_PROFILE_MISMATCH');
 if(sha256(await safeReadBytes(localPath(profile.executable),512*1024*1024))!==profile.executableSha256)throw Error('CODEX_AUDIT_EXECUTABLE_CHANGED');
 const folder=folderFor(input.directory,input.attemptId,p.request.requestSha256),journal=new RuntimeOperationJournal(join(input.directory,'audit-runtime'),
  {jobId:p.spec.jobId,jobFingerprint:fingerprint(p.spec)},semanticRuntimeLimits);
 // A new UUID must not turn an unknown prior run of the same audit into a retry.
 const auditBinding={attemptId:input.attemptId,stage:p.request.stage,inputSha256:input.inputSha256};
 const rejectionContext={directory:input.directory,profile};
 await assertNoUncertainAudit(journal,auditBinding,rejectionContext);
 const freshnessPaths=['job.json','working.md','attempts/'+input.attemptId+'/review/head.json',
  ...(stage==='visual'?['attempts/'+input.attemptId+'/visual/head.json']:[])];
 const baseline=await Promise.all(freshnessPaths.map(async path=>({path,sha256:sha256(await safeReadBytes(join(input.directory,path)))})));
 const fresh=async()=>{prepareSemanticInvocation(p);for(const file of baseline)if(sha256(await safeReadBytes(join(input.directory,file.path)))!==file.sha256)throw Error('CODEX_AUDIT_JOB_CHANGED_DURING_RUN');};
 const plan={operationId:'audit-'+p.request.requestId,kind:'semantic' as const,stage:p.request.stage,attemptId:input.attemptId,inputSha256:input.inputSha256,
  contextSha256:fingerprint({request:p.request,profile:p.profile,transport:profile})};
 const result=await journal.run(plan,{timeoutMs:p.profile.timeoutMs,preflight:async()=>{await assertNoUncertainAudit(journal,auditBinding,rejectionContext);await fresh();},execute:async signal=>{
  await noLinks(folder);await mkdir(folder,{recursive:true,mode:0o700});
  const snapshot={spec:p.spec,request:p.request,profile:p.profile,physical:p.physical,
   contract:{schemaId:p.contract.schemaId,sha256:p.contract.sha256},artifacts:p.artifacts.map(a=>({...a,bytes:Buffer.from(a.bytes).toString('base64')}))};
  await immutableBytes(join(folder,'invocation.json'),Buffer.from(canonicalJson(snapshot)+'\n'));
  const prompt=promptFor(p),processInput={protocol:'xpotato-codex-audit-process-v1',executable:profile.executable,executableSha256:profile.executableSha256,model:profile.model,
   timeoutMs:p.profile.timeoutMs-10000,maxBytes:4*1024*1024,prompt,schema:new TextDecoder().decode(p.contract.bytes),output:nativePath(join(folder,'process')),cancelPath:nativePath(join(folder,'cancel.request')),
   images:p.artifacts.filter(a=>a.artifactId.startsWith('audit-image-')).map(a=>({mimeType:'image/webp',base64:Buffer.from(a.bytes).toString('base64'),sha256:a.sha256}))};
  await immutableBytes(join(folder,'process-input.json'),Buffer.from(canonicalJson(processInput)+'\n'));
  const driver=fileURLToPath(new URL('./codex-audit-process.mjs',import.meta.url));
  const cancel=()=>{void immutable(join(folder,'cancel.request'),'cancel\n').catch(()=>{});};signal.addEventListener('abort',cancel,{once:true});
  const child=spawn(localPath(profile.nativeNode),[nativePath(driver),nativePath(join(folder,'process-input.json'))],{stdio:['ignore','pipe','pipe'],windowsHide:true});
  if(signal.aborted)cancel();
  let diagnosticSize=0;for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{diagnosticSize+=b.length;if(diagnosticSize>65536)cancel();});
  const exit=await new Promise<number|null>((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});signal.removeEventListener('abort',cancel);
  if(exit!==0)throw Error('CODEX_AUDIT_PROCESS_FAILED');
  const processRecord=JSON.parse(await safeRead(join(folder,'process/process.json'))),stdout=await safeReadBytes(join(folder,'process/stdout.jsonl'),4*1024*1024);
  if(processRecord.exitCode!==0||processRecord.stopped||processRecord.promptSha256!==sha256(prompt)||processRecord.schemaSha256!==p.contract.sha256
   ||processRecord.stdoutSha256!==sha256(stdout)||processRecord.executableSha256!==profile.executableSha256)throw Error('CODEX_AUDIT_PROCESS_INVALID');
  const parsed=parseCodexAuditEvents(stdout,stage,p.request.constraints.maxOutputBytes),response=normalizeResponse(parsed.response,stage);
  const target=JSON.parse(new TextDecoder().decode(p.artifacts.find(a=>a.artifactId===input.auditTargetArtifactId)!.bytes));
  validateCodexJudgment(response,target,p.artifacts,stage);
  const unsigned={protocol:'xpotato-operational-codex-audit-v1',requestSha256:p.request.requestSha256,targetRequestSha256:target.requestSha256,
   attemptId:input.attemptId,inputSha256:input.inputSha256,invocationSha256:fingerprint(snapshot),processSha256:fingerprint(processRecord),
   contextRef:parsed.contextRef,responseSha256:fingerprint(response),finishedAt:processRecord.finishedAt,plan};
  const receipt={...unsigned,receiptSha256:fingerprint(unsigned)};
  await immutable(join(folder,'receipt.json'),canonicalJson(receipt)+'\n');
  const audit=projectAudit(target,response,parsed.contextRef,processRecord.finishedAt,receipt.receiptSha256);
  await immutable(join(folder,'audit.json'),canonicalJson(audit)+'\n');
  await fresh();return {outputSha256:receipt.receiptSha256};
 }});
 if(result.state!=='verified')throw Error('CODEX_AUDIT_UNKNOWN_OUTCOME_NO_RESEND');
 const audit=JSON.parse(await safeRead(join(folder,'audit.json')));
 return {audit,receiptSha256:result.outputSha256,proof:await readRecordedAuditProof(input.directory,audit,JSON.parse(new TextDecoder().decode(p.artifacts.find(a=>a.artifactId===input.auditTargetArtifactId)!.bytes)),stage)};
}

const readbackSchema=z.object({protocol:z.literal('xpotato-private-codex-audit-readback-v1'),planSha256:hash,priorResultSha256:hash,
 receiptSha256:hash,processSha256:hash,invocationSha256:hash,recordSha256:hash}).strict();
export function assertCompletedAuditReadback(record:unknown,expected:{planSha256:string;priorResultSha256:string;receiptSha256:string;processSha256:string;invocationSha256:string}){
 const parsed=readbackSchema.parse(record),{recordSha256,...unsigned}=parsed;
 if(recordSha256!==fingerprint(unsigned)||fingerprint(unsigned)!==fingerprint({protocol:'xpotato-private-codex-audit-readback-v1',...expected}))throw Error('CODEX_AUDIT_READBACK_INVALID');
}

/** Read-only recovery of a fully closed, complete owned CLI turn. No model
 * invocation, no generic unknown retry and no caller-supplied judgment JSON.
 * Preserve original unknown and bind a separate observation to all real input,
 * executable, process, final response and result hashes before normal import.
 */
export async function recoverCompletedCodexAudit(directory:string,requestSha256:string,profileInput:CodexAuditProfile){
 const profile=profileSchema.parse(profileInput);hash.parse(requestSha256);
 const store=await readDraftStore(directory),folder=folderFor(directory,store.activeAttemptId,requestSha256);
 const snapshot=JSON.parse(await safeRead(join(folder,'invocation.json'),24*1024*1024)),decoded=decodeSnapshot(snapshot),stage=stageFor(snapshot.request.stage);
 if(fingerprint(decoded.spec)!==store.jobFingerprint||snapshot.request.requestSha256!==requestSha256)throw Error('CODEX_AUDIT_INVOCATION_STALE');
 const {semanticResponseContract}=await import('./semantic-runtime.js');
 const prepared=prepareSemanticInvocation({...decoded,contract:semanticResponseContract<unknown>(snapshot.contract.schemaId,stage==='content'?existingAiContentAuditResponseSchema:existingAiVisualAuditResponseSchema)});
 const target=JSON.parse(new TextDecoder().decode(prepared.artifacts.find(a=>a.artifactId==='audit-target')!.bytes));
 if(target.jobId!==store.jobId||target.attemptId!==store.activeAttemptId)throw Error('CODEX_AUDIT_RECEIPT_STALE');
 const required=await requiredExistingAuditMaterial(directory,target,stage);assertExistingAuditPhysicalSet(prepared.artifacts,required.materials);
 await assertExistingAuditDisclosureGrant(directory,stage);
 if(sha256(await safeReadBytes(localPath(profile.executable),512*1024*1024))!==profile.executableSha256)throw Error('CODEX_AUDIT_EXECUTABLE_CHANGED');
 const plan=JSON.parse(await safeRead(join(directory,'audit-runtime','audit-'+prepared.request.requestId,'intent.json')));
 if(plan.operationId!=='audit-'+prepared.request.requestId||plan.stage!==prepared.request.stage||plan.attemptId!==target.attemptId||plan.inputSha256!==target.inputSha256
  ||plan.contextSha256!==fingerprint({request:prepared.request,profile:prepared.profile,transport:profile}))throw Error('CODEX_AUDIT_READBACK_INVALID');
 const journal=new RuntimeOperationJournal(join(directory,'audit-runtime'),{jobId:store.jobId,jobFingerprint:store.jobFingerprint},semanticRuntimeLimits);
 const prior=await journal.inspect(plan);if(prior.state!=='unknown')throw Error('CODEX_AUDIT_READBACK_REQUIRES_CLOSED_UNKNOWN');
 const processRecord=JSON.parse(await safeRead(join(folder,'process/process.json'))),processInput=JSON.parse(await safeRead(join(folder,'process-input.json'),24*1024*1024));
 const stdout=await safeReadBytes(join(folder,'process/stdout.jsonl'),4*1024*1024),stderr=await safeReadBytes(join(folder,'process/stderr.txt'),4*1024*1024);
 const prompt=promptFor(prepared),imageHashes=prepared.artifacts.filter(a=>a.artifactId.startsWith('audit-image-')).map(a=>a.sha256);
 if(processInput.executable!==profile.executable||processInput.executableSha256!==profile.executableSha256||processInput.prompt!==prompt
  ||sha256(processInput.schema)!==prepared.contract.sha256||processRecord.exitCode!==0||processRecord.stopped!==false||processRecord.containmentFailed!==false
  ||processRecord.executableSha256!==profile.executableSha256||processRecord.model!==prepared.profile.model||!processRecord.freshContext
  ||processRecord.toolPolicy!=='no-shell-apps-web-image-tools-v1'||processRecord.promptSha256!==sha256(prompt)||processRecord.schemaSha256!==prepared.contract.sha256
  ||processRecord.stdoutSha256!==sha256(stdout)||processRecord.stderrSha256!==sha256(stderr)
  ||!Number.isFinite(Date.parse(processRecord.startedAt))||Date.parse(processRecord.finishedAt)<Date.parse(processRecord.startedAt)||Date.parse(processRecord.finishedAt)>Date.now()
  ||fingerprint(processRecord.imageSha256s)!==fingerprint(imageHashes)||fingerprint(processInput.images.map((i:any)=>i.sha256))!==fingerprint(imageHashes))throw Error('CODEX_AUDIT_PROCESS_INVALID');
 const parsed=parseCodexAuditEvents(stdout,stage,prepared.request.constraints.maxOutputBytes),response=normalizeResponse(parsed.response,stage);
 validateCodexJudgment(response,target,prepared.artifacts,stage);
 const unsigned={protocol:'xpotato-operational-codex-audit-v1',requestSha256:prepared.request.requestSha256,targetRequestSha256:target.requestSha256,
  attemptId:target.attemptId,inputSha256:target.inputSha256,invocationSha256:fingerprint(snapshot),processSha256:fingerprint(processRecord),
  contextRef:parsed.contextRef,responseSha256:fingerprint(response),finishedAt:processRecord.finishedAt,plan};
 const receipt={...unsigned,receiptSha256:fingerprint(unsigned)},audit=projectAudit(target,response,parsed.contextRef,processRecord.finishedAt,receipt.receiptSha256);
 if(fingerprint(await journal.inspect(plan))!==fingerprint(prior))throw Error('CODEX_AUDIT_READBACK_PRIOR_CHANGED');
 const record={protocol:'xpotato-private-codex-audit-readback-v1' as const,planSha256:fingerprint(plan),priorResultSha256:prior.resultSha256,
  receiptSha256:receipt.receiptSha256,processSha256:receipt.processSha256,invocationSha256:receipt.invocationSha256};
 await immutable(join(folder,'receipt.json'),canonicalJson(receipt)+'\n');await immutable(join(folder,'audit.json'),canonicalJson(audit)+'\n');
 await immutable(join(journal.directory,plan.operationId,'completed-readback.json'),canonicalJson({...record,recordSha256:fingerprint(record)})+'\n');
 return {audit,receiptSha256:receipt.receiptSha256,proof:await readRecordedAuditProof(directory,audit,target,stage),providerRetried:false as const};
}

/** Replay validates the actual immutable process artifacts and verified journal,
 * not the model's execution claims. Files live only in the trusted private job. */
export async function readRecordedAuditProof(directory:string,audit:any,target:any,stage:'content'|'visual'):Promise<RecordedAuditProof|undefined>{
 if(audit?.scope!=='existing_ai')return undefined;
 const receiptHash=hash.safeParse(audit.reviewer?.execution?.receiptSha256);if(!receiptHash.success)throw Error('AGENT_AUDIT_TRUSTED_EXECUTION_REQUIRED');
 const store=await readDraftStore(directory),attempt=target.attemptId;
 if(attempt!==store.activeAttemptId||target.jobId!==store.jobId)throw Error('CODEX_AUDIT_RECEIPT_STALE');
 // The semantic request is addressed by its full hash, never a caller path.
 const root=join(directory,'attempts',attempt,'agent-runs');
 const {readdir}=await import('node:fs/promises');const dirs=await readdir(root);if(dirs.length>15)throw Error('CODEX_AUDIT_RECEIPT_SET_INVALID');
 for(const name of dirs){
  if(!hash.safeParse(name).success)throw Error('CODEX_AUDIT_RECEIPT_PATH_INVALID');
  const folder=join(root,name);let receipt:any;try{receipt=JSON.parse(await safeRead(join(folder,'receipt.json')));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')continue;throw e;}
  if(receipt.receiptSha256!==receiptHash.data)continue;
  const {receiptSha256,...unsigned}=receipt;
  if(fingerprint(unsigned)!==receiptSha256||receipt.protocol!=='xpotato-operational-codex-audit-v1'||receipt.targetRequestSha256!==target.requestSha256
   ||receipt.attemptId!==attempt||receipt.inputSha256!==target.inputSha256||receipt.requestSha256!==name)throw Error('CODEX_AUDIT_RECEIPT_INVALID');
  const snapshot=JSON.parse(await safeRead(join(folder,'invocation.json'),24*1024*1024)),decoded=decodeSnapshot(snapshot);
  if(fingerprint(snapshot)!==receipt.invocationSha256||fingerprint(decoded.spec)!==store.jobFingerprint)throw Error('CODEX_AUDIT_INVOCATION_STALE');
  const schema=stage==='content'?existingAiContentAuditResponseSchema:existingAiVisualAuditResponseSchema;
  const {semanticResponseContract}=await import('./semantic-runtime.js');
  const prepared=prepareSemanticInvocation({...decoded,contract:semanticResponseContract<unknown>(snapshot.contract.schemaId,schema)});
  const required=await requiredExistingAuditMaterial(directory,target,stage);assertExistingAuditPhysicalSet(prepared.artifacts,required.materials);
  await assertExistingAuditDisclosureGrant(directory,stage);
  if(prepared.contract.schemaId!==required.contract.schemaId||prepared.contract.sha256!==required.contract.sha256)throw Error('CODEX_AUDIT_SCHEMA_INVALID');
  if(prepared.request.stage!==(stage==='content'?'content_audit':'visual_audit')||prepared.request.requestSha256!==name
   ||!prepared.artifacts.some(a=>Buffer.from(a.bytes).equals(Buffer.from(canonicalJson(target)))))throw Error('CODEX_AUDIT_TARGET_INVALID');
  const processRecord=JSON.parse(await safeRead(join(folder,'process/process.json'))),stdout=await safeReadBytes(join(folder,'process/stdout.jsonl'),4*1024*1024),stderr=await safeReadBytes(join(folder,'process/stderr.txt'),4*1024*1024);
  if(fingerprint(processRecord)!==receipt.processSha256||processRecord.exitCode!==0||processRecord.stopped||!processRecord.freshContext
   ||processRecord.toolPolicy!=='no-shell-apps-web-image-tools-v1'||processRecord.model!==prepared.profile.model
   ||processRecord.promptSha256!==sha256(promptFor(prepared))||processRecord.schemaSha256!==prepared.contract.sha256
   ||processRecord.stdoutSha256!==sha256(stdout)||processRecord.stderrSha256!==sha256(stderr)||Date.parse(processRecord.finishedAt)>Date.now())throw Error('CODEX_AUDIT_PROCESS_INVALID');
  const parsed=parseCodexAuditEvents(stdout,stage,prepared.request.constraints.maxOutputBytes),response=normalizeResponse(parsed.response,stage);
  validateCodexJudgment(response,target,prepared.artifacts,stage);
  if(fingerprint(processRecord.imageSha256s)!==fingerprint(prepared.artifacts.filter(a=>a.artifactId.startsWith('audit-image-')).map(a=>a.sha256)))throw Error('CODEX_AUDIT_IMAGE_SET_INVALID');
  if(parsed.contextRef!==receipt.contextRef||fingerprint(response)!==receipt.responseSha256||fingerprint(audit)!==fingerprint(projectAudit(target,response,parsed.contextRef,processRecord.finishedAt,receiptSha256)))throw Error('CODEX_AUDIT_RESPONSE_INVALID');
  const journal=new RuntimeOperationJournal(join(directory,'audit-runtime'),{jobId:store.jobId,jobFingerprint:store.jobFingerprint},semanticRuntimeLimits),result=await journal.inspect(receipt.plan);
 if(receipt.plan.attemptId!==attempt||receipt.plan.inputSha256!==target.inputSha256)throw Error('CODEX_AUDIT_JOURNAL_NOT_VERIFIED');
 if(result.state==='unknown'){
  const record=JSON.parse(await safeRead(join(journal.directory,receipt.plan.operationId,'completed-readback.json')));
  assertCompletedAuditReadback(record,{planSha256:fingerprint(receipt.plan),priorResultSha256:result.resultSha256,receiptSha256,
   processSha256:receipt.processSha256,invocationSha256:receipt.invocationSha256});
 }else if(result.state!=='verified'||result.outputSha256!==receiptSha256)throw Error('CODEX_AUDIT_JOURNAL_NOT_VERIFIED');
  const lineage=compactAiRunRefSchema.parse({role:stage==='content'?'auditor':'visual_auditor',provider:prepared.profile.provider,model:prepared.profile.model,
   skillId:prepared.request.skill.skillId,skillSha256:prepared.request.skill.skillSha256,requestSha256:prepared.request.requestSha256,responseSha256:receipt.responseSha256,
   externalApiUsed:true,externalDisclosurePolicyId:prepared.manifest.policyId,externalDisclosurePolicySha256:prepared.manifest.policySha256,
   externalDisclosureManifestSha256:prepared.manifest.manifestSha256,externalDisclosureModeSummary:'exact'});
  const proof=Object.freeze({protocol:'xpotato-recorded-codex-audit-proof-v1' as const});proofs.set(proof,{auditSha256:fingerprint(audit),requestSha256:target.requestSha256,lineage});return proof;
 }
 throw Error('AGENT_AUDIT_TRUSTED_EXECUTION_REQUIRED');
}
export async function compactRecordedAuditRun(directory:string,audit:unknown,target:unknown,stage:'content'|'visual'){
 const proof=await readRecordedAuditProof(directory,audit,target,stage);if(!proof)throw Error('CODEX_AUDIT_RECEIPT_REQUIRED');
 return structuredClone(proofs.get(proof)!.lineage);
}
