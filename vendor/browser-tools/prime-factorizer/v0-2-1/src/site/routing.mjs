// SPDX-License-Identifier: AGPL-3.0-only
import {createVerifiedRoutingSession,verifyRoutingResult} from '../routing/verification.mjs';
import {createNativePort} from '../routing/native-port.mjs';
import {createEcmPort} from '../routing/ecm-port.mjs';
import {createStagedPort} from '../routing/staged-port.mjs';
import {createSiqsPort} from '../routing/siqs-ports.mjs';
export {verifyRoutingResult};
export function createSiteRouter({scope,now,engine,light,extended,heavy,experimental}){
 const ports={staged128:createStagedPort({run:light.runSelectedStagedRequest,now}),native:createNativePort({api:extended,now}),ecm:createEcmPort({now})};
 if(engine==='wide'){ports.siqsWide332=createSiqsPort('siqsWide332',{api:heavy,now});ports.siqs400=createSiqsPort('siqs400',{api:experimental,now});}
 else ports.siqs332=createSiqsPort('siqs332',{api:heavy,now});
 return createVerifiedRoutingSession({ports,scope,now});
}
export function detectRoutingCapabilities(runtime=globalThis){
 const wasmSupported=typeof runtime.WebAssembly?.validate==='function';let simdSupported=false;
 if(wasmSupported)try{simdSupported=runtime.WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,22,1,20,0,253,12,...Array(16).fill(0),11]));}catch{}
 return Object.freeze({wasmSupported,simdSupported:simdSupported===true});
}
export function siteRoutingOptions(engine,plan,capabilities=detectRoutingCapabilities()){
 return {jobTimeMs:plan.timeBudgetMs,wasmMiB:plan.budgetBytes/1048576,maxWorkers:plan.workers,experimental400:engine==='wide',...capabilities};
}
