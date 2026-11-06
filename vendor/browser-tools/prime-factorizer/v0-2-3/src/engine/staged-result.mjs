import {verifyFactorResult,verifySnapshot} from './result.mjs';
import {STAGED_MODES,parseStagedInput} from './staged-plan.mjs';
export function verifyStagedResult(result,expectedInput) {
 parseStagedInput(expectedInput);
 if(!result||!STAGED_MODES.includes(result.policy))throw TypeError('Staged result policy');
 const algorithm=result.policy.startsWith('p')?'staged':result.policy==='ecm'?'gmp-ecm':result.policy;
 if(result.algorithm!==algorithm)throw TypeError('Staged result identity');
 const numeric=verifyFactorResult({...result,algorithm:algorithm==='staged'?'siqs':algorithm},expectedInput);
 if(!Array.isArray(result.stages)||result.stages.length>384||!Array.isArray(result.grants)||result.grants.length!==2)throw TypeError('Staged trace bound');
 let lastOps=0,lastMs=0;
 const stages=result.stages.map((s,index)=>{
  if(s.index!==index||!['brent-full','brent-prefix','ecm','ecm-prefix','siqs'].includes(s.stage)||
   !['split','exhausted','stopped','resource','fatal'].includes(s.outcome)||!Number.isSafeInteger(s.startOps)||!Number.isSafeInteger(s.endOps)||
   s.startOps<lastOps||s.endOps<s.startOps||s.endOps>result.operations||
   !Number.isFinite(s.startMs)||!Number.isFinite(s.endMs)||s.startMs<lastMs||s.endMs<s.startMs||s.endMs>result.elapsedMs||
   s.reason!==null&&!['operation-budget','time-budget','algorithm-range','algorithm-exhausted','algorithm-resource'].includes(s.reason))throw TypeError('Staged trace');
  const value=parseStagedInput(s.input);if(value<2n||BigInt(expectedInput)%value!==0n)throw TypeError('Staged residual');
  lastOps=s.endOps;lastMs=s.endMs;return{...s};
 });
 const grants=result.grants.map((g,i)=>{
  if(g.name!==['brent-prefix','ecm-prefix'][i]||g.operationLimit!==[50000,500000][i]||g.timeLimitMs!==[20,80][i]||
   !Number.isSafeInteger(g.operations)||g.operations<0||g.operations>g.operationLimit||!Number.isFinite(g.elapsedMs)||g.elapsedMs<0||typeof g.disabled!=='boolean')throw TypeError('Staged grant');
  return{...g};
 });
 return{...numeric,algorithm,policy:result.policy,stages,grants};
}
export function verifyStagedSnapshot(snapshot,input){parseStagedInput(input);return verifySnapshot(snapshot,input);}

export function verifyStagedOutcome(result,expectedInput) {
 if(result?.origin==='worker'){
  if(result.traceAvailable!==true)throw TypeError('Worker trace contract');
  return{...result,...verifyStagedResult(result,expectedInput),origin:'worker',traceAvailable:true};
 }
 if(result?.origin!=='host'||result.traceAvailable!==false||result.stages!==null||result.grants!==null)throw TypeError('Host trace contract');
 const snapshot=verifyStagedSnapshot(result,expectedInput),n=parseStagedInput(expectedInput);
 const algorithm=result.policy?.startsWith('p')?'staged':result.policy==='ecm'?'gmp-ecm':result.policy;
 if(!STAGED_MODES.includes(result.policy)||result.algorithm!==algorithm||!Number.isSafeInteger(result.seed)||result.seed<1||result.seed>4294967295)throw TypeError('Host identity');
 if(n<2n){
  if(result.status!=='neither'||result.reason!==null||result.primality!=='neither'||snapshot.operations!==0)throw TypeError('Host neither');
 }else{
  if(BigInt(snapshot.remaining)<2n||result.primality!==(snapshot.factors.length?'composite':'unknown'))throw TypeError('Host residual');
  if(!((result.status==='cancelled'&&result.reason==='cancelled')||
   (result.status==='incomplete'&&['host-timeout','operation-budget'].includes(result.reason))))throw TypeError('Host status');
  if(result.reason==='operation-budget'&&snapshot.operations!==0)throw TypeError('Host zero budget');
 }
 return{...result,...snapshot,origin:'host',traceAvailable:false,stages:null,grants:null};
}
