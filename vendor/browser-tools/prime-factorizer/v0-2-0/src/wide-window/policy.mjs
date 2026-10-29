// SPDX-License-Identifier: AGPL-3.0-only
const MiB=1048576,keys=['mode','workers','memoryMiB','timeBudgetMs','outstandingSlots'];
export function selectResourcePlan(settings={}){
 if(!settings||typeof settings!=='object'||Array.isArray(settings)||Object.keys(settings).some(k=>!keys.includes(k)))throw Error('Unknown wide resource settings');
 const {mode,workers=5,memoryMiB,timeBudgetMs=3600000,outstandingSlots=8}=settings;
 if(mode!=='manual'||memoryMiB!==1536||!Number.isInteger(workers)||workers<1||workers>5||!Number.isSafeInteger(timeBudgetMs)||timeBudgetMs<1||timeBudgetMs>3600000||![4,8].includes(outstandingSlots))throw Error('Explicit finite wide settings required');
 const ownerCapsMiB=[1024,...Array(workers-1).fill(64)],totalWasmBytes=ownerCapsMiB.reduce((n,x)=>n+x,0)*MiB;
 if(totalWasmBytes>1536*MiB)throw Error('Wide WASM allocation cap');
 return Object.freeze({version:38,mode,workers,budgetBytes:1536*MiB,ownerCapsMiB:Object.freeze(ownerCapsMiB),totalWasmBytes,transportBytes:outstandingSlots*8388608,packetBytes:8388608,outstandingSlots,timeBudgetMs,operationBudget:50000000});
}
export function validateResourcePlan(p){
 if(!p||typeof p!=='object')throw Error('Wide resource plan required');
 const expected=selectResourcePlan({mode:p.mode,workers:p.workers,memoryMiB:p.budgetBytes/MiB,timeBudgetMs:p.timeBudgetMs,outstandingSlots:p.outstandingSlots});
 if(Object.keys(p).length!==Object.keys(expected).length||Object.keys(expected).some(k=>JSON.stringify(p[k])!==JSON.stringify(expected[k])))throw Error('Forged wide resource plan');
 return p;
}
