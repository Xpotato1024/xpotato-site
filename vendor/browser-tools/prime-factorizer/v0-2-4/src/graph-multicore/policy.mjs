// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Xpotato.net / Xpotato1024
const MiB=1048576,tiers=[128,256,384,512,768],keys=['mode','workers','memoryMiB','timeBudgetMs','outstandingSlots'];
export function selectResourcePlan(settings={},hints={}){
 if(!settings||typeof settings!=='object'||Array.isArray(settings)||Object.keys(settings).some(k=>!keys.includes(k)))throw Error('Unknown resource settings');
 const {mode='auto',workers:requested=1,memoryMiB:requestedMemory=128,timeBudgetMs=1000,outstandingSlots=4}=settings;
 if(![4,8].includes(outstandingSlots)||mode==='auto'&&outstandingSlots!==4)throw Error('Finite global slots');
 if(!['auto','manual'].includes(mode)||!Number.isInteger(requested)||requested<1||requested>6||!tiers.includes(requestedMemory)||!Number.isSafeInteger(timeBudgetMs)||timeBudgetMs<1||timeBudgetMs>600000)throw Error('Finite resource settings required');
 const cores=Number.isInteger(hints?.hardwareConcurrency)&&hints.hardwareConcurrency>=1&&hints.hardwareConcurrency<=1024?hints.hardwareConcurrency:1;
 const ram=typeof hints?.deviceMemory==='number'&&Number.isFinite(hints.deviceMemory)&&hints.deviceMemory>0&&hints.deviceMemory<=1024?hints.deviceMemory:null;
 const memoryMiB=mode==='manual'?requestedMemory:ram===null||ram<=2?128:ram<=4?256:512;
 let workers=mode==='manual'?requested:Math.min(2,Math.max(1,cores-1));
 if(mode==='auto'&&memoryMiB===128)workers=1;
 const coordinator=workers>=4||memoryMiB>=256+64*(workers-1)?256:128;
 const ownerCapsMiB=[coordinator,...Array(workers-1).fill(64)],totalWasmBytes=ownerCapsMiB.reduce((n,x)=>n+x,0)*MiB;
 if(totalWasmBytes>memoryMiB*MiB)throw Error('Worker allocation exceeds WASM budget');
 return Object.freeze({version:1,mode,workers,budgetBytes:memoryMiB*MiB,ownerCapsMiB:Object.freeze(ownerCapsMiB),totalWasmBytes,transportBytes:outstandingSlots*8388608,packetBytes:8388608,outstandingSlots,timeBudgetMs,operationBudget:50000000});
}
export function validateResourcePlan(p){
 if(!p||typeof p!=='object'||!['auto','manual'].includes(p.mode))throw Error('Resource plan required');
 if(p.mode==='auto'&&(p.outstandingSlots!==4||p.workers>2||![128,256,512].includes(p.budgetBytes/MiB)||p.budgetBytes===128*MiB&&p.workers!==1))throw Error('Automatic resource bounds');
 const expected=selectResourcePlan({mode:'manual',workers:p.workers,memoryMiB:p.budgetBytes/MiB,timeBudgetMs:p.timeBudgetMs,outstandingSlots:p.outstandingSlots});
 if(Object.keys(p).length!==Object.keys(expected).length||Object.keys(expected).some(k=>JSON.stringify(p[k])!==JSON.stringify(k==='mode'?p.mode:expected[k])))throw Error('Forged resource plan');
 return p;
}
