// SPDX-License-Identifier: AGPL-3.0-only
// Existing GMP splitter, not a new arithmetic implementation. Assets load before any job.
import {createGmpSplit} from '../engine/gmp.mjs';
import {GMP_BASE64} from '../engine/gmp-bytes.mjs';
function ecmWorkerMain(){
 let used=false;
 globalThis.onmessage=async({data:d})=>{
  if(used)return;used=true;let operations=0;
  const send=data=>postMessage({version:1,jobId:d?.jobId,input:d?.input,...data});
  const started=performance.now();let reason='worker-error';
  try{
   if(!d||d.version!==1||d.type!=='start'||!Number.isSafeInteger(d.jobId)||d.jobId<1||typeof d.input!=='string'||d.input.length>78||!/^[1-9][0-9]*$/.test(d.input))throw Error('ECM request');
   const n=BigInt(d.input);
   if(n<5n||n>=(1n<<256n)||n%2n===0n||!Number.isSafeInteger(d.timeBudgetMs)||d.timeBudgetMs<1||d.timeBudgetMs>60000||!Number.isSafeInteger(d.operationBudget)||d.operationBudget<1||d.operationBudget>50000000)throw Error('ECM range/budget');
   const deadline=started+d.timeBudgetMs;
   const split=await createGmpSplit();
   send({type:'ready',wasmBytes:67108864});
   const budget={tick(){
    if(performance.now()>=deadline){reason='phase-time-budget';throw Error(reason);}
    if(operations>=d.operationBudget){reason='operation-budget';throw Error(reason);}
    operations++;
   }};
   let divisor=null;
   try{budget.tick();divisor=split(n,budget,{algorithm:'gmp-ecm',seed:1});reason='exhausted';}
   catch(error){if(!['phase-time-budget','operation-budget'].includes(reason))reason='worker-error';}
   send({type:'result',reason,divisor:divisor===null?null:divisor.toString(),operations,wasmBytes:67108864,stats:split.stats()});
  }catch{send({type:'result',reason,divisor:null,operations,wasmBytes:null});}
 };
}
export const ECM_WORKER_SOURCE="'use strict';\nconst GMP_BASE64="+JSON.stringify(GMP_BASE64)+";\nconst createGmpSplit="+createGmpSplit.toString()+";\n("+ecmWorkerMain.toString()+")();\n";
