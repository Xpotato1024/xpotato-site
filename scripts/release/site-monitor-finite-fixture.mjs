import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fingerprint} from './site-integrity-monitor.mjs';
export const source='d'.repeat(40);
export const T='2026-10-12T01:00:00Z',E='2026-10-12T03:00:00Z';
export const at=seconds=>new Date(Date.parse(T)+seconds*1000).toISOString();
const publicAudit=JSON.parse(readFileSync(new URL('../../docs/operations/site-monitor-executor-audit.json',import.meta.url)));
const cf=result=>Response.json({success:true,errors:[],result});
const paged=result=>Response.json({success:true,errors:[],result,result_info:{page:1,per_page:100,count:result.length,total_count:result.length,total_pages:1}});
export function fixture(){
 const settings={bindings:[],compatibility_date:'2026-09-23'},scriptSettings={logpush:false,tail_consumers:[]},resources={bindings:{},script:{etag:'synthetic-only'}},subdomain={subdomain:'fixture-only'};
 const b={schemaVersion:2,status:'OWNER_APPROVED',selection:{runId:'1',runAttempt:1,artifactId:'2',sourceSha:'e'.repeat(40),digest:'sha256:'+'f'.repeat(64)},accountId:'a'.repeat(32),workerTag:'b'.repeat(32),credentialId:'c'.repeat(32),deploymentId:'20000000-0000-0000-0000-000000000000',versionId:'10000000-0000-0000-0000-000000000000',settingsSha256:fingerprint(settings),scriptSettingsSha256:fingerprint(scriptSettings),versionResourcesSha256:fingerprint(resources),accountSubdomainSha256:fingerprint(subdomain),zoneIds:[],samples:[{path:'/',sha256:createHash('sha256').update('synthetic-public').digest('hex')}],checkpointRunId:null};
 const audit={...structuredClone(publicAudit),baselineSha256:fingerprint(b)};
 const gate={schemaVersion:4,status:'ACTIVE',owner:'Xpotato1024',sourceSha:source,baselineSha256:fingerprint(b),actionsEmailConfirmed:true,slackConfirmed:true,checkpoint:audit.records[1].checkpoint,transition:{status:'OWNER_APPROVED_EXECUTOR_TRANSITION',auditSha256:fingerprint(audit),effectiveAt:T},trial:{status:'OWNER_APPROVED_FINITE_TRIAL',startedAt:T,expiresAt:E,afterRunNumber:9,maxAttempts:24,maxGithubGetsPerAttempt:64},readApproval:{status:'OWNER_APPROVED_FINITE_READ_WITH_RETAINED_INCIDENTS',ownerDecisionSha256:'9'.repeat(64),historicalIncidentRetained:true,deployAllowed:false,sitePublicationAllowed:false,acceptance:false},evidence:{status:'OWNER_APPROVED_NONSECRET_ARTIFACT_STORAGE',workflow:'.github/workflows/site-monitor-trial-evidence.yml',afterRunNumber:5,notBefore:E,expiresAt:'2026-10-12T04:00:00Z',maxAttempts:1,maxGithubGets:64,maxJsonBytes:131072,retentionDays:7,overwrite:false,maxLogicalUploads:1,uploadTimeoutSeconds:120,artifactVisibility:'PUBLIC_REPOSITORY_READERS',uploadActionSha:'ea165f8d65b6e75b540449e92b4886f43607fa02',retryPolicy:'PINNED_ACTION_FINITE_RETRIES',storageDeadlinePolicy:'ADMISSION_AND_RECEIPT_DEADLINE_PLATFORM_UPLOAD_TIMEOUT'}};
 const raw=(id,n,sha,event,c,u,conclusion='success',path='.github/workflows/site-integrity-monitor.yml')=>({id,run_number:n,run_attempt:1,repository:{full_name:'Xpotato1024/xpotato-site'},path,head_branch:'main',head_sha:sha,event,actor:{login:'Xpotato1024'},triggering_actor:{login:'Xpotato1024'},created_at:c,updated_at:u,status:'completed',conclusion});
 const rows=audit.records.map((r,i)=>raw(Number(r.checkpoint.runId),6+i,r.checkpoint.sourceSha,'workflow_dispatch',r.checkpoint.createdAt,r.checkpoint.completedAt));
 rows.push(raw(38147019542,8,audit.sourceSha,'schedule','2026-10-11T14:24:02Z','2026-10-11T14:24:03Z','skipped'),raw(38166551243,9,'7'.repeat(40),'schedule','2026-10-11T19:05:38Z','2026-10-11T19:05:39Z','skipped'));
 const jobs=Object.fromEntries(rows.slice(0,2).map(r=>[r.id,{total_count:2,jobs:[{name:'bootstrap',run_id:r.id,head_sha:r.head_sha,status:'completed',conclusion:'success',started_at:r.created_at,completed_at:r.updated_at},{name:'observe',run_id:r.id,head_sha:r.head_sha,status:'completed',conclusion:'skipped'}]}]));
 for(const r of rows.slice(2))jobs[r.id]={total_count:2,jobs:['bootstrap','observe'].map(name=>({name,run_id:r.id,head_sha:r.head_sha,status:'completed',conclusion:'skipped'}))};
 const collector={...raw(9000,6,source,'workflow_dispatch',T,at(1),null,gate.evidence.workflow),status:'in_progress'};
 let now=Date.parse(at(1)),lookups=0;const calls=[];
 const fetchImpl=async(url,init)=>{
  calls.push(url);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');const u=new URL(url),p=u.pathname;
  if(u.origin==='https://api.github.com'){
   const m=p.match(/\/runs\/(\d+)(\/attempts\/1\/jobs)?$/);
   if(m)return Response.json(m[2]?jobs[m[1]]:Number(m[1])===collector.id?collector:rows.find(r=>r.id===Number(m[1])));
   const [a,z]=u.searchParams.get('created').split('..').map(Date.parse),batch=rows.filter(r=>Date.parse(r.created_at)>=a&&Date.parse(r.created_at)<=z);
   return Response.json({total_count:batch.length,workflow_runs:batch});
  }
  if(u.origin!=='https://api.cloudflare.com')return new Response(u.origin==='https://xpotato.net'?'synthetic-public':'not found',{status:u.origin==='https://xpotato.net'?200:404});
  if(p.endsWith('/tokens/verify'))return cf({id:b.credentialId,status:'active'});
  if(p.endsWith('/workers/scripts'))return cf([{id:'xpotato-site',tag:b.workerTag}]);
  if(p.endsWith('/deployments'))return Response.json({success:true,errors:[],result:{deployments:[{id:b.deploymentId,strategy:'percentage',versions:[{version_id:b.versionId,percentage:100}]}]},result_info:{page:1,per_page:100,count:1,total_count:1,total_pages:1}});
  if(p.endsWith('/script-settings'))return cf(scriptSettings);
  if(p.endsWith('/settings'))return cf(settings);
  if(p.includes('/versions/'))return cf({id:b.versionId,resources});
  if(p.endsWith('/workers/domains'))return paged([{id:'synthetic-domain',service:'xpotato-site',environment:'production',hostname:'xpotato.net'}]);
  if(p.endsWith('/workers/subdomain'))return cf(subdomain);
  if(p.endsWith('/subdomain'))return cf({enabled:false,previews_enabled:false});
  throw Error('synthetic-secret-never-output');
 };
 const complete=r=>{r.status='completed';r.conclusion='success';r.updated_at=at((Date.parse(r.created_at)-Date.parse(T))/1000+10);jobs[r.id]={total_count:1,jobs:[{name:'observe',run_id:r.id,head_sha:r.head_sha,status:'completed',conclusion:'success',started_at:r.created_at,completed_at:r.updated_at,steps:[{name:'Trial readonly observation',number:1,status:'completed',conclusion:'success',started_at:r.created_at,completed_at:r.updated_at},{name:'Monitor receipt OBSERVED_MATCH',number:2,status:'completed',conclusion:'success'}]}]};};
 return {b,audit,gate,rows,jobs,collector,calls,raw,fetchImpl,clock:()=>now,setNow:t=>{now=Date.parse(t)},credentialProvider:async()=>{lookups++;return 'synthetic-github-token'},lookups:()=>lookups,complete};
}
