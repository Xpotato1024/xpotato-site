import {describe,it,expect} from 'vitest';
import {fixture} from '../../../../tests/fixtures/blog-foundation/social-evidence.js';
import {compactSocialImage} from './compact-social-image.js';

// Synthetic contract inputs only; never registered in the application's media catalog.
describe('public social metadata from compact lineage',()=>{
 it('resolves an absolute URL and dimensions from the same exact protected social-card object',()=>{
  const input=fixture(),image=compactSocialImage(input);expect(image.url).toBe(new URL(input.registry.assets[0]!.delivery.master.objectKey,input.publicOrigin).href);expect(image).toMatchObject({width:1200,height:630,alt:'日本語の見出し'});
 });
 it('rejects mock, incomplete recovery, unauthorized rights and cross-origin inputs',()=>{
  for(const mutate of [
   (input:ReturnType<typeof fixture>)=>{input.evidence.provenance.mediaRecovery!.objects[0]!.protectedObjectRef='mock-only-protected-test'},
   (input:ReturnType<typeof fixture>)=>{input.evidence.provenance.mediaRecovery!.objects=[]},
   (input:ReturnType<typeof fixture>)=>{input.evidence.rights[0]!.publicationAuthorized=false},
   (input:ReturnType<typeof fixture>)=>{input.publicOrigin='http://media.example.com/'},
   (input:ReturnType<typeof fixture>)=>{input.registry.assets[0]!.role='hero'},
   (input:ReturnType<typeof fixture>)=>{input.registry.assets[0]!.delivery.master.width=100},
   (input:ReturnType<typeof fixture>)=>{input.registry.assets[0]!.delivery.master.format='svg'},
  ]){const input=fixture();mutate(input);expect(()=>compactSocialImage(input)).toThrow();}
 });
});
