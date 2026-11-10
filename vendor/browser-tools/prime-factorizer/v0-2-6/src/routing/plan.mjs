// SPDX-License-Identifier: AGPL-3.0-only
import {inspectExtendedInput} from '../core/extended-input-contract.mjs';
import {selectResourcePlan as normalResources} from '../graph-multicore/policy.mjs';
import {selectResourcePlan as wideResources} from '../selected-wide/policy.mjs';
export const ROUTING_WORK=Object.freeze({native:50000,staged:50000000,ecm:500000,siqs:4096});
export const ENGINE_CAPABILITIES=Object.freeze({
 native:Object.freeze({maxBits:1024,maxMs:5000,key:'native',maxWork:1000000,minWork:1}),
 staged128:Object.freeze({maxBits:128,maxMs:60000,key:'staged',maxWork:50000000,minWork:1}),
 ecm:Object.freeze({maxBits:256,maxMs:60000,key:'ecm',maxWork:50000000,minWork:1}),
 siqs332:Object.freeze({maxBits:332,maxMs:600000,key:'siqs',maxWork:4096,minWork:4}),
 siqsWide332:Object.freeze({maxBits:332,maxMs:3600000,key:'siqs',maxWork:4096,minWork:4}),
 siqs400:Object.freeze({maxBits:400,maxMs:3600000,key:'siqs',maxWork:4096,minWork:4,experimental:true})
});
export function makeRoutingPolicy(options={}){
 const allowed=['jobTimeMs','wasmMiB','maxWorkers','wasmSupported','simdSupported','experimental400','nativePrefixMs','ecmPrefixMs','reserveDivisor','maxStages','retirementGraceMs','work'];
 if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(k=>!allowed.includes(k)))throw TypeError('Routing policy');
 const p={jobTimeMs:1000,wasmMiB:128,maxWorkers:1,wasmSupported:true,simdSupported:true,experimental400:false,nativePrefixMs:250,ecmPrefixMs:250,reserveDivisor:4,maxStages:32,retirementGraceMs:100,...options};
 for(const[k,min,max]of [['jobTimeMs',1,3600000],['maxWorkers',1,6],['nativePrefixMs',1,5000],['ecmPrefixMs',1,60000],['reserveDivisor',2,16],['maxStages',1,64],['retirementGraceMs',1,1000]])if(!Number.isSafeInteger(p[k])||p[k]<min||p[k]>max)throw RangeError('Routing '+k);
 if(![0,64,128,256,384,512,768,1536].includes(p.wasmMiB))throw RangeError('Routing WASM budget');
 for(const k of ['wasmSupported','simdSupported','experimental400'])if(typeof p[k]!=='boolean')throw TypeError('Routing '+k);
 const work={...ROUTING_WORK,...p.work};
 if(p.work&&Object.keys(p.work).some(k=>!Object.hasOwn(ROUTING_WORK,k)))throw TypeError('Routing work unit');
 for(const[k,max]of Object.entries({native:1000000,staged:50000000,ecm:50000000,siqs:4096}))if(!Number.isSafeInteger(work[k])||work[k]<0||work[k]>max)throw RangeError('Routing work '+k);
 return Object.freeze({...p,work:Object.freeze(work)});
}
export function chooseStage({remaining,available=[],attempted=[],policy=makeRoutingPolicy(),remainingMs,work=policy.work}){
 const info=inspectExtendedInput(remaining);if(info.canonical!==remaining)throw Error('Canonical residual required');
 const n=BigInt(remaining),bits=info.bits;
 if(n<2n)return Object.freeze({terminal:n===1n?'factor-proof-required':'neither'});
 if(!Number.isFinite(remainingMs)||remainingMs<1)return Object.freeze({terminal:'job-time-budget'});
 if(!Array.isArray(available)||available.some(k=>!Object.hasOwn(ENGINE_CAPABILITIES,k)))throw Error('Unknown routing port');
 const candidates=[];
 const add=(stage,memoryMiB=0,needsWasm=false,simd=false)=>{
  const c=ENGINE_CAPABILITIES[stage];
  if(!available.includes(stage)||bits>c.maxBits||needsWasm&&(!policy.wasmSupported||policy.wasmMiB<memoryMiB)||simd&&!policy.simdSupported||c.experimental&&!policy.experimental400)return;
  if(attempted.includes(stage+':'+remaining)||stage.startsWith('siqs')&&Object.keys(ENGINE_CAPABILITIES).filter(k=>k.startsWith('siqs')).some(k=>attempted.includes(k+':'+remaining))||work[c.key]<c.minWork)return;
  candidates.push({stage,memoryMiB,cap:c});
 };
 // The staged macro already contains bounded Brent/ECM/SIQS for n < 2^128.
 if(n<(1n<<128n))add('staged128',bits<=64?0:128,bits>64);
 add('native');
 if(n>=5n&&n%2n===1n)add('ecm',64,true);
 if(bits<=332)add('siqsWide332',1536,true,true);
 if(bits<=332)add('siqs332',128,true,true);
 add('siqs400',1536,true,true);
 if(!candidates.length){
  const simdNeeded=bits<=400&&!policy.simdSupported&&available.some(k=>k.startsWith('siqs'));
  return Object.freeze({terminal:bits>400?'gnfs-unavailable':simdNeeded?'simd-unavailable':'enabled-engines-exhausted'});
 }
 const selected=candidates[0],{stage,cap}=selected;
 let timeBudgetMs=Math.min(cap.maxMs,Math.floor(remainingMs));
 if((stage==='native'||stage==='ecm')&&candidates.length>1){
  const prefix=stage==='native'?policy.nativePrefixMs:policy.ecmPrefixMs;
  timeBudgetMs=Math.min(timeBudgetMs,prefix,Math.max(1,Math.floor(remainingMs/policy.reserveDivisor)));
 }
 let resourcePlan=null;
 if(stage==='siqs400'||stage==='siqsWide332')resourcePlan=wideResources({mode:'manual',workers:Math.min(5,policy.maxWorkers),memoryMiB:1536,timeBudgetMs,outstandingSlots:4});
 if(stage==='siqs332'){
  const memoryMiB=[128,256,384,512,768].filter(n=>n<=policy.wasmMiB).at(-1);
  for(let workers=policy.maxWorkers;workers>=1;workers--){
   try{resourcePlan=normalResources({mode:'manual',workers,memoryMiB,timeBudgetMs,outstandingSlots:4});break;}catch{}
  }
  if(!resourcePlan)throw Error('No bounded SIQS allocation');
 }
 const wasmAllocationBytes=resourcePlan?.totalWasmBytes??selected.memoryMiB*1048576;
 if(wasmAllocationBytes>policy.wasmMiB*1048576)throw Error('Routing WASM allocation');
 return Object.freeze({stage,input:remaining,bits,timeBudgetMs,workKey:cap.key,workBudget:Math.min(work[cap.key],cap.maxWork),
  requiredWasmMiB:selected.memoryMiB,wasmAllocationBytes,resourcePlan,jobWasmBudgetMiB:policy.wasmMiB,maxWorkers:resourcePlan?.workers??1,
  experimental:cap.experimental===true,reservedForFollowing:Math.max(0,remainingMs-timeBudgetMs)});
}
