import {describe,it,expect} from 'vitest';
import {mediaRegistries} from '../../../apps/site/src/content-registry/media/index.js';
import {publishedMediaEvidence} from '../../../apps/site/src/content-registry/media-evidence/index.js';
import {buildPublicationMediaManifest} from './publication-media-manifest.js';
import {publicationMediaReferences} from '../../../scripts/release/publication-media-policy.mjs';
import {assertHomeWorkshopImageReferences} from '../../../scripts/release/home-workshop-public-policy.mjs';
const sha='a'.repeat(40);
const input=()=>({registry:structuredClone(mediaRegistries.find(r=>r.contentId==='e7562440-e0bf-42a9-8a90-d66f4e1a4eb8')!),evidence:{rights:structuredClone([...publishedMediaEvidence['e7562440-e0bf-42a9-8a90-d66f4e1a4eb8']!.rights]),provenance:structuredClone(publishedMediaEvidence['e7562440-e0bf-42a9-8a90-d66f4e1a4eb8']!.provenance)}});
describe('publication evidence to deployment admission',()=>{
 it('admits the real 32 objects only after compact rights and recovery verification',()=>{
  const manifest=buildPublicationMediaManifest(sha,[input()]);expect(manifest.objects).toHaveLength(32);
  const refs=publicationMediaReferences(manifest,sha);
  for(const row of manifest.objects)expect(()=>assertHomeWorkshopImageReferences(`<img src="${row.url}"><source srcset="${row.url} 640w">`,'/',new Map(),'xpotato.net',refs)).not.toThrow();
 });
 it('rejects absent or unauthorized rights, incomplete protection, altered objects and mock recovery',()=>{
  for(const mutate of [
   (x:ReturnType<typeof input>)=>{x.evidence.rights=[];},
   (x:ReturnType<typeof input>)=>{x.evidence.rights[0]!.publicationAuthorized=false;},
   (x:ReturnType<typeof input>)=>{x.evidence.provenance.mediaRecovery!.objects.pop();},
   (x:ReturnType<typeof input>)=>{x.registry.assets[0]!.delivery.master.sha256='b'.repeat(64);},
   (x:ReturnType<typeof input>)=>{x.evidence.provenance.mediaRecovery!.objects[0]!.protectedObjectRef='mock-only-protected-test';},
  ]){const x=input();mutate(x);expect(()=>buildPublicationMediaManifest(sha,[x])).toThrow();}
 });
 it('rejects unregistered URLs, aliases, different origins and a missing manifest',()=>{
  const manifest=buildPublicationMediaManifest(sha,[input()]),url=manifest.objects[0]!.url,refs=publicationMediaReferences(manifest,sha);
  for(const value of [url+'?x=1',url+'#x',url.replace('assets.xpotato.net','example.test'),url.replace('/media/','/extra/../media/'),url.replace('/media/','/%6dedia/'),url.replace('https://','//'),url.replace('https://','https://user@'),url.replace(/\.[a-z]+$/u,'.gif')])expect(()=>assertHomeWorkshopImageReferences(`<img src="${value}">`,'/',new Map(),'xpotato.net',refs)).toThrow('UNAPPROVED_IMAGE_REFERENCE');
  expect(()=>assertHomeWorkshopImageReferences(`<img src="${url}">`,'/',new Map(),'xpotato.net')).toThrow('UNAPPROVED_IMAGE_REFERENCE');
  expect(()=>publicationMediaReferences(manifest,'b'.repeat(40))).toThrow();
  for(const mutate of [(m:typeof manifest)=>{m.objects[0]!.sha256='b'.repeat(64);},(m:typeof manifest)=>{m.objects[0]!.bytes=0;},(m:typeof manifest)=>{m.objects.push(m.objects[0]!);}]){const m=structuredClone(manifest);mutate(m);expect(()=>publicationMediaReferences(m,sha)).toThrow();}
 });
});
