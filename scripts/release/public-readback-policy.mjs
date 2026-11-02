import {publicTargetBodyLimit} from './prime-public-target-policy.mjs';
import {stop} from './manual-deployment-provider.mjs';
// Application budgets, not provider quotas. 96 targets + before(3) + after(2)
// = 101 GETs, leaving 43 below the unchanged lifetime hard cap of 144.
export const publicReadbackPolicy=Object.freeze({maxTargets:96,maxTargetBytes:16*1024*1024,maxReads:144,phaseMs:120000,requestMs:10000});
export function assertPublicTargetPlan(targets){
 if(!Array.isArray(targets)||targets.length<1||targets.length>publicReadbackPolicy.maxTargets)stop('PUBLIC_TARGET_BUDGET');
 const paths=new Set();let bytes=0;
 for(const target of targets){
  if(!target||typeof target.path!=='string'||!target.path.startsWith('/')||target.path.startsWith('//')||/[\\?#\r\n%]/.test(target.path)
   ||target.path.split('/').some(p=>p==='.'||p==='..')||paths.has(target.path)||!/^[a-f0-9]{64}$/.test(target.sha256)
   ||!Number.isSafeInteger(target.bytes)||target.bytes<1)stop('PUBLIC_TARGET_PLAN_INVALID');
  paths.add(target.path);publicTargetBodyLimit(target.path,target.bytes);bytes+=target.bytes;
  if(bytes>publicReadbackPolicy.maxTargetBytes)stop('PUBLIC_TARGET_BYTES_BUDGET');
 }
 return {targets:targets.length,bytes};
}
