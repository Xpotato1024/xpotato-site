import {publicTargetBodyLimit} from './prime-public-target-policy.mjs';
import {stop} from './manual-deployment-provider.mjs';
import {publicationMediaOrigin} from './publication-media-policy.mjs';
// A complete initial pass and one re-observation pass, plus before(3)/after(2).
// These are finite application budgets, checked against the actual artifact in CI.
export const publicReadbackPolicy=Object.freeze({maxTargets:160,maxTargetBytes:16*1024*1024,maxReads:325,maxObservedBytes:42*1024*1024,phaseMs:120000,requestMs:10000,maxAttempts:3,reobserveMs:1000});
export function assertPublicTargetPlan(targets){
 if(!Array.isArray(targets)||targets.length<1||targets.length>publicReadbackPolicy.maxTargets)stop('PUBLIC_TARGET_BUDGET');
 const paths=new Set();let bytes=0;
 for(const target of targets){
  const media=typeof target?.path==='string'&&target.path.startsWith(publicationMediaOrigin)&&/^\/media\/v1\/objects\/sha256\/([a-f0-9]{2})\/([a-f0-9]{64})\.(?:png|webp|avif|jpg|jpeg|svg)$/.exec(target.path.slice(publicationMediaOrigin.length));
  if(!target||typeof target.path!=='string'||target.path.length>512||(!target.path.startsWith('/')&&!media)||target.path.startsWith('//')||/[\\?#\r\n%]/.test(target.path)
   ||target.path.split('/').some(p=>p==='.'||p==='..')||paths.has(target.path)||!/^[a-f0-9]{64}$/.test(target.sha256)
   ||!Number.isSafeInteger(target.bytes)||target.bytes<1)stop('PUBLIC_TARGET_PLAN_INVALID');
  if(media&&(media[1]!==target.sha256.slice(0,2)||media[2]!==target.sha256))stop('PUBLIC_TARGET_PLAN_INVALID');
  paths.add(target.path);publicTargetBodyLimit(target.path,target.bytes);bytes+=target.bytes;
  if(bytes>publicReadbackPolicy.maxTargetBytes)stop('PUBLIC_TARGET_BYTES_BUDGET');
 }
 return {targets:targets.length,bytes};
}
