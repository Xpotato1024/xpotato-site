import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {runReadbackOnly} from './readback-only.mjs';
import {createSyntheticReadbackArtifact,openCanonicalReadbackArtifact,readbackArtifact} from './readback-only-artifact.mjs';
import {compilePublicationPlan} from './publication-plan.mjs';
import {authority} from './deployment-policy.mjs';
import {publicReadbackPolicy} from '../shared/public-readback-policy.mjs';
import {ManualDeployError} from './manual-deployment-provider.mjs';

const hash=b=>createHash('sha256').update(b).digest('hex');
export const uuid=n=>n.toString(16).padStart(8,'0')+'-0000-4000-8000-000000000000';
export const selection={artifactId:'12',digest:'sha256:'+'d'.repeat(64),runId:'11',runAttempt:1,sourceSha:'a'.repeat(40)};
export const expected={deploymentId:uuid(1),versionId:uuid(2),accountId:'1'.repeat(32),zoneId:'2'.repeat(32),workerTag:'3'.repeat(32),
  accountSubdomain:'example',hostname:authority.hostname,bindings:0,routes:0,workersDev:false,previewUrls:false};
const headerValues={'content-security-policy':"default-src 'self'",'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
  'permissions-policy':'camera=()','cache-control':'public, max-age=0, must-revalidate'};
const headers='/*\n'+Object.entries(headerValues).map(([k,v])=>'  '+k+': '+v).join('\n')+'\n';
export const sentinel='private-sentinel-never-in-evidence';
export async function fixture(t,change={}){
  const root=await mkdtemp(join(tmpdir(),'readback-only-'));
  assert.equal(dirname(root),resolve(tmpdir()));t.after(()=>rm(root,{recursive:true,force:true}));
  const capture=JSON.parse(await readFile(new URL('./fixtures/managed-robots-20261104.json',import.meta.url),'utf8'));
  const files=new Map([['/index.html',Buffer.from('<html>approved home</html>')],['/robots.txt',Buffer.from(capture.body).subarray(2676)],['/_headers',Buffer.from(headers)]]);
  for(let i=0;i<124;i++)files.set('/fixture-'+i+'.xml',Buffer.from('<xml n="'+i+'"/>'));
  const plan=compilePublicationPlan({files,sourceSha:selection.sourceSha,media:{protocol:'xpotato-built-publication-media-v1',sourceSha:selection.sourceSha,objects:[]},headers});
  assert.equal(plan.targets.length,126);
  const deployment={status:'acknowledged',receipt:{count:1,exitCode:0,versionId:expected.versionId}};
  const original={status:'STOPPED_OWNER_RECOVERY_REQUIRED',selection,deployCount:1,deployment,postimage:expected,verification:{status:'pending'}};
  const originalBytes=Buffer.from(JSON.stringify(original)),originalEvidencePath=join(root,'old-manual-result.json');
  await writeFile(originalEvidencePath,originalBytes);
  const request={operationId:uuid(5),verifierSha:'b'.repeat(40),selection:structuredClone(selection),
    originalDeployment:{runId:'13',runAttempt:1,evidenceArtifactId:'14',selection:structuredClone(selection),deployment:structuredClone(deployment),evidenceSha256:hash(originalBytes)},
    expected:structuredClone(expected)};
  let loads=0,time=Date.parse('2026-11-04T12:00:00Z');const calls=[],counts={};
  const load=async()=>{
    const value={handoff:{mode:'Production',sourceSha:selection.sourceSha,artifactId:selection.artifactId,digest:selection.digest},plan:structuredClone(plan)};
    loads++;change.artifact?.(value,loads);return value;
  };
  const artifact=createSyntheticReadbackArtifact({selection,load});
  const input={request,originalEvidencePath,artifact,outputDirectory:root,clock:()=>time,wait:async()=>{},
    context:{accountId:expected.accountId,ownerPolicyReviewed:true,tokenPolicy:{createdOnUtcDate:'2026-10-12',issuedOn:null,reviewSource:'owner-created-and-saved-token'}},
    readonlyCredential:async()=>'synthetic-read-credential-000',deployCredential:async()=>'synthetic-write-credential-000',
    fetchImpl:async(url,options)=>{
      assert.equal(options.method,'GET');assert.equal(options.redirect,'manual');assert.equal(options.body,undefined);
      const u=new URL(url),path=u.pathname,provider=u.origin==='https://api.cloudflare.com';
      const writer=provider&&options.headers.Authorization==='Bearer synthetic-write-credential-000';
      const key=provider?path+(writer?':writer':''):u.origin+path;
      counts[key]=(counts[key]??0)+1;
      calls.push({provider,path,writer});
      if(provider){
        let result,info;
        if(path.endsWith('/tokens/verify'))result={id:(writer?'4':'5').repeat(32),status:'active',expires_on:'2026-12-20T00:00:00Z',not_before:'2026-10-12T00:00:00Z'};
        else if(path.endsWith('/scripts'))result=[{id:authority.worker,tag:expected.workerTag}];
        else if(path.endsWith('/settings'))result={bindings:[]};
        else if(path.endsWith('/deployments'))result={deployments:[{id:expected.deploymentId,strategy:'percentage',versions:[{version_id:expected.versionId,percentage:100}]}]};
        else if(path.includes('/versions/'))result={id:expected.versionId,resources:{bindings:[]}};
        else if(path.endsWith('/scripts/'+authority.worker+'/subdomain'))result={enabled:false,previews_enabled:false};
        else if(path.endsWith('/domains')){result=[{id:'domain',service:authority.worker,hostname:authority.hostname,environment:'production',zone_id:expected.zoneId,enabled:true,previews_enabled:false}];info={page:1,per_page:100,count:1,total_count:1};}
        else if(path.endsWith('/routes'))result=[];
        else if(path.endsWith('/workers/subdomain'))result={subdomain:expected.accountSubdomain};
        else throw Error('Unexpected synthetic provider request');
        const body={success:true,errors:[],result,...info?{result_info:info}:{}};
        const status=change.provider?.({path,writer,body,count:counts[key],calls})??200;
        return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
      }
      const alternate=u.hostname.endsWith('.workers.dev');
      const response={body:alternate?'missing':path==='/robots.txt'?Buffer.from(capture.body):files.get(path==='/'?'/index.html':path),status:alternate?404:200,headers:{...headerValues}};
      change.public?.({url:u,path,alternate,response,count:counts[key],calls,advance:ms=>{time+=ms;}});
      return new Response(response.body,{status:response.status,headers:response.headers});
    }};
  return {input,root,files,plan,calls,counts,originalEvidencePath,originalBytes,artifact,loads:()=>loads,
    run:()=>runReadbackOnly(input),saved:async()=>JSON.parse(await readFile(join(root,'readback-only-'+request.operationId+'.json'),'utf8'))};
}
