// Schema5 admission is public-only. No ambient credentials/network defaults.
import {open,mkdir,lstat,realpath,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {fingerprint,monitorTimestamp as utc,createIntegrityMonitor} from './site-integrity-monitor.mjs';
import {prepareApprovedBaseline,runId} from './site-monitor-runtime.mjs';
import {prepareFiniteTrialGate,createFiniteHistoryReader,exact,fail,sha} from './site-monitor-finite.mjs';
import {createPublicWorkflowHistoryReader} from './site-monitor-history.mjs';
import {createJsonTransport} from './deployment-http.mjs';
import {armedWindowOrdinal,ARMED_METADATA_GETS,ARMED_METADATA_RUNS,ARMED_BODY_GETS,ARMED_STARTUP_METADATA_GETS} from './site-monitor-armed-policy.mjs';
const reservations=new WeakSet(),bodyPermits=new WeakSet(),repo='Xpotato1024/xpotato-site',workflow='.github/workflows/site-integrity-monitor.yml';
const positive=v=>Number.isSafeInteger(v)&&v>0,hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const permitKeys=['schemaVersion','gateSha256','sourceSha','runId','runNumber','runAttempt','windowOrdinal','admittedAt','deadlineAt','currentCreatedAt','metadataGets'];
async function directory(path){if(typeof path!=='string'||resolve(path)!==path)fail('ARMED_STORAGE_UNKNOWN');await mkdir(path,{recursive:true,mode:0o700});if((await lstat(path)).isSymbolicLink()||await realpath(path)!==path)fail('ARMED_STORAGE_UNKNOWN');}
async function consume(path,name,record){await directory(path);const f=await open(join(path,name),'wx',0o600);try{await f.writeFile(JSON.stringify(record));await f.sync()}finally{await f.close()}}
export async function reserveArmedMetadataAttempt({gate,audit,sourceSha,baselineSha256,currentRunId,currentRunNumber,runAttempt,controlDirectory}){
 const g=prepareFiniteTrialGate({gate,audit,sourceSha,baselineSha256});
 if(g.schemaVersion!==5||!runId(currentRunId)||runAttempt!==1||!positive(currentRunNumber)||currentRunNumber<=g.registration.afterRunNumber||currentRunNumber>g.registration.afterRunNumber+ARMED_METADATA_RUNS)fail('ARMED_RESERVATION_UNKNOWN');
 await consume(controlDirectory,'metadata-consumed-'+currentRunId,{gateSha256:fingerprint(g),runId:currentRunId,runNumber:currentRunNumber,runAttempt,githubGetsReserved:4});
 const reservation=Object.freeze({gateSha256:fingerprint(g),runId:currentRunId,runNumber:currentRunNumber});reservations.add(reservation);return reservation;
}
export function createArmedMetadataAdmission({gate,audit,sourceSha,baselineSha256,credentialProvider,fetchImpl,clock=Date.now}){
 const g=prepareFiniteTrialGate({gate,audit,sourceSha,baselineSha256});if(g.schemaVersion!==5)fail('ARMED_REGISTRATION_UNKNOWN');let attempted=false,gets=0;
 return Object.freeze({gets:()=>gets,check:async({currentRunId,currentRunNumber,reservation}={})=>{
  if(attempted)fail('ARMED_ALREADY_ATTEMPTED');attempted=true;
  if(!runId(currentRunId)||!positive(currentRunNumber))fail('ARMED_RESERVATION_UNKNOWN');
  const noIo=()=>({status:'NO_IO',gateSha256:fingerprint(g),metadataGets:gets});
  const started=clock(),T=Date.parse(g.trial.startedAt),E=Date.parse(g.trial.expiresAt);
  if(started<T||started>=E||currentRunNumber<=g.registration.afterRunNumber||currentRunNumber>g.registration.afterRunNumber+ARMED_METADATA_RUNS)return noIo();
  if(!reservations.has(reservation)||reservation.gateSha256!==fingerprint(g)||reservation.runId!==currentRunId||reservation.runNumber!==currentRunNumber)fail('ARMED_RESERVATION_UNKNOWN');
  const deadlineAt=Math.min(started+120000,E),controller=new AbortController();let timer;
  const check=()=>{if(controller.signal.aborted||clock()>=deadlineAt)fail('TRIAL_DEADLINE');if(gets>=ARMED_METADATA_GETS)fail('ARMED_METADATA_BUDGET_EXHAUSTED')};
  const credential=async context=>{check();return credentialProvider(context)},fetcher=(...args)=>{check();gets++;return fetchImpl(...args)};
  const path=`/repos/${repo}/actions/runs/${currentRunId}`,transport=createJsonTransport({origin:'https://api.github.com',credentialProvider:credential,fetchImpl:fetcher,clock,allowRequest:r=>r.method==='GET'&&r.path===path&&r.query.size===0&&r.body===undefined&&!r.allow404});
  try{return await Promise.race([(async()=>{
   const current=(await transport({path,signal:controller.signal,deadlineAt})).data;
   if(String(current?.id)!==currentRunId||current.run_number!==currentRunNumber||current.run_attempt!==1||current.repository?.full_name!==repo||current.path!==workflow||current.head_branch!=='main'||current.head_sha!==g.sourceSha||current.event!=='schedule'||current.actor?.login!==g.owner||current.triggering_actor?.login!==g.owner||current.status!=='in_progress'||current.conclusion!==null||!utc(current.created_at)||!utc(current.updated_at)||Date.parse(current.created_at)>clock()||Date.parse(current.updated_at)<Date.parse(current.created_at)||Date.parse(current.updated_at)>clock())fail('TRIAL_RUN_IDENTITY_UNKNOWN');
   if(Date.parse(current.created_at)<T){if(clock()>=deadlineAt)fail('TRIAL_DEADLINE');return noIo()}
   const sourceForRun=raw=>{
    if(String(raw.id)===g.registration.afterRunId){if(raw.run_number!==g.registration.afterRunNumber||raw.run_attempt!==1||raw.status!=='completed'||!['success','failure','skipped','cancelled','timed_out','action_required','neutral','stale','startup_failure'].includes(raw.conclusion)||Date.parse(raw.updated_at)<Date.parse(raw.created_at)||Date.parse(raw.updated_at)>Date.parse(g.registration.registeredAt)||!sha(raw.head_sha))return undefined;return raw.head_sha}
    return raw.run_number<=g.registration.afterRunNumber&&Date.parse(raw.created_at)<Date.parse(g.registration.registeredAt)?raw.head_sha:g.sourceSha;
   };
   const reader=createPublicWorkflowHistoryReader({credentialProvider:credential,fetchImpl:fetcher,clock});
   const history=await reader({checkpointRunId:g.registration.afterRunId,historyFromAt:g.registration.registeredAt,excludeRunId:currentRunId,currentRun:{id:currentRunId,createdAt:current.created_at},expectedSourceSha:g.sourceSha,readonlyAdmission:true,sourceForRun,retainedValidator:()=>{},signal:controller.signal,deadlineAt});
   if(!history.runs.some(r=>r.id===history.anchor.id))history.runs.push(history.anchor);
   if(!history.runs.some(r=>r.id===g.registration.afterRunId&&r.runNumber===g.registration.afterRunNumber))fail('ARMED_REGISTRATION_UNKNOWN');
   const ids=new Set(),numbers=new Set();for(const r of history.runs){if(!runId(r.id)||ids.has(r.id)||!positive(r.runNumber)||numbers.has(r.runNumber)||r.headBranch!=='main'||r.runAttempt!==1||!['schedule','workflow_dispatch'].includes(r.event))fail('ARMED_PREFIX_INCOMPLETE');ids.add(r.id);numbers.add(r.runNumber)}
   const row={id:currentRunId,runNumber:currentRunNumber,createdAt:current.created_at},ordinal=armedWindowOrdinal(history.runs,row,g);
   if(clock()>=deadlineAt)fail('TRIAL_DEADLINE');if(ordinal>24)return noIo();
   return {status:'ADMITTED',gateSha256:fingerprint(g),permit:{schemaVersion:1,gateSha256:fingerprint(g),sourceSha:g.sourceSha,runId:currentRunId,runNumber:currentRunNumber,runAttempt:1,windowOrdinal:ordinal,admittedAt:new Date(started).toISOString(),deadlineAt:new Date(deadlineAt).toISOString(),currentCreatedAt:current.created_at,metadataGets:gets}};
  })(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('TRIAL_DEADLINE'))},Math.max(0,deadlineAt-clock()))})])}finally{clearTimeout(timer);controller.abort()}
 }});
}
export function validateArmedPermit(p,g,{currentRunId,currentRunNumber,sourceSha,clock=Date.now}={}){
 if(!exact(p,permitKeys)||p.schemaVersion!==1||p.gateSha256!==fingerprint(g)||p.sourceSha!==sourceSha||p.runId!==currentRunId||p.runNumber!==currentRunNumber||p.runAttempt!==1||!positive(p.windowOrdinal)||p.windowOrdinal>24||!positive(p.metadataGets)||p.metadataGets>4||![p.admittedAt,p.deadlineAt,p.currentCreatedAt].every(utc)||Date.parse(p.currentCreatedAt)<Date.parse(g.trial.startedAt)||Date.parse(p.currentCreatedAt)>Date.parse(p.admittedAt)||Date.parse(p.admittedAt)<Date.parse(g.trial.startedAt)||Date.parse(p.deadlineAt)!==Math.min(Date.parse(p.admittedAt)+120000,Date.parse(g.trial.expiresAt))||clock()<Date.parse(p.admittedAt)||clock()>=Date.parse(p.deadlineAt)||p.runNumber<=g.registration.afterRunNumber||p.runNumber>g.registration.afterRunNumber+48)fail('ARMED_PERMIT_UNKNOWN');
 return p;
}
export async function writeArmedPermit({directory:path,permit,gate,clock=Date.now}){
 validateArmedPermit(permit,gate,{currentRunId:permit.runId,currentRunNumber:permit.runNumber,sourceSha:gate.sourceSha,clock});
 const bytes=Buffer.from(JSON.stringify(permit)+'\n');await directory(path);const f=await open(join(path,'admission.json'),'wx',0o600);try{await f.writeFile(bytes);await f.sync()}finally{await f.close()}return digest(bytes);
}
export async function readAndConsumeArmedPermit({directory:path,expectedSha256,gate,currentRunId,currentRunNumber,sourceSha,clock=Date.now}){
 if(!hash(expectedSha256))fail('ARMED_PERMIT_UNKNOWN');await directory(path);const target=join(path,'admission.json'),info=await lstat(target);if(!info.isFile()||info.isSymbolicLink()||info.size>4096)fail('ARMED_PERMIT_UNKNOWN');const bytes=await readFile(target);if(bytes.length>4096||digest(bytes)!==expectedSha256)fail('ARMED_PERMIT_UNKNOWN');
 const p=validateArmedPermit(JSON.parse(bytes.toString('utf8')),gate,{currentRunId,currentRunNumber,sourceSha,clock});
 if(!bytes.equals(Buffer.from(JSON.stringify(p)+'\n')))fail('ARMED_PERMIT_UNKNOWN');await consume(path,'provider-consumed-'+currentRunId,{gateSha256:fingerprint(gate),runId:currentRunId,ordinal:p.windowOrdinal,githubGetsReserved:ARMED_BODY_GETS-(p.windowOrdinal===24?ARMED_STARTUP_METADATA_GETS:0),providerGetsReserved:32,publicGetsReserved:3});if(clock()>=Date.parse(p.deadlineAt))fail('TRIAL_DEADLINE');bodyPermits.add(p);return p;
}
export async function observeArmedPermit({gate,audit,sourceSha,baselineSha256,permit,currentRunId,currentRunNumber,baselineJsonProvider,githubCredentialProvider,providerCredentialProvider,fetchImpl,clock=Date.now}){
 const g=prepareFiniteTrialGate({gate,audit,sourceSha,baselineSha256});validateArmedPermit(permit,g,{currentRunId,currentRunNumber,sourceSha,clock});
 if(!bodyPermits.has(permit))fail('ARMED_RESERVATION_UNKNOWN');bodyPermits.delete(permit);
 const deadlineAt=Date.parse(permit.deadlineAt),controller=new AbortController();let timer;
 const check=()=>{if(controller.signal.aborted||clock()>=deadlineAt)fail('TRIAL_DEADLINE')};
 try{return await Promise.race([(async()=>{
  check();const baseline=prepareApprovedBaseline(await baselineJsonProvider(),{schemaVersion:1,status:'OWNER_APPROVED_BASELINE',baselineSha256});check();
  const reader=createFiniteHistoryReader({gate:g,audit,sourceSha,baselineSha256,credentialProvider:githubCredentialProvider,fetchImpl,clock}),h=await reader.read({currentRunId,currentRunNumber,windowOrdinal:permit.windowOrdinal,expectedCurrentCreatedAt:permit.currentCreatedAt,signal:controller.signal,deadlineAt});check();
  if(h.trialIncident)fail('HISTORY_INCIDENT_UNCLASSIFIED');
  const result=await createIntegrityMonitor({baseline,credentialProvider:providerCredentialProvider,fetchImpl,clock,maxPublicGets:3}).check({signal:controller.signal,deadlineAt});check();
  return {stage:'ARMED_NATURAL_READONLY_TRIAL',...result,trialOrdinal:permit.windowOrdinal,githubGets:permit.metadataGets+reader.gets(),historicalIncidentRetained:true,coverageStatus:'COVERAGE_INCIDENT_RETAINED'};
 })(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('TRIAL_DEADLINE'))},Math.max(0,deadlineAt-clock()))})])}finally{clearTimeout(timer);controller.abort()}
}
