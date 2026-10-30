import {it,expect} from 'vitest';
import {compactMediaRecoveryBindingSchema,mediaProtectionReceiptSchema,protectedObjectRefSchema} from './media.js';
const h='a'.repeat(64),key='media/v1/objects/sha256/aa/'+h+'.png',ref='site-protected-v1:sha256:'+h+':png';
it('accepts the exact accepted Server opaque format without treating it as a URL or widening stable IDs',()=>{
 expect(protectedObjectRefSchema.parse(ref)).toBe(ref);expect(protectedObjectRefSchema.parse('mock-only-protected-test')).toBeTruthy();
 for(const value of ['https://secret.example/token','site-protected-v1:sha256:'+h+':exe','site-protected-v1:sha256:'+h.toUpperCase()+':png','../private/locator'])expect(()=>protectedObjectRefSchema.parse(value)).toThrow();
});
it('binds the Server reference hash and extension in both full receipt and durable compact record',()=>{
 const object={sha256:h,sourceObjectKey:key,verifiedSizeBytes:100,protectedObjectRef:ref,protectedAt:'2026-10-29T00:00:00Z'};
 const receipt={schemaVersion:1,candidateSha256:h,approvalRecordSha256:h,mediaPublicationManifestSha256:h,protectionClass:'cloudflare_protected_copy_v1',objects:[object],policyFingerprint:h,completedAt:'2026-10-29T00:00:00Z',receiptSha256:h};
 expect(()=>mediaProtectionReceiptSchema.parse(receipt)).not.toThrow();
 const binding={protectionClass:'cloudflare_protected_copy_v1',policyFingerprint:h,mediaProtectionReceiptSha256:h,objects:[{sha256:h,publicObjectKey:key,verifiedSizeBytes:100,protectedObjectRef:ref}]};
 expect(()=>compactMediaRecoveryBindingSchema.parse(binding)).not.toThrow();
 for(const bad of ['site-protected-v1:sha256:'+'b'.repeat(64)+':png','site-protected-v1:sha256:'+h+':webp']){
  expect(()=>mediaProtectionReceiptSchema.parse({...receipt,objects:[{...object,protectedObjectRef:bad}]})).toThrow();
  expect(()=>compactMediaRecoveryBindingSchema.parse({...binding,objects:[{...binding.objects[0],protectedObjectRef:bad}]})).toThrow();
 }
});
