// SPDX-License-Identifier: AGPL-3.0-only
const scopes=new WeakMap();
export function makeComputeScope(){
 let active=null,quarantined=false;
 return Object.freeze({
  isQuarantined:()=>quarantined,
  owns(token){return !quarantined&&active===token;},
  acquire(token){if(quarantined||active!==null)return false;active=token;return true;},
  release(token){if(!quarantined&&active===token)active=null;},
  quarantine(){quarantined=true;},
 });
}
export function documentComputeScope(document){
 if(!scopes.has(document))scopes.set(document,makeComputeScope());
 return scopes.get(document);
}
