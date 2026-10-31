// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Xpotato.net / Xpotato1024
import {LIMITS as BASE_LIMITS,validateInput,validatePacket,validateMemory} from '../rusqsieve/contracts.mjs';
import {dlpProfile,validateDlpConfiguration,validateDlpStats,validateDlpTimings} from '../rusqsieve-dlp/contracts.mjs';
import {CreditLedger,schedulerProfile} from '../graph-multicore/credits.mjs';
import {OwnerClock} from '../graph-multicore/metrics.mjs';
import {StreamingPacketAudit as PacketAudit} from '../graph-multicore/packet-audit.mjs';
import{optimizedWorkerSource as workerSourceForCap}from'./worker-source.mjs';
import {selectResourcePlan,validateResourcePlan} from '../graph-multicore/policy.mjs';
import {makeWorkerFromSource} from '../worker/source-factory.mjs';
import {assessPrime} from '../engine/arithmetic.mjs';
import {SMALL_PRIMES} from '../engine/options.mjs';
let nextGeneration=0;
export function runRusqsieve(input,options={}){
 const {coordinatorCompute=true,scheduler='credit1',fixedFamilies=null,familyLimit=null,capturePackets=false,profile='baseline',resourcePlan=selectResourcePlan(),workers=resourcePlan.workers,timeBudgetMs=resourcePlan.timeBudgetMs,retainLocal=false,shareContext=true,signal,createWorker=(index,cap)=>makeWorkerFromSource(workerSourceForCap(cap)),onProgress=()=>{},now=()=>performance.now()}=options;
 const LIMITS={...BASE_LIMITS,transportBytes:resourcePlan.transportBytes};
 validateResourcePlan(resourcePlan);if(typeof coordinatorCompute!=='boolean'||!coordinatorCompute&&workers<2)throw Error('Dedicated coordinator requires helpers');if(workers!==resourcePlan.workers||timeBudgetMs!==resourcePlan.timeBudgetMs)throw Error('Resource request identity');
 if(familyLimit!==null&&(!Number.isSafeInteger(familyLimit)||familyLimit<1||familyLimit>4096))throw Error('Finite family limit');
 const policy=schedulerProfile(scheduler);if(profile!=='baseline'||typeof capturePackets!=='boolean'||fixedFamilies!==null&&(!Number.isInteger(fixedFamilies)||fixedFamilies<4||fixedFamilies>128))throw Error('Frozen scheduler limits');
 const inputInfo=validateInput(input);dlpProfile(profile);if(retainLocal!==false||shareContext!==true)throw Error("Fixed DLP ownership");
 if(![1,2,3,4,5,6].includes(workers)||!Number.isSafeInteger(timeBudgetMs)||timeBudgetMs<1||timeBudgetMs>LIMITS.maxMs||typeof retainLocal!=='boolean')throw Error('Invalid evaluation limits');
 const started=now(),generation=++nextGeneration,deadline=started+timeBudgetMs,initDeadline=started+Math.min(timeBudgetMs,LIMITS.initMs);
 return new Promise(resolve=>{
  const owners=[],pending=new Map(),events=[],phaseMemory=[],retirementErrors=[];let done=false,phase='initializing',issued=0,submitted=0,relations=0,target=0,factorBaseSize=0,familyBudget=0,drain=false,transport=0,peakTransport=0,submitJob=null,initializedMs=null,peakOwners=0,polynomialsSubmitted=0,rawRelationsSubmitted=0,bytesSubmitted=0,collectorStats=null,ledger=null,clock=null,dispatchCursor=0;const audit=new PacketAudit(capturePackets);
  const tick=()=>{if(clock)clock.transition(now(),owners,ledger.owned,policy.credit,ledger.reservedBytes);};
  const record=(type,data)=>{if(['ready','released','extracted','fatal'].includes(type))phaseMemory.push({type,...data});events.push({type,elapsedMs:now()-started,...data});if(events.length>4096)throw Error('Measurement event retention cap');};
  const post=(owner,type,data={},transfer=[])=>{owner.command=type;tick();owner.worker.postMessage({version:21,generation,type,...data},transfer);};
  const cleanupError=(owner,operation,error)=>retirementErrors.push({owner:owner.index,operation,error:String(error?.message??error).slice(0,120)});
  const releaseSource=owner=>{if(owner.sourceReleased)return true;if(owner.sourceReleaseFailed)return false;try{owner.worker.releaseSource?.();owner.sourceReleased=true;return true;}catch(error){owner.sourceReleaseFailed=true;cleanupError(owner,'releaseSource',error);return false;}};
  const retire=owner=>{
   if(!owner.retirementAttempted){owner.retirementAttempted=true;
    try{owner.worker.onmessage=null;owner.worker.onerror=null;owner.worker.onmessageerror=null;}catch(error){cleanupError(owner,'detach',error);}
    try{owner.worker.terminate();owner.retired=true;}catch(error){cleanupError(owner,'terminate',error);}
   }
   const source=releaseSource(owner);return owner.retired&&source;
  };
  const finish=(kind,reason=null,extra={})=>{
   if(done)return;clock?.finish(now());ledger?.close();done=true;clearTimeout(timer);clearTimeout(initTimer);signal?.removeEventListener('abort',cancel);for(const owner of owners)retire(owner);
   let factors=[],remaining=input,certainty=null;
   if(!retirementErrors.length&&extra.divisor){try{
    const n=BigInt(input),d=BigInt(extra.divisor);if(d<=1n||d>=n||n%d)throw Error('Divisor verification');
    let ticks=0;const budget={tick(){if(++ticks>100000||now()>deadline)throw Error('Verification budget');}};
    const assess=n=>{for(const p of SMALL_PRIMES){budget.tick();if(n===p)return'proven';if(n%p===0n)return'composite';}return assessPrime(n,budget);};
    factors=[d,n/d].sort((a,b)=>a<b?-1:1).map(n=>({value:n.toString(),certainty:assess(n),method:'independent-mr-fixed7'}));
    if(factors.some(f=>f.certainty==='composite')){kind='partial';reason='composite-divisor';factors=[];}
    else{remaining='1';kind=factors.every(f=>f.certainty==='proven')?'factorized':'probable';certainty=kind;}
   }catch(error){kind='incomplete';reason='verification-failed';factors=[];}}
   const finishedAt=now();
   if(finishedAt>=deadline&&kind!=='cancelled'){kind='timeout';reason='time-budget';factors=[];remaining=input;certainty=null;}
   if(retirementErrors.length){kind='incomplete';reason='worker-retirement';factors=[];remaining=input;certainty=null;}
   resolve({resourcePlan,coordinatorCompute,scheduler,fixedFamilies,ownerActivity:clock?.result()??null,activeAtStop:owners.map(o=>({owner:o.index,canCompute:o.canCompute,command:o.command,job:o.job?{first:o.job.first,count:o.job.count}:null})),creditState:ledger?{owned:[...ledger.owned],outstanding:ledger.issued-ledger.submitted,peakOutstanding:ledger.peakOutstanding,reservedBytes:ledger.reservedBytes,peakReservedBytes:ledger.peakReserved}:null,auditBytes:audit.bytes,packetArchives:audit.packets,auditProof:audit.finish(),profile,configuration:owners[0]?.config??null,collectorStats,wrapperTimingByOwner:owners.map(o=>({owner:o.index,timings:o.timings??null})),input,kind,reason,factors,remaining,certainty,workers,peakOwners,allWorkersDisposed:owners.every(o=>o.retired),allWorkerSourcesReleased:owners.every(o=>o.sourceReleased),retirementErrors,requestWallMs:finishedAt-started,initializationMs:initializedMs,familiesIssued:issued,familiesSubmitted:submitted,polynomialsSubmitted,rawRelationsSubmitted,bytesSubmitted,familyBudget,relations,target,transportCapBytes:LIMITS.transportBytes,peakTransportBytes:peakTransport,maximumWasmBytes:resourcePlan.totalWasmBytes,retainLocal,shareContext,factorBaseSize,phaseMemory,memoryByOwner:owners.map(o=>({owner:o.index,last:o.memory,peakLinearBytes:o.peakLinear??null,peakRequestedBytes:o.peakRequested??null})),events,...extra});
  };
  const cancel=()=>finish('cancelled','cancelled');
  const timer=setTimeout(()=>finish('timeout','time-budget'),timeBudgetMs),initTimer=setTimeout(()=>finish('timeout','initialization-timeout'),Math.min(timeBudgetMs,LIMITS.initMs));
  if(signal?.aborted){cancel();return;}signal?.addEventListener('abort',cancel,{once:true});
  function release(){
   clock?.finish(now());phase='releasing';for(const owner of owners)post(owner,'release');
  }
  function pump(){
   if(done||phase!=='collecting')return;tick();
   if(now()>=deadline){finish('timeout','time-budget');return;}
   const coord=owners[0];
   if(!coord.command&&pending.has(submitted)){
    const item=ledger.beginSubmission();if(!item)throw Error("Submission ledger");submitJob=item;
    post(coord,'submit',{jobId:item.jobId,first:item.first,count:item.count,buffer:item.buffer},[item.buffer]);return;
   }
   if(fixedFamilies===null&&relations>=target)drain=true;
   if((drain||issued>=ledger.budget)&&owners.every(o=>!o.job&&!o.command)&&!pending.size){if(fixedFamilies!==null&&submitted===fixedFamilies){finish('incomplete','fixed-family-bound');return;}release();return;}
   if(drain)return;
   for(let offset=0;offset<owners.length;offset++){const owner=owners[(dispatchCursor+offset)%owners.length];if(owner.job||owner.command||owner.retired||!owner.canCompute)continue;
    const job=ledger.issue(owner.index);if(!job)continue;issued=ledger.issued;owner.job=job;post(owner,'job',{...job,target,factorBaseSize,familyBudget});
   }
   dispatchCursor=(dispatchCursor+1)%owners.length;

  }
  function receive(owner,d){
   if(done||owner.retired)return;if(d?.generation!==generation)return;
   if(now()>=deadline){finish('timeout','time-budget');return;}
   if(phase==='initializing'&&now()>=initDeadline){finish('timeout','initialization-timeout');return;}
   if(!d||d.version!==21||typeof d.type!=='string')throw Error('Worker protocol');
   validateDlpTimings(d.timings,owner.timings);owner.timings=d.timings;
    for(const m of [d.memory,d.before,d.after].filter(Boolean))validateMemory(m);
   for(const m of [d.memory,d.before,d.after].filter(Boolean)){if(!Number.isInteger(m.linearBytes)||m.linearBytes>resourcePlan.ownerCapsMiB[owner.index]*1048576)throw Error('Worker memory bound');owner.memory=m;owner.peakLinear=Math.max(owner.peakLinear??0,m.linearBytes);owner.peakRequested=Math.max(owner.peakRequested??0,m.peakRequested);}
   if(d.type!=='fatal'&&owner.index===0&&[d.memory,d.before,d.after].filter(Boolean).some(m=>m.liveRequested>=resourcePlan.ownerCapsMiB[0]*655360||m.linearBytes>=resourcePlan.ownerCapsMiB[0]*851968)){record('resource-stop',{owner:0,memory:owner.memory});finish('incomplete','coordinator-memory-soft-stop');return;}
   if(d.type==='fatal'){record('fatal',{owner:owner.index,...d});finish('incomplete',d.reason,{fatal:d});return;}
   if(d.type==='ready'){
    if(owner.command!=='init'||d.role!==(owner.index===0?'coord':'sieve')||d.maxMiB!==resourcePlan.ownerCapsMiB[owner.index])throw Error('Unexpected ready role/cap');validateDlpConfiguration(d.config,profile,inputInfo.bits);owner.config=d.config;if(!releaseSource(owner)){finish('incomplete','worker-retirement');return;}owner.command=null;owner.ready=true;record('ready',{owner:owner.index,memory:d.memory,config:d.config,timings:d.timings});
    if(owner.index===0){validateDlpStats(d.dlpStats,null,0,0);collectorStats=d.dlpStats;target=d.target;factorBaseSize=d.factorBaseSize;familyBudget=d.familyBudget;if(!Number.isInteger(target)||target<1||target>1000000||!Number.isInteger(factorBaseSize)||factorBaseSize<1||target!==factorBaseSize+64||familyBudget!==(inputInfo.bits<=288?100000:inputInfo.bits<=368?250000:750000))throw Error('Coordinator limits');}
    if(owners.length===workers&&owners.every(o=>o.ready)){for(const o of owners)if(JSON.stringify(o.config)!==JSON.stringify(owners[0].config))throw Error('Owner configuration mismatch');if(owners[0].config.factorBaseSize!==factorBaseSize)throw Error('Configured factor-base mismatch');if(now()>=initDeadline){finish('timeout',now()>=deadline?'time-budget':'initialization-timeout');return;}clearTimeout(initTimer);initializedMs=now()-started;ledger=new CreditLedger(workers,scheduler,Math.min(familyBudget,familyLimit??familyBudget,fixedFamilies??familyBudget),pending,{slots:resourcePlan.outstandingSlots});clock=new OwnerClock(workers,now(),resourcePlan.transportBytes);phase='collecting';pump();}return;
   }
   if(d.type==='batch'){
    if(owner.command!=='job'||!owner.job||d.jobId!==owner.job.jobId||d.first!==owner.job.first||d.count!==owner.job.count||!(d.buffer instanceof ArrayBuffer))throw Error('Unissued batch');
    const checked=validatePacket(new Uint8Array(d.buffer),{first:d.first,count:d.count,target:factorBaseSize});if(pending.has(d.first))throw Error('Duplicate batch');
    ledger.returned(owner.index,owner.job,{buffer:d.buffer,stats:checked});try{audit.add(owner.job,new Uint8Array(d.buffer));}catch{return finish('incomplete','audit-retention-cap');}
    owner.job=null;owner.command=null;transport=ledger.transport;peakTransport=ledger.peakTransport;record('batch',{owner:owner.index,first:d.first,count:d.count,memory:d.memory,stats:checked,timings:d.timings});pump();return;
   }
   if(d.type==='submitted'){
    if(owner.index!==0||owner.command!=='submit'||!submitJob||d.jobId!==submitJob.jobId||!Number.isInteger(d.relations)||d.relations<relations||d.relations>1000000)throw Error('Submit acknowledgement');
    const item=ledger.ack(d.jobId);transport=ledger.transport;submitted=ledger.submitted;polynomialsSubmitted+=item.stats.polynomials;rawRelationsSubmitted+=item.stats.relations;bytesSubmitted+=item.bytes;relations=d.relations;validateDlpStats(d.dlpStats,collectorStats,rawRelationsSubmitted,relations);collectorStats=d.dlpStats;submitJob=null;owner.command=null;
    record('submitted',{families:submitted,relations,memory:d.memory,collectorStats,timings:d.timings});onProgress({families:submitted,relations,target,memory:d.memory,collectorStats,timings:d.timings});pump();return;
   }
   if(d.type==='released'){
    if(phase!=='releasing'||owner.command!=='release')throw Error('Release acknowledgement');
    owner.command=null;owner.released=true;record('released',{owner:owner.index,before:d.before,after:d.after});
    if(owner.index!==0&&!retire(owner)){finish('incomplete','worker-retirement');return;}
    if(owners.every(o=>o.released)){phase='extracting';post(owners[0],'extract');}return;
   }
   if(d.type==='extracted'){
    if(phase!=='extracting'||owner.index!==0||owner.command!=='extract')throw Error('Extraction acknowledgement');
    record('extracted',{status:d.status,before:d.before,after:d.after});
    const reasons={2:'insufficient-relations',3:'no-dependency',4:'no-factor',5:'algorithm-resource',6:'invalid-dependency',7:'cancelled',8:'native-unknown',9:'missing-session'};
    if(d.status===1&&d.divisor)finish('partial',null,{divisor:d.divisor,extractionStatus:d.status});
    else if(reasons[d.status]&&!d.divisor)finish('incomplete',reasons[d.status],{extractionStatus:d.status});
    else throw Error('Extraction status');return;
   }
   throw Error('Unknown Worker result');
  }
  try{for(let index=0;index<workers;index++){
   if(done)break;if(now()>=deadline){finish('timeout','time-budget');break;}
   const worker=createWorker(index,resourcePlan.ownerCapsMiB[index]),owner={index,canCompute:coordinatorCompute||index!==0,worker,retired:false,command:null,job:null,ready:false,released:false};owners.push(owner);peakOwners=Math.max(peakOwners,owners.filter(o=>!o.retired).length);
   worker.onmessage=e=>{try{receive(owner,e.data);}catch(error){finish('incomplete','protocol-failure',{error:String(error.message)});}};
   worker.onerror=()=>finish('incomplete','worker-error');worker.onmessageerror=()=>finish('incomplete','message-error');
   post(owner,'init',{input,profile,scheduler,maxMiB:resourcePlan.ownerCapsMiB[index],role:index===0?'coord':'sieve',retainLocal,shareContext});
  }}catch(error){finish('incomplete','worker-creation',{error:String(error.message)});}
 });
}
