import {fingerprint,monitorTimestamp as utc} from './site-integrity-monitor.mjs';
export const ARMED_METADATA_RUNS=48,ARMED_METADATA_GETS=4,ARMED_BODY_GETS=56,ARMED_ADVANCE_SECONDS=1800;
const fail=label=>{throw Error(label)},positive=v=>Number.isSafeInteger(v)&&v>0;
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===[...keys].sort().join('|');
export function validateArmedRegistration(g){
 const r=g.registration;
 if(g.status!=='ARMED'||!exact(r,['status','registeredAt','afterRunId','afterRunNumber','maxAdvanceSeconds','maxMetadataRuns','maxGithubGetsPerMetadataRun','maxGithubGetsPerObservation'])||r.status!=='OWNER_APPROVED_ARMED_REGISTRATION'||!utc(r.registeredAt)||!/^[1-9][0-9]*$/.test(r.afterRunId)||BigInt(r.afterRunId)<1n||!positive(r.afterRunNumber)||r.afterRunNumber!==g.trial.afterRunNumber||r.afterRunNumber>Number.MAX_SAFE_INTEGER-ARMED_METADATA_RUNS||r.maxAdvanceSeconds!==ARMED_ADVANCE_SECONDS||r.maxMetadataRuns!==ARMED_METADATA_RUNS||r.maxGithubGetsPerMetadataRun!==ARMED_METADATA_GETS||r.maxGithubGetsPerObservation!==ARMED_BODY_GETS||Date.parse(g.trial.startedAt)<=Date.parse(r.registeredAt)||Date.parse(g.trial.startedAt)-Date.parse(r.registeredAt)>ARMED_ADVANCE_SECONDS*1000)fail('ARMED_REGISTRATION_UNKNOWN');
}
export function armedWindowOrdinal(rows,current,g){
 const inWindow=r=>Date.parse(r.createdAt)>=Date.parse(g.trial.startedAt)&&Date.parse(r.createdAt)<Date.parse(g.trial.expiresAt);
 const prefix=rows.filter(r=>r.runNumber>g.registration.afterRunNumber&&r.runNumber<current.runNumber).sort((a,b)=>a.runNumber-b.runNumber);
 if(prefix.length!==current.runNumber-g.registration.afterRunNumber-1||prefix.some((r,i)=>r.runNumber!==g.registration.afterRunNumber+i+1))fail('ARMED_PREFIX_INCOMPLETE');
 if(!inWindow(current))fail('ARMED_SCOPE_INELIGIBLE');
 return prefix.filter(inWindow).length+1;
}
const keys=['gateSha256','jobStartedAt','jobCompletedAt','admissionStartedAt','admissionCompletedAt','admissionStepNumber','bodyStepNumber','bodyConclusion','scopeReceiptStepNumber','noIoReceiptStepNumber'];
export function validateArmedScopeProof(p,r,g,{noIo=false,observationProof}={}){
 if(!exact(p,keys)||p.gateSha256!==fingerprint(g)||r.sourceSha!==g.sourceSha||![p.jobStartedAt,p.jobCompletedAt,p.admissionStartedAt,p.admissionCompletedAt].every(utc)||Date.parse(p.jobStartedAt)<Date.parse(r.createdAt)||Date.parse(p.jobCompletedAt)>Date.parse(r.completedAt)||Date.parse(p.jobCompletedAt)<Date.parse(p.jobStartedAt)||Date.parse(p.admissionStartedAt)<Date.parse(p.jobStartedAt)||Date.parse(p.admissionCompletedAt)<Date.parse(p.admissionStartedAt)||Date.parse(p.admissionCompletedAt)>Date.parse(p.jobCompletedAt)||Date.parse(p.admissionCompletedAt)-Date.parse(p.admissionStartedAt)>120000||![p.admissionStepNumber,p.bodyStepNumber,p.scopeReceiptStepNumber].every(positive)||p.scopeReceiptStepNumber<=p.admissionStepNumber||p.bodyStepNumber<=p.scopeReceiptStepNumber)fail('ARMED_SCOPE_PROOF_UNKNOWN');
 if(noIo){if(r.conclusion!=='success'||!r.jobSummary?.some(j=>j.name==='observe'&&j.conclusion==='success')||r.jobSummary.some(j=>j.name!=='observe'&&j.conclusion!=='skipped')||p.bodyConclusion!=='skipped'||!positive(p.noIoReceiptStepNumber)||p.noIoReceiptStepNumber<=p.bodyStepNumber)fail('ARMED_NO_IO_UNKNOWN');}
 else if(Date.parse(p.admissionStartedAt)<Date.parse(g.trial.startedAt)||Date.parse(observationProof?.observationCompletedAt)>=Date.parse(g.trial.expiresAt)||p.bodyConclusion!=='success'||p.noIoReceiptStepNumber!==null||!observationProof||observationProof.observationStepNumber!==p.bodyStepNumber||Date.parse(observationProof.observationStartedAt)<Date.parse(p.admissionCompletedAt)||Date.parse(observationProof.observationCompletedAt)-Date.parse(p.admissionStartedAt)>120000)fail('ARMED_SCOPE_PROOF_UNKNOWN');
 return p;
}
export function readArmedScopeProof(raw,r,g,{noIo=false,observationProof}={}){
 const job=raw.jobs.find(j=>j.name==='observe'),steps=job?.steps;
 if(!job||job.status!=='completed'||!Array.isArray(steps))fail('ARMED_SCOPE_PROOF_UNKNOWN');
 const step=name=>{const found=steps.filter(s=>s.name===name);if(found.length!==1)fail('ARMED_SCOPE_PROOF_UNKNOWN');return found[0]},admission=step('Armed public admission'),body=step('Trial readonly observation'),scope=step('Monitor armed scope '+fingerprint(g)),noOp=noIo?step('Monitor receipt ARMED_NO_IO '+fingerprint(g)):null;
 if([admission,scope,...(noOp?[noOp]:[])].some(s=>s.status!=='completed'||s.conclusion!=='success')||body.status!=='completed')fail('ARMED_SCOPE_PROOF_UNKNOWN');
 return validateArmedScopeProof({gateSha256:fingerprint(g),jobStartedAt:job.started_at,jobCompletedAt:job.completed_at,admissionStartedAt:admission.started_at,admissionCompletedAt:admission.completed_at,admissionStepNumber:admission.number,bodyStepNumber:body.number,bodyConclusion:body.conclusion,scopeReceiptStepNumber:scope.number,noIoReceiptStepNumber:noOp?.number??null},{...r,jobSummary:raw.jobs.map(j=>({name:j.name,status:j.status,conclusion:j.conclusion}))},g,{noIo,observationProof});
}
