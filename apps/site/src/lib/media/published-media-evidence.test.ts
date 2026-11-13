import {describe,it,expect} from 'vitest';
import {fingerprint} from '@xpotato/content-contracts/canonical';
import {fixture} from '../../../../../tests/fixtures/blog-foundation/social-evidence.js';
import {buildPublishedMediaEvidence} from './published-media-evidence.js';
import {compactSocialImage} from './compact-social-image.js';
import {publishedMediaEvidence} from '../../content-registry/media-evidence/index.js';
import {mediaRegistries} from '../../content-registry/media/index.js';

const id='38f4cc36-81fb-4d7c-8063-686eb8000352';
function input(){
 const data=fixture();
 const records:Record<string,typeof data.evidence.provenance>={[id]:data.evidence.provenance};
 const rights:Record<string,typeof data.evidence.rights>={[id]:data.evidence.rights};
 return {records,ledger:[{contentId:id,provenanceSha256:fingerprint(data.evidence.provenance)}],rights,registries:[data.registry]};
}
type Input=ReturnType<typeof input>;
const rehash=(data:Input)=>{data.ledger[0]!.provenanceSha256=fingerprint(data.records[id]);};
describe('formal exported media evidence catalog',()=>{
 it('connects a new exported ContentId without a hardcoded media-evidence entry',()=>{
  const data=input(),catalog=buildPublishedMediaEvidence(data);
  expect(Object.keys(catalog)).toEqual([id]);
  expect(compactSocialImage({registry:data.registries[0]!,evidence:catalog[id]!,publicOrigin:'https://assets.xpotato.net/'}).width).toBe(1200);
  expect(Object.isFrozen(catalog)).toBe(true);
 });
 it('connects both current articles to their unchanged formal lineage',()=>{
  expect(Object.keys(publishedMediaEvidence).sort()).toEqual(expect.arrayContaining(['09e6785f-6da5-4c2f-892b-e573845f0e9c','e7562440-e0bf-42a9-8a90-d66f4e1a4eb8']));
  for(const registry of mediaRegistries)expect(compactSocialImage({registry,evidence:publishedMediaEvidence[registry.contentId]!,publicOrigin:'https://assets.xpotato.net/'})).toMatchObject({width:1200,height:630});
  expect(publishedMediaEvidence['09e6785f-6da5-4c2f-892b-e573845f0e9c']!.provenance.articleJob).toHaveProperty('reviewBasis','owner_reviewed');
 });
 it.each([
  ['missing record',(data:Input)=>{delete data.records[id];}],
  ['extra record',(data:Input)=>{data.records['extra']=data.records[id]!;}],
  ['duplicate ledger',(data:Input)=>{data.ledger.push(data.ledger[0]!);}],
  ['missing ledger',(data:Input)=>{data.ledger=[];}],
  ['wrong content',(data:Input)=>{data.records[id]!.contentId='f8a847d4-8f5d-4bb0-a387-750f096479f2';rehash(data);}],
  ['stale hash',(data:Input)=>{data.ledger[0]!.provenanceSha256='b'.repeat(64);}],
  ['missing rights',(data:Input)=>{delete data.rights[id];}],
  ['unauthorized rights',(data:Input)=>{data.rights[id]![0]!.publicationAuthorized=false;}],
  ['wrong rights ref',(data:Input)=>{data.rights[id]![0]!.rightsId='unrelated';}],
  ['duplicate rights',(data:Input)=>{data.rights[id]!.push(data.rights[id]![0]!);}],
  ['missing registry',(data:Input)=>{data.registries=[];}],
  ['duplicate registry',(data:Input)=>{data.registries.push(data.registries[0]!);}],
  ['missing recovery',(data:Input)=>{data.records[id]!.mediaRecovery!.objects=[];rehash(data);}],
  ['mock recovery',(data:Input)=>{data.records[id]!.mediaRecovery!.objects[0]!.protectedObjectRef='mock-only-protected-test';rehash(data);}],
  ['wrong source',(data:Input)=>{data.registries[0]!.assets[0]!.canonicalSource!.sha256='b'.repeat(64);}],
  ['mixed owner ref',(data:Input)=>{data.registries[0]!.assets[0]!.ownerReviewRef='owner-review-'+'a'.repeat(64);}],
 ] as const)('rejects %s without manufacturing replacement evidence',(_label,mutate)=>{
  const data=input();mutate(data);expect(()=>buildPublishedMediaEvidence(data)).toThrow();
 });
});
