import {it,expect} from 'vitest';
import {articleMediaTargets} from '@xpotato/content-contracts/article-media-targets';
import {operatorMediaRequest} from './publication-operator-plan.js';
import {inspectMediaSessionRequest} from './media-session-factory.js';
const a='a'.repeat(64),b='b'.repeat(64),key='media/v1/objects/sha256/bb/'+b+'.png';
function setup(){return {plan:{profile:articleMediaTargets,confirmed:true,
 sourceObjects:[{objectKey:'source/v1/objects/sha256/aa/'+a+'.webp',sha256:a,sizeBytes:24}],
 publicObjects:[{objectKey:key,sha256:b,sizeBytes:48,contentType:'image/png',cacheControl:articleMediaTargets.public.cacheControl}],
 protectedObjects:[{objectKey:key,sha256:b,sizeBytes:48}]},
 binding:{jobId:'job-inert',jobFingerprint:a,candidateSha256:a,approvalSha256:b,attemptId:'attempt-inert',inputSha256:a,policySha256:b},
 notAfter:new Date(Date.now()+60000).toISOString()};}
it('projects one exact stage and a separate B read set for C without broadening the physical plan',()=>{
 const x=setup(),source=operatorMediaRequest({...x,plane:'source'}),pub=operatorMediaRequest({...x,plane:'public'}),pro=operatorMediaRequest({...x,plane:'protected'});
 expect(source.objects.map(o=>o.plane)).toEqual(['source']);expect(pub.objects.map(o=>o.plane)).toEqual(['public']);
 expect(pro.objects.map(o=>o.plane)).toEqual(['public','protected']);expect(pro.objects.map(o=>o.key)).toEqual([key,key]);
 expect(pro.objects[1]?.cacheControl).toBe('private, no-store');expect(pro.binding).toEqual(x.binding);
 expect(new Set([source.requestId,pub.requestId,pro.requestId]).size).toBe(3);
 const copy=pro.binding;copy.candidateSha256=b;expect(x.binding.candidateSha256).toBe(a);
 expect(inspectMediaSessionRequest(pub)).toEqual(pub);
});
it('rejects incomplete, duplicated, changed or unconfirmed storage plans and noncanonical key/MIME metadata',()=>{
 for(const mutate of [(x:ReturnType<typeof setup>)=>{x.plan.confirmed=false;},
  (x:ReturnType<typeof setup>)=>{x.plan.protectedObjects=[];},
  (x:ReturnType<typeof setup>)=>{x.plan.protectedObjects[0]!.sizeBytes++;},
  (x:ReturnType<typeof setup>)=>{x.plan.publicObjects.push(x.plan.publicObjects[0]!);},
  (x:ReturnType<typeof setup>)=>{x.plan.sourceObjects[0]!.objectKey=x.plan.sourceObjects[0]!.objectKey.replace('.webp','.jpg');},
  (x:ReturnType<typeof setup>)=>{x.plan.publicObjects[0]!.contentType='text/html';}]){
  const x=setup();mutate(x);expect(()=>operatorMediaRequest({...x,plane:'public'})).toThrow();
 }
});
it('uses the existing Site request validator to reject wrong authority, expired or excessive lifetimes and unknown fields',()=>{
 const x=setup(),request=operatorMediaRequest({...x,plane:'public'});
 for(const changed of [{...request,authorityRevision:'c'.repeat(40)},{...request,notAfter:new Date(Date.now()-1).toISOString()},
  {...request,notAfter:new Date(Date.now()+901000).toISOString()},{...request,secret:'inert-not-a-credential'}])
  expect(()=>inspectMediaSessionRequest(changed)).toThrow();
});
