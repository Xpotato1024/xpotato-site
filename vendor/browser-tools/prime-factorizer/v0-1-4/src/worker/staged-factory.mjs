import {STAGED_SOURCE as BRENT} from './staged-brent-source.mjs';
import {STAGED_SOURCE as ECM} from './staged-ecm-source.mjs';
import {STAGED_SOURCE as SIQS} from './staged-siqs-source.mjs';
import {STAGED_SOURCE as STAGED} from './staged-staged-source.mjs';
import {makeWorkerFromSource} from './source-factory.mjs';
import {selectStagedPlan} from '../engine/staged-plan.mjs';
export function makeStagedWorker(plan,{fault=false}={},dependencies) {
 const expected=selectStagedPlan(plan.input,{...plan.options,mode:plan.mode});
 if(plan.engineMode!==expected.engineMode||plan.linearMemoryBytes!==expected.linearMemoryBytes||typeof fault!=='boolean')throw TypeError('Staged factory profile');
 const source={brent:BRENT,ecm:ECM,siqs:SIQS,staged:STAGED}[plan.engineMode];
 const boot='\ncreateStagedBackends('+JSON.stringify(plan.engineMode)+','+JSON.stringify({fault})+').then(backends=>installStagedWorker(backends,'+JSON.stringify(plan.mode)+')).catch(()=>self.postMessage({protocolVersion:2,type:"error",jobId:null,code:"initialization-error"}));';
 return makeWorkerFromSource(source+boot,dependencies);
}
