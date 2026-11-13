import {assertObjectMatches,type PublicationStorage,type PublishObject} from '../media/r2-sdk-store.js';
export type PublicationProgress={phase:'store'|'verified'|'final_readback';plane:PublishObject['plane'];key:string;sha256:string};
/** Validated objects only. Both callers validate all package bytes before this
 * shared A/B/C operation. This helper grants no article approval or export. */
export async function storeVerifiedMediaObjects(objects:PublishObject[],input:{storage:PublicationStorage;mode:'publish'|'verify-only';now?:()=>Date;progress?:(event:PublicationProgress)=>Promise<void>}){
 const now=input.now??(()=>new Date());
 const outcomes=new Map<string,{action:'uploaded'|'reused';verifiedAt:string}>();
 const verify=async(o:PublishObject)=>{const r=await input.storage.read(o);if(r.status==='absent')throw Error('R2_OBJECT_ABSENT');assertObjectMatches(o,r);return r;};
 const store=async(o:PublishObject)=>{
  await input.progress?.({phase:'store',plane:o.plane,key:o.key,sha256:o.sha256});
  const action=input.mode==='verify-only'?(await verify(o),'reused' as const):await input.storage.putIfAbsent(o);
  await verify(o);outcomes.set(o.plane+':'+o.key,{action,verifiedAt:now().toISOString()});
  await input.progress?.({phase:'verified',plane:o.plane,key:o.key,sha256:o.sha256});
 };
 for(const o of objects.filter(o=>o.plane==='source'))await store(o);
 for(const o of objects.filter(o=>o.plane==='public')){await store(o);assertObjectMatches(o,await input.storage.readPublic(o));}
 const protectedObjects:PublishObject[]=[];
 for(const o of objects.filter(o=>o.plane==='public')){
  const actual=await verify(o);if(actual.status!=='found')throw Error('CI_PUBLICATION_PUBLIC_BYTES_REQUIRED');
  const copy:PublishObject={...o,plane:'protected',bytes:actual.bytes,cacheControl:'private, no-store'};await store(copy);protectedObjects.push(copy);
 }
 // All data is re-read before emitting any canonical files. A partial/unknown
 // operation produces no export; neither ETag nor hash-shaped keys are proof.
 for(const o of [...objects,...protectedObjects]){await input.progress?.({phase:'final_readback',plane:o.plane,key:o.key,sha256:o.sha256});await verify(o);}
 for(const o of objects.filter(o=>o.plane==='public'))assertObjectMatches(o,await input.storage.readPublic(o));
 return {objects,protectedObjects,outcomes};
}
