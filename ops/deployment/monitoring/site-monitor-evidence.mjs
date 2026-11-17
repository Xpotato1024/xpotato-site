// No fetch/credential defaults. Only the approved workflow wires actual IO.
import {open,mkdir,lstat,realpath,link,unlink,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {fingerprint,monitorTimestamp as utc} from './site-integrity-monitor.mjs';
import {runId} from './site-monitor-runtime.mjs';
import {prepareFiniteTrialGate,createFiniteHistoryReader,evidenceWorkflow,exact,sha,hash,fail} from './site-monitor-finite.mjs';
import {validateArmedScopeProof} from './site-monitor-armed-policy.mjs';
import {createEvidenceWaitReceipt,validateEvidenceWaitReceipt,encodeEvidenceWaitTransport} from './site-monitor-evidence-ready.mjs';
const permits=new WeakSet(),consumed=new WeakSet(),readyState=new WeakMap(),MAX=131072;
const number=v=>Number.isSafeInteger(v)&&v>0;
const rootFields=['schemaVersion','status','gate','audit','collector','collectedAt','cutoff','complete','githubGets','history','runs','trialCoverageStatus','reason','windowObservedRuns','windowSpanSeconds','historicalIncidentRetained','liveFreshness','schedulerProvenanceVerified','deployAllowed','sitePublicationAllowed','providerMutations','acceptance'];
const rowFields=['id','runNumber','runAttempt','sourceSha','event','status','conclusion','createdAt','completedAt','classification','proof','jobSummary'];
const classifications=['BOOTSTRAP_CHECKPOINT','UNRESOLVED_PRETRIAL_INCIDENT_RETAINED','ARMED_PRETRIAL_NO_IO_RETAINED','TRIAL_INCIDENT_RETAINED','TRIAL_OBSERVED_MATCH','CUTOFF_BOUNDARY_EXCLUDED'];
async function reserveLocalBudget(controlDirectory,currentRunId,record){
 if(typeof controlDirectory!=='string'||resolve(controlDirectory)!==controlDirectory)fail('EVIDENCE_STORAGE_UNKNOWN');
 await mkdir(controlDirectory,{recursive:true,mode:0o700});if((await lstat(controlDirectory)).isSymbolicLink()||await realpath(controlDirectory)!==controlDirectory)fail('EVIDENCE_STORAGE_UNKNOWN');
 const handle=await open(join(controlDirectory,'consumed-'+currentRunId),'wx',0o600);
 try{await handle.writeFile(JSON.stringify(record));await handle.sync()}finally{await handle.close()}
}
export async function reserveFiniteReadAttempt({gate,audit,sourceSha,baselineSha256,currentRunId,currentRunNumber,runAttempt,controlDirectory,clock=Date.now}){
 const g=prepareFiniteTrialGate({gate,audit,sourceSha,baselineSha256});
 if(!runId(currentRunId)||runAttempt!==1||!number(currentRunNumber)||currentRunNumber<=g.trial.afterRunNumber||currentRunNumber>g.trial.afterRunNumber+24||clock()<Date.parse(g.trial.startedAt)||clock()>=Date.parse(g.trial.expiresAt))fail('TRIAL_APPROVAL_UNKNOWN');
 await reserveLocalBudget(controlDirectory,currentRunId,{runId:currentRunId,runAttempt,gateSha256:fingerprint(g),githubGetsReserved:64,providerGetsReserved:32,publicGetsReserved:3});
}
export async function reserveEvidenceAttempt({gate,audit,sourceSha,baselineSha256,currentRunId,currentRunNumber,runAttempt,controlDirectory,clock=Date.now}){
 const g=prepareFiniteTrialGate({gate,audit,sourceSha,baselineSha256}),now=clock();
 if(g.evidence.status!=='OWNER_APPROVED_NONSECRET_ARTIFACT_STORAGE'||!runId(currentRunId)||runAttempt!==1||currentRunNumber!==g.evidence.afterRunNumber+1||now<Date.parse(g.schemaVersion===5?g.registration.registeredAt:g.trial.startedAt)||now+240000>=Date.parse(g.evidence.expiresAt))fail('EVIDENCE_APPROVAL_UNKNOWN');
 // A fixed run namespace prevents digest changes from minting another budget.
 await reserveLocalBudget(controlDirectory,currentRunId,{runId:currentRunId,runAttempt,gateSha256:fingerprint(g),githubGetsReserved:64,logicalUploadsReserved:1,...(g.schemaVersion===5?{startupMetadataGetsReserved:3}:{})});
 const permit=Object.freeze({gateSha256:fingerprint(g),auditSha256:fingerprint(audit),currentRunId,currentRunNumber});permits.add(permit);readyState.set(permit,{controlDirectory,preparing:false,receipt:null});return permit;
}
export async function prepareEvidenceWait(options){
 const {permit}=options,state=readyState.get(permit);
 if(!permits.has(permit)||consumed.has(permit)||!state||state.preparing||permit.gateSha256!==fingerprint(options.gate)||permit.auditSha256!==fingerprint(options.audit)||permit.currentRunId!==options.currentRunId||permit.currentRunNumber!==options.currentRunNumber)fail('EVIDENCE_RESERVATION_UNKNOWN');
 state.preparing=true;
 const receipt=await createEvidenceWaitReceipt({...options,onGet:()=>{}});encodeEvidenceWaitTransport({receipt,...options});
 const bytes=Buffer.from(JSON.stringify(receipt)+'\n'),path=join(state.controlDirectory,'wait-ready.json'),handle=await open(path,'wx',0o600);
 try{await handle.writeFile(bytes);await handle.sync()}finally{await handle.close()}
 state.receipt=receipt;return {receipt,sha256:fingerprint(receipt)};
}
export async function restoreEvidenceWait(options){
 const {controlDirectory,expectedSha256,currentRunId,currentRunNumber,clock=Date.now}=options;
 if(!hash(expectedSha256)||typeof controlDirectory!=='string'||resolve(controlDirectory)!==controlDirectory||(await lstat(controlDirectory)).isSymbolicLink()||await realpath(controlDirectory)!==controlDirectory)fail('EVIDENCE_RESERVATION_UNKNOWN');
 const read=async(name,max)=>{const path=join(controlDirectory,name),info=await lstat(path);if(!info.isFile()||info.size>max)fail('EVIDENCE_RESERVATION_UNKNOWN');const bytes=await readFile(path);if(bytes.length>max)fail('EVIDENCE_RESERVATION_UNKNOWN');const value=JSON.parse(bytes);if(!bytes.equals(Buffer.from(JSON.stringify(value)+'\n'))&&name==='wait-ready.json')fail('EVIDENCE_RESERVATION_UNKNOWN');return value};
 const receipt=validateEvidenceWaitReceipt(await read('wait-ready.json',8192),options),record=await read('consumed-'+currentRunId,1024);
 if(fingerprint(receipt)!==expectedSha256||clock()<Date.parse(receipt.firstWaitCompletedAt)||clock()+240000>=Date.parse(options.gate.evidence.expiresAt)||!exact(record,['runId','runAttempt','gateSha256','githubGetsReserved','logicalUploadsReserved','startupMetadataGetsReserved'])||record.runId!==currentRunId||record.runAttempt!==1||record.gateSha256!==receipt.gateSha256||record.githubGetsReserved!==64||record.logicalUploadsReserved!==1||record.startupMetadataGetsReserved!==3)fail('EVIDENCE_RESERVATION_UNKNOWN');
 const handle=await open(join(controlDirectory,'collection-consumed'),'wx',0o600);try{await handle.sync()}finally{await handle.close()}
 const permit=Object.freeze({gateSha256:receipt.gateSha256,auditSha256:receipt.auditSha256,currentRunId,currentRunNumber});permits.add(permit);readyState.set(permit,{controlDirectory,preparing:true,receipt,restored:true});return permit;
}
function coverage(rows,g){
 const observed=rows.filter(r=>r.classification==='TRIAL_OBSERVED_MATCH').sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
 const span=observed.length>1?(Date.parse(observed.at(-1).createdAt)-Date.parse(observed[0].createdAt))/1000:0;
 const incident=rows.some(r=>r.classification==='TRIAL_INCIDENT_RETAINED');
 const good=!incident&&observed.length>=13&&span>=3600&&Date.parse(observed[0].createdAt)<=Date.parse(g.trial.startedAt)+600000&&Date.parse(observed.at(-1).createdAt)>=Date.parse(g.trial.expiresAt)-600000&&observed.every((r,i)=>Date.parse(r.completedAt)-Date.parse(r.createdAt)<=600000&&(!i||Date.parse(r.createdAt)-Date.parse(observed[i-1].createdAt)<=600000&&Date.parse(r.completedAt)-Date.parse(observed[i-1].completedAt)<=600000));
 return {trialCoverageStatus:good?'CONDITIONS_MET':'NOT_CONFIRMED',reason:good?'CONDITIONS_MET':incident?'TRIAL_INCIDENT_RETAINED':'WINDOW_NOT_CONFIRMED',windowObservedRuns:observed.length,windowSpanSeconds:span};
}
export async function collectTrialEnvelope({gate,audit,sourceSha,baselineSha256,currentRunId,currentRunNumber,permit,credentialProvider,fetchImpl,clock=Date.now}){
 const g=prepareFiniteTrialGate({gate,audit,sourceSha,baselineSha256});
 if(!permits.has(permit)||consumed.has(permit)||permit.gateSha256!==fingerprint(g)||permit.auditSha256!==fingerprint(audit)||permit.currentRunId!==currentRunId||permit.currentRunNumber!==currentRunNumber)fail('EVIDENCE_RESERVATION_UNKNOWN');
 const ready=readyState.get(permit)?.receipt;if(g.schemaVersion===5&&(!ready||!readyState.get(permit).restored))fail('EVIDENCE_RESERVATION_UNKNOWN');
 consumed.add(permit);
 if(clock()<Date.parse(g.trial.expiresAt)||clock()+240000>=Date.parse(g.evidence.expiresAt))fail('EVIDENCE_APPROVAL_UNKNOWN');
 const reader=createFiniteHistoryReader({gate:g,audit,sourceSha,baselineSha256,credentialProvider,fetchImpl,clock,initialGithubGets:ready?.githubGetsSpent??0}),controller=new AbortController();let timer,h;
 const deadlineAt=Math.min(clock()+120000,Date.parse(g.evidence.expiresAt)-120000);
 try{h=await Promise.race([reader.read({currentRunId,currentRunNumber,collector:true,expectedCurrentCreatedAt:ready?.runCreatedAt,signal:controller.signal,deadlineAt}),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('TRIAL_DEADLINE'))},Math.max(0,deadlineAt-clock()))})])}catch{h=null}finally{clearTimeout(timer);controller.abort()}
 const runs=h?.runs??[];
 const e={schemaVersion:g.schemaVersion===5?2:1,status:'FINITE_TRIAL_EVIDENCE',gate:g,audit:structuredClone(audit),collector:{runId:currentRunId,runNumber:currentRunNumber,runAttempt:1,sourceSha,workflow:evidenceWorkflow,identityVerified:h!==null},collectedAt:new Date(clock()).toISOString(),cutoff:g.trial.expiresAt,complete:h!==null,githubGets:reader.gets(),runs,...(h?coverage(runs,g):{trialCoverageStatus:'UNKNOWN',reason:'COLLECTION_UNKNOWN',windowObservedRuns:0,windowSpanSeconds:0}),historicalIncidentRetained:true,liveFreshness:'NOT_ASSESSED',schedulerProvenanceVerified:false,deployAllowed:false,sitePublicationAllowed:false,providerMutations:0,acceptance:false};
 e.history=h?.history??null;validateTrialEnvelope(e);return e;
}
export function validateTrialEnvelope(e){
 if(!exact(e,rootFields)||![1,2].includes(e.schemaVersion)||e.status!=='FINITE_TRIAL_EVIDENCE'||!utc(e.collectedAt)||e.historicalIncidentRetained!==true||e.liveFreshness!=='NOT_ASSESSED'||e.schedulerProvenanceVerified!==false||e.deployAllowed!==false||e.sitePublicationAllowed!==false||e.providerMutations!==0||e.acceptance!==false)fail('EVIDENCE_ENVELOPE_UNKNOWN');
 const g=prepareFiniteTrialGate({gate:e.gate,audit:e.audit,sourceSha:e.collector?.sourceSha,baselineSha256:e.gate?.baselineSha256}),c=e.collector;
 const armed=g.schemaVersion===5;if(e.schemaVersion!==(armed?2:1))fail('EVIDENCE_ENVELOPE_UNKNOWN');
 if(!exact(c,['runId','runNumber','runAttempt','sourceSha','workflow','identityVerified'])||!runId(c.runId)||c.runNumber!==g.evidence.afterRunNumber+1||c.runAttempt!==1||c.sourceSha!==g.sourceSha||c.workflow!==evidenceWorkflow||typeof c.identityVerified!=='boolean'||e.cutoff!==g.trial.expiresAt||Date.parse(e.collectedAt)<Date.parse(e.cutoff)||Date.parse(e.collectedAt)>=Date.parse(g.evidence.expiresAt)||typeof e.complete!=='boolean'||!Number.isSafeInteger(e.githubGets)||e.githubGets<0||e.githubGets>64||!Array.isArray(e.runs)||e.runs.length>1000||e.complete!==c.identityVerified)fail('EVIDENCE_ENVELOPE_UNKNOWN');
 const ids=new Set(),numbers=new Set();
 for(const r of e.runs){
  if(!exact(r,[...rowFields,...(armed?['windowOrdinal','scopeProof']:[])])||!runId(r.id)||ids.has(r.id)||!number(r.runNumber)||numbers.has(r.runNumber)||r.runAttempt!==1||!sha(r.sourceSha)||!['schedule','workflow_dispatch'].includes(r.event)||r.status!=='completed'||!['success','failure','skipped','cancelled','timed_out','action_required','neutral','stale','startup_failure'].includes(r.conclusion)||!utc(r.createdAt)||!utc(r.completedAt)||Date.parse(r.completedAt)<Date.parse(r.createdAt)||Date.parse(r.completedAt)>Date.parse(e.collectedAt)||!classifications.includes(r.classification))fail('EVIDENCE_ENVELOPE_UNKNOWN');
  ids.add(r.id);numbers.add(r.runNumber);
  if(!Array.isArray(r.jobSummary)||r.jobSummary.length>2||new Set(r.jobSummary.map(j=>j.name)).size!==r.jobSummary.length||r.jobSummary.some(j=>!exact(j,['name','status','conclusion'])||!['bootstrap','observe'].includes(j.name)||j.status!=='completed'||!['success','failure','skipped','cancelled','timed_out','action_required','neutral','stale','startup_failure'].includes(j.conclusion)))fail('EVIDENCE_ENVELOPE_UNKNOWN');
  const cp=e.audit.records.find(v=>v.checkpoint.runId===r.id)?.checkpoint,pre=Date.parse(r.createdAt)<Date.parse(g.trial.startedAt);
  if(r.classification==='BOOTSTRAP_CHECKPOINT'){
   if(!cp||r.sourceSha!==cp.sourceSha||r.createdAt!==cp.createdAt||r.completedAt!==cp.completedAt||r.event!==cp.event||r.conclusion!=='success'||r.runNumber>g.trial.afterRunNumber)fail('EVIDENCE_ENVELOPE_UNKNOWN');
  }else if(cp)fail('EVIDENCE_ENVELOPE_UNKNOWN');
  else if(r.classification==='UNRESOLVED_PRETRIAL_INCIDENT_RETAINED'){
   if(!pre||r.runNumber>g.trial.afterRunNumber||Date.parse(r.completedAt)>=Date.parse(g.trial.startedAt))fail('EVIDENCE_ENVELOPE_UNKNOWN');
  }else if(r.classification==='ARMED_PRETRIAL_NO_IO_RETAINED'){
   if(!armed||!pre||!(r.runNumber>g.trial.afterRunNumber||Date.parse(r.completedAt)>=Date.parse(g.trial.startedAt)))fail('EVIDENCE_ENVELOPE_UNKNOWN');
  }else if(r.classification==='CUTOFF_BOUNDARY_EXCLUDED'){
   if(Date.parse(r.createdAt)!==Date.parse(e.cutoff))fail('EVIDENCE_ENVELOPE_UNKNOWN');
  }else if(pre||r.runNumber<=g.trial.afterRunNumber||!armed&&(r.runNumber>g.trial.afterRunNumber+24||r.event!=='schedule')||r.sourceSha!==g.sourceSha||Date.parse(r.createdAt)>=Date.parse(e.cutoff)||(r.classification==='TRIAL_OBSERVED_MATCH')!==(r.conclusion==='success'&&Date.parse(r.completedAt)<Date.parse(e.cutoff)&&(!armed||r.event==='schedule'&&r.windowOrdinal<=24&&r.runNumber<=g.registration.afterRunNumber+48)))fail('EVIDENCE_ENVELOPE_UNKNOWN');
  const verified=['BOOTSTRAP_CHECKPOINT','TRIAL_OBSERVED_MATCH'].includes(r.classification),p=r.proof;
  if(verified){
   if(!r.jobSummary.some(j=>j.name===(cp?'bootstrap':'observe')&&j.conclusion==='success')||r.jobSummary.some(j=>j.name!==(cp?'bootstrap':'observe')&&j.conclusion!=='skipped'))fail('EVIDENCE_ENVELOPE_UNKNOWN');
   if(!exact(p,['kind','jobStartedAt','jobCompletedAt','observationStartedAt','observationCompletedAt','observationStepNumber','receiptStepNumber'])||p.kind!==(cp?'BOOTSTRAP_CONFIRMED':'OBSERVED_MATCH')||!utc(p.jobStartedAt)||!utc(p.jobCompletedAt)||Date.parse(p.jobStartedAt)<Date.parse(r.createdAt)||Date.parse(p.jobCompletedAt)>Date.parse(r.completedAt)||Date.parse(p.jobCompletedAt)<Date.parse(p.jobStartedAt))fail('EVIDENCE_ENVELOPE_UNKNOWN');
   if(cp){if([p.observationStartedAt,p.observationCompletedAt,p.observationStepNumber,p.receiptStepNumber].some(v=>v!==null))fail('EVIDENCE_ENVELOPE_UNKNOWN');}
   else if(!utc(p.observationStartedAt)||!utc(p.observationCompletedAt)||Date.parse(p.observationStartedAt)<Date.parse(p.jobStartedAt)||Date.parse(p.observationCompletedAt)>Date.parse(p.jobCompletedAt)||Date.parse(p.observationCompletedAt)<Date.parse(p.observationStartedAt)||Date.parse(p.observationCompletedAt)-Date.parse(p.observationStartedAt)>120000||!number(p.observationStepNumber)||!number(p.receiptStepNumber)||p.receiptStepNumber<=p.observationStepNumber)fail('EVIDENCE_ENVELOPE_UNKNOWN');
  }else if(p!==null)fail('EVIDENCE_ENVELOPE_UNKNOWN');
  if(armed){
   const inWindow=!pre&&Date.parse(r.createdAt)<Date.parse(e.cutoff),ordered=e.runs.filter(v=>Date.parse(v.createdAt)>=Date.parse(g.trial.startedAt)&&Date.parse(v.createdAt)<Date.parse(e.cutoff)).sort((a,b)=>a.runNumber-b.runNumber);
   if(r.windowOrdinal!==(inWindow?ordered.findIndex(v=>v.id===r.id)+1:null))fail('EVIDENCE_ENVELOPE_UNKNOWN');
   if(r.classification==='ARMED_PRETRIAL_NO_IO_RETAINED'){
    if(exact(r.scopeProof,['kind'])&&r.scopeProof.kind==='NO_EXECUTED_JOBS'){if(r.conclusion!=='skipped'||r.jobSummary.some(j=>j.conclusion!=='skipped'))fail('EVIDENCE_ENVELOPE_UNKNOWN');}
    else validateArmedScopeProof(r.scopeProof,r,g,{noIo:true});
   }else if(r.classification==='TRIAL_OBSERVED_MATCH')validateArmedScopeProof(r.scopeProof,r,g,{observationProof:p});
   else if(r.scopeProof!==null)fail('EVIDENCE_ENVELOPE_UNKNOWN');
  }
 }
 if(e.complete){
  const h=e.history;if(!exact(h,['fromAt','throughAt','totalCount','partitions'])||h.fromAt!==e.audit.records[0].checkpoint.createdAt||h.throughAt!==e.cutoff||h.totalCount!==e.runs.length||!Array.isArray(h.partitions)||!h.partitions.length)fail('EVIDENCE_ENVELOPE_UNKNOWN');
  let lower=Math.floor(Date.parse(h.fromAt)/1000)*1000,total=0;
  const end=Math.floor(Date.parse(e.cutoff)/1000)*1000;
  for(const p of h.partitions){const upper=Math.min(end,Math.floor(lower/86400000)*86400000+86400000-1000);if(!exact(p,['fromAt','throughAt','totalCount','receivedCount','pages'])||Date.parse(p.fromAt)!==lower||Date.parse(p.throughAt)!==upper||!utc(p.fromAt)||!utc(p.throughAt)||!Number.isSafeInteger(p.totalCount)||p.totalCount<0||p.totalCount>1000||p.receivedCount!==p.totalCount||!number(p.pages)||p.pages>10||e.runs.filter(r=>Date.parse(r.createdAt)>=lower&&Date.parse(r.createdAt)<=upper).length!==p.totalCount)fail('EVIDENCE_ENVELOPE_UNKNOWN');total+=p.totalCount;lower=upper+1000;}
  if(lower!==end+1000||total!==h.totalCount||e.githubGets<2+h.partitions.reduce((sum,p)=>sum+p.pages,0)+e.runs.length)fail('EVIDENCE_ENVELOPE_UNKNOWN');
  if(e.githubGets<4||e.audit.records.some(v=>!ids.has(v.checkpoint.runId))||!numbers.has(g.trial.afterRunNumber))fail('EVIDENCE_ENVELOPE_UNKNOWN');
  if(armed&&!e.runs.some(r=>r.id===g.registration.afterRunId&&r.runNumber===g.registration.afterRunNumber&&Date.parse(r.completedAt)<=Date.parse(g.registration.registeredAt)))fail('EVIDENCE_ENVELOPE_UNKNOWN');
  const sorted=[...numbers].sort((a,b)=>a-b);for(let i=1;i<sorted.length;i++)if(sorted[i]!==sorted[i-1]+1)fail('EVIDENCE_ENVELOPE_UNKNOWN');
  const computed=coverage(e.runs,g);for(const k of Object.keys(computed))if(e[k]!==computed[k])fail('EVIDENCE_ENVELOPE_UNKNOWN');
 }else if(e.history!==null||e.runs.length||e.trialCoverageStatus!=='UNKNOWN'||e.reason!=='COLLECTION_UNKNOWN'||e.windowObservedRuns!==0||e.windowSpanSeconds!==0)fail('EVIDENCE_ENVELOPE_UNKNOWN');
 return e;
}
export function encodeTrialEnvelope(envelope){
 validateTrialEnvelope(envelope);const bytes=Buffer.from(JSON.stringify(envelope)+'\n');if(bytes.length>MAX)fail('EVIDENCE_BODY_LIMIT');return {bytes,sha256:createHash('sha256').update(bytes).digest('hex')};
}
export async function writeTrialEnvelope({directory,envelope}){
 const {bytes}=encodeTrialEnvelope(envelope);if(resolve(directory)!==directory||(await lstat(directory)).isSymbolicLink()||await realpath(directory)!==directory)fail('EVIDENCE_STORAGE_UNKNOWN');
 // A separate exclusive marker prevents overwrite even after a partial crash.
 const marker=await open(join(directory,'write-consumed'),'wx',0o600);try{await marker.sync()}finally{await marker.close()}
 const partial=join(directory,'evidence.partial'),target=join(directory,'evidence.json'),file=await open(partial,'wx',0o600);
 try{await file.writeFile(bytes);await file.sync()}finally{await file.close()}
 try{await lstat(target);fail('EVIDENCE_STORAGE_UNKNOWN')}catch(error){if(error.code!=='ENOENT')throw error}
 // link publishes already-fsynced complete bytes with atomic no-replace semantics.
 await link(partial,target);await unlink(partial);return target;
}
export function makeSavedReceipt({envelope,jsonBytes,artifactId,artifactDigest,expectedGateSha256,expectedJsonSha256,currentRunId,currentRunNumber,sourceSha,clock=Date.now}){
 const encoded=encodeTrialEnvelope(envelope);
 if(!Buffer.isBuffer(jsonBytes)||!jsonBytes.equals(encoded.bytes)||!hash(expectedGateSha256)||!hash(expectedJsonSha256)||encoded.sha256!==expectedJsonSha256||fingerprint(envelope.gate)!==expectedGateSha256||envelope.collector.runId!==currentRunId||envelope.collector.runNumber!==currentRunNumber||envelope.collector.sourceSha!==sourceSha||!runId(artifactId)||!hash(artifactDigest)||clock()>=Date.parse(envelope.gate.evidence.expiresAt))fail('EVIDENCE_PROVENANCE_UNKNOWN');
 return {schemaVersion:1,status:'EVIDENCE_SAVED',runId:currentRunId,runAttempt:1,sourceSha,gateSha256:expectedGateSha256,artifactId,artifactSha256:artifactDigest,jsonSha256:encoded.sha256,jsonBytes:encoded.bytes.length,trialCoverageStatus:envelope.trialCoverageStatus,historicalIncidentRetained:true,deployAllowed:false,sitePublicationAllowed:false,acceptance:false};
}
