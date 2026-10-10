import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,openSync,fsyncSync,writeSync,closeSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
import {fingerprint} from './site-integrity-monitor.mjs';
import {bootstrapSourcePaths,sourceDigest,dispatchMonitorBootstrapOnce} from './site-monitor-bootstrap-once.mjs';
const sha='e'.repeat(40),repo='Xpotato1024/xpotato-site';
const baseline={schemaVersion:2,status:'OWNER_APPROVED',selection:{runId:'1',runAttempt:1,artifactId:'2',sourceSha:'f'.repeat(40),digest:'sha256:'+'a'.repeat(64)},accountId:'a'.repeat(32),workerTag:'b'.repeat(32),credentialId:'c'.repeat(32),deploymentId:'20000000-0000-0000-0000-000000000000',versionId:'10000000-0000-0000-0000-000000000000',settingsSha256:'1'.repeat(64),scriptSettingsSha256:'2'.repeat(64),versionResourcesSha256:'3'.repeat(64),accountSubdomainSha256:'4'.repeat(64),zoneIds:['d'.repeat(32)],samples:[{path:'/',sha256:'5'.repeat(64)}],checkpointRunId:null};
function fixture(){
 const calls=[],saved=[],texts=Object.fromEntries(bootstrapSourcePaths.map(path=>[path,'synthetic-source:'+path]));let reserved=false,sends=0;
 const options={expectedSourceSha:sha,baselineJson:JSON.stringify(baseline),approval:{schemaVersion:1,status:'OWNER_APPROVED_BASELINE',baselineSha256:fingerprint(baseline)},reviewedSourceHashes:Object.fromEntries(bootstrapSourcePaths.map(path=>[path,sourceDigest(texts[path])])),alreadyReserved:false,clock:()=> '2026-10-10T00:00:00.000Z',
  api:path=>{calls.push(path);if(path==='user')return {login:'Xpotato1024'};if(path.endsWith('/branches/main'))return {commit:{sha}};if(path.endsWith('/actions/workflows/site-integrity-monitor.yml'))return {path:'.github/workflows/site-integrity-monitor.yml',state:'active'};if(path.endsWith('/actions/variables/SITE_MONITOR_RUNTIME_GATE_JSON'))return {name:'SITE_MONITOR_RUNTIME_GATE_JSON',value:JSON.stringify({schemaVersion:1,status:'BOOTSTRAP_APPROVED',owner:'Xpotato1024',sourceSha:sha,baselineSha256:fingerprint(baseline),actionsEmailConfirmed:true,slackConfirmed:true,checkpoint:null})};if(path.includes('/contents/')){const key=path.split('/contents/')[1].split('?')[0];return {type:'file',path:key,encoding:'base64',content:Buffer.from(texts[key]).toString('base64')}};return {workflow_runs:[{head_sha:sha,head_branch:'main',event:'push',status:'completed',conclusion:'success'}]}},
  reserve:async value=>{if(reserved)throw Error('private-error');reserved=true;saved.push(structuredClone(value))},update:async value=>saved.push(structuredClone(value)),dispatch:async inputs=>{assert.equal(reserved,true);assert.deepEqual(inputs,{mode:'bootstrap',expected_source_sha:sha});sends++;return {status:0,stdout:'private-response-marker'}}};
 return {options,calls,saved,sends:()=>sends,reserved:()=>reserved};
}
test('reserve before the only dispatch; receipt never adopts checkpoint, enables schedule or copies baseline values',async()=>{
 const f=fixture(),r=await dispatchMonitorBootstrapOnce(f.options);assert.equal(f.sends(),1);assert.equal(f.saved[0].state,'BOOTSTRAP_DISPATCH_RESERVED');assert.equal(r.state,'BOOTSTRAP_DISPATCH_SENT_ONCE_NO_RETRY');assert.equal(r.bootstrapBudgetRemaining,0);assert.equal(r.maximumProviderGets,32);assert.equal(r.maximumPublicGets,3);assert.equal(r.checkpointAdopted,false);assert.equal(r.scheduleEnabled,false);assert.ok(!JSON.stringify(r).includes(baseline.accountId));assert.ok(!JSON.stringify(r).includes('private-response-marker'));
 await assert.rejects(dispatchMonitorBootstrapOnce({...f.options,alreadyReserved:true}),/DISPATCH_BLOCKED/);assert.equal(f.sends(),1);
});
for(const [name,override] of [
 ['owner',path=>path==='user'?{login:'other'}:undefined],['main',path=>path.endsWith('/branches/main')?{commit:{sha:'f'.repeat(40)}}:undefined],
 ['workflow',path=>path.endsWith('/actions/workflows/site-integrity-monitor.yml')?{path:'.github/workflows/other.yml',state:'active'}:undefined],
 ['disabled workflow',path=>path.endsWith('/actions/workflows/site-integrity-monitor.yml')?{path:'.github/workflows/site-integrity-monitor.yml',state:'disabled_manually'}:undefined],
 ['changed source',path=>path.includes('/contents/')?{type:'file',path:bootstrapSourcePaths[0],encoding:'base64',content:Buffer.from('changed').toString('base64')}:undefined],
 ['missing CI',path=>path.includes('/runs?')?{workflow_runs:[]}:undefined],['failed CI',path=>path.includes('/runs?')?{workflow_runs:[{head_sha:sha,head_branch:'main',event:'push',status:'completed',conclusion:'failure'}]}:undefined],
 ['running CI',path=>path.includes('/runs?')?{workflow_runs:[{head_sha:sha,head_branch:'main',event:'push',status:'in_progress',conclusion:null}]}:undefined]
])test(`preflight ${name} rejects before reservation or dispatch`,async()=>{const f=fixture(),api=f.options.api;f.options.api=async path=>override(path)??api(path);await assert.rejects(dispatchMonitorBootstrapOnce(f.options));assert.equal(f.reserved(),false);assert.equal(f.sends(),0)});
test('baseline/digest/source-map invalidity and an existing ledger reject before GitHub IO',async()=>{
 for(const patch of [{alreadyReserved:true},{expectedSourceSha:'BAD'},{baselineJson:'{'},{approval:{schemaVersion:1,status:'OWNER_APPROVED_BASELINE',baselineSha256:'0'.repeat(64)}},{reviewedSourceHashes:{}}]){const f=fixture();await assert.rejects(dispatchMonitorBootstrapOnce({...f.options,...patch}));assert.equal(f.calls.length,0);assert.equal(f.sends(),0)}
});
test('last-minute main move cannot consume reservation or dispatch',async()=>{const f=fixture(),api=f.options.api;let reads=0;f.options.api=async path=>path.endsWith('/branches/main')&&++reads===2?{commit:{sha:'f'.repeat(40)}}:api(path);await assert.rejects(dispatchMonitorBootstrapOnce(f.options));assert.equal(f.reserved(),false);assert.equal(f.sends(),0)});
for(const outcome of [null,{status:null},{status:1}])test('unknown or failed send consumes the sole approval without retry',async()=>{const f=fixture();let attempts=0;f.options.dispatch=async()=>{attempts++;return outcome};const r=await dispatchMonitorBootstrapOnce(f.options);assert.equal(attempts,1);assert.equal(r.state,'BOOTSTRAP_DISPATCH_UNKNOWN_NO_RETRY');assert.equal(r.approvalConsumed,true);assert.equal(r.bootstrapBudgetRemaining,0);await assert.rejects(dispatchMonitorBootstrapOnce({...f.options,alreadyReserved:true}));assert.equal(attempts,1)});
test('a thrown send and failed receipt update leave durable reservation consumed',async()=>{const f=fixture();let attempts=0;f.options.dispatch=async()=>{attempts++;throw Error('private-marker')};f.options.update=async()=>{throw Error('private-marker')};await assert.rejects(dispatchMonitorBootstrapOnce(f.options));assert.equal(attempts,1);assert.equal(f.saved[0].approvalConsumed,true);assert.equal(f.saved[0].state,'BOOTSTRAP_DISPATCH_RESERVED');await assert.rejects(dispatchMonitorBootstrapOnce({...f.options,alreadyReserved:true}));assert.equal(attempts,1)});
test('two competing calls use a real exclusive flushed ledger; only one dispatch occurs',async()=>{
 const f=fixture(),path=join(mkdtempSync(join(tmpdir(),'bootstrap-once-')),'ledger.json');
 f.options.reserve=async value=>{const fd=openSync(path,'wx',0o600);try{writeSync(fd,JSON.stringify(value));fsyncSync(fd)}finally{closeSync(fd)}};let sends=0;f.options.dispatch=async()=>{assert.equal(existsSync(path),true);sends++;return {status:0}};
 const result=await Promise.allSettled([dispatchMonitorBootstrapOnce(f.options),dispatchMonitorBootstrapOnce(f.options)]);assert.equal(result.filter(v=>v.status==='fulfilled').length,1);assert.equal(sends,1);assert.equal(JSON.parse(readFileSync(path)).approvalConsumed,true);
});
test('host CLI uses exclusive durable reservation and structured stdin without shell execution or retries',()=>{
 const text=readFileSync(new URL('./site-monitor-bootstrap-once-cli.mjs',import.meta.url),'utf8');assert.match(text,/openSync\(ledgerPath,'wx',0o600\)/);assert.match(text,/fsyncSync\(fd\)/);assert.match(text,/\['workflow','run','site-integrity-monitor.yml','--repo',repo,'--ref','main','--json'\],JSON.stringify\(inputs\)/);assert.doesNotMatch(text,/shell:\s*true|CLOUDFLARE_SITE_MONITOR_READ_TOKEN|retry\(/);
});
async function runCli({existing=false,invalidBaseline=false,collision=false,sendStatus=0}={}){
 const f=fixture(),files=Object.fromEntries(bootstrapSourcePaths.map(path=>[path,Buffer.from('synthetic-source:'+path)]));files['docs/operations/site-monitor-bootstrap-approval.json']=Buffer.from(JSON.stringify(f.options.approval));
 const source=readFileSync(new URL('./site-monitor-bootstrap-once-cli.mjs',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('import.meta.url',JSON.stringify('file:///synthetic/scripts/release/site-monitor-bootstrap-once-cli.mjs'));
 const logs=[],errors=[],operations=[];let stored,apiCalls=0,dispatches=0;
 const fakeProcess={argv:['node','cli','--dispatch-bootstrap-once',sha,'private-baseline.json'],exitCode:0};
 const ledgerPath=join(dirname(resolve('private-baseline.json')),`.monitor-bootstrap-${f.options.approval.baselineSha256}-approved-once.json`);
 const bytes=path=>String(path)==='private-baseline.json'?Buffer.from(invalidBaseline?'{':JSON.stringify(baseline)):files[String(path).replace('file:///synthetic/','')];
 await runInNewContext(source,{Buffer,URL,JSON,Object,dirname,join,resolve,console:{log:text=>logs.push(text),error:text=>errors.push(text)},process:fakeProcess,bootstrapSourcePaths,sourceDigest,dispatchMonitorBootstrapOnce,
  statSync:path=>({isFile:()=>true,size:bytes(path).length}),readFileSync:bytes,existsSync:()=>existing,
  openSync:(path,flag,mode)=>{operations.push('reserve');assert.equal(path,ledgerPath);assert.equal(flag,'wx');assert.equal(mode,0o600);if(collision)throw Error('private-marker');return 1},
  writeSync:(fd,value)=>{assert.equal(fd,1);stored=JSON.parse(value)},fsyncSync:()=>operations.push('flush'),closeSync:()=>operations.push('close'),writeFileSync:(path,value)=>{assert.equal(path,ledgerPath);stored=JSON.parse(value)},
  spawnSync:(command,args,options)=>{assert.equal(command,'gh');assert.equal(options.windowsHide,true);assert.equal(options.timeout,30000);assert.equal(options.shell,undefined);
   if(args[0]==='api'){apiCalls++;let value=f.options.api(args[1]);if(args[1].includes('/contents/')){const path=args[1].split('/contents/')[1].split('?')[0];value={...value,content:files[path].toString('base64')}}return {status:0,stdout:JSON.stringify(value)}}
   assert.deepEqual(Array.from(args),['workflow','run','site-integrity-monitor.yml','--repo',repo,'--ref','main','--json']);assert.ok(operations.includes('flush'));assert.equal(stored.approvalConsumed,true);assert.deepEqual(JSON.parse(options.input),{mode:'bootstrap',expected_source_sha:sha});dispatches++;return {status:sendStatus,stdout:'private-output-marker'}
  }
 });
 return {logs,errors,apiCalls,dispatches,stored,exitCode:fakeProcess.exitCode};
}
test('actual host CLI dispatch uses only structured inputs after a flushed reservation and logs fixed receipt',async()=>{const r=await runCli();assert.equal(r.dispatches,1);assert.equal(r.exitCode,0);assert.equal(r.errors.length,0);assert.equal(r.stored.state,'BOOTSTRAP_DISPATCH_SENT_ONCE_NO_RETRY');assert.ok(!r.logs.join('').includes(baseline.accountId));assert.ok(!r.logs.join('').includes('private-output-marker'))});
test('actual host CLI existing or malformed inputs block before GitHub IO',async()=>{for(const options of [{existing:true},{invalidBaseline:true}]){const r=await runCli(options);assert.equal(r.apiCalls,0);assert.equal(r.dispatches,0);assert.equal(r.exitCode,1);assert.deepEqual(r.errors,['MONITOR_BOOTSTRAP_DISPATCH_BLOCKED: retain any ledger; no retry or schedule.'])}});
test('actual host CLI reservation collision blocks dispatch; failed send remains consumed',async()=>{const collision=await runCli({collision:true});assert.equal(collision.dispatches,0);assert.equal(collision.exitCode,1);const failed=await runCli({sendStatus:1});assert.equal(failed.dispatches,1);assert.equal(failed.exitCode,1);assert.equal(failed.stored.state,'BOOTSTRAP_DISPATCH_UNKNOWN_NO_RETRY');assert.equal(failed.stored.bootstrapBudgetRemaining,0)});
