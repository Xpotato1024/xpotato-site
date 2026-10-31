import {it,expect,vi} from 'vitest';import {articleMediaTargets} from '@xpotato/content-contracts/article-media-targets';
import {openFixtureMediaSession,type MediaSessionRequest} from './media-session-factory.js';import type {ServerMediaWriteSession} from './media-write-runtime.js';
const hash='a'.repeat(64),key='media/v1/objects/sha256/aa/'+hash+'.png';
function setup(){
 const request:MediaSessionRequest={schemaVersion:1,requestId:'request-1',notAfter:new Date(Date.now()+60000).toISOString(),authorityRevision:articleMediaTargets.authority.revision,
  binding:{jobId:'job-1',jobFingerprint:hash,candidateSha256:hash,approvalSha256:hash,attemptId:'attempt-1',inputSha256:hash,policySha256:hash},objects:[{plane:'public',key,sha256:hash,sizeBytes:20,contentType:'image/png',cacheControl:articleMediaTargets.public.cacheControl}]};
 const approve=vi.fn(async()=>{}),policy=vi.fn(async()=>({status:'unknown' as const})),inspect=vi.fn(async()=>({status:'unknown' as const})),grant=vi.fn(async()=>null);
 const session:ServerMediaWriteSession={descriptor:{schemaVersion:1,sessionId:'session-1',authorityRevision:request.authorityRevision,expiresAt:request.notAfter,binding:structuredClone(request.binding),objects:structuredClone(request.objects)},privateOrigins:['https://account.r2.cloudflarestorage.com'],assertApproved:approve,policy,inspect,authorizePut:grant};
 const factory={open:vi.fn(async(_request:MediaSessionRequest,_signal:AbortSignal)=>session)};return {request,session,factory,approve,policy,inspect,grant};
}
it('binds an injected fixture session to exact metadata without constructing credentials or invoking it',async()=>{
 const x=setup(),result=await openFixtureMediaSession({...x,scope:'test_fixture'});expect(result).toMatchObject({scope:'test_fixture',liveReady:false,productionEligible:false});expect(x.factory.open).toHaveBeenCalledTimes(1);expect(x.approve).not.toHaveBeenCalled();expect(x.policy).not.toHaveBeenCalled();expect(x.inspect).not.toHaveBeenCalled();expect(x.grant).not.toHaveBeenCalled();
 const copied=result.session.descriptor;copied.binding.candidateSha256='b'.repeat(64);expect(result.session.descriptor.binding.candidateSha256).toBe(hash);
 x.session.descriptor.binding.candidateSha256='c'.repeat(64);x.session.assertApproved=vi.fn(async()=>{throw Error('replacement');});await result.session.assertApproved(result.session.descriptor.binding,'public',new AbortController().signal);expect(x.approve).toHaveBeenCalledTimes(1);
});
it('rejects live scope, expired requests and cancellation before the factory can run',async()=>{
 const x=setup();await expect(openFixtureMediaSession({...x,scope:'operator_runtime'})).rejects.toThrow('LIVE_ACTIVATION');
 await expect(openFixtureMediaSession({...x,request:{...x.request,notAfter:'2026-01-01T00:00:00Z'},scope:'test_fixture'})).rejects.toThrow();
 const c=new AbortController();c.abort();await expect(openFixtureMediaSession({...x,scope:'test_fixture',signal:c.signal})).rejects.toThrow('FACTORY_REJECTED');expect(x.factory.open).not.toHaveBeenCalled();
});
it('rejects changed approval/object sets, excessive expiry and arbitrary origins from a factory',async()=>{
 for(const change of ['approval','objects','expiry','origin']){const x=setup();if(change==='approval')x.session.descriptor.binding.approvalSha256='b'.repeat(64);if(change==='objects')x.session.descriptor.objects=[];if(change==='expiry')x.session.descriptor.expiresAt=new Date(Date.now()+120000).toISOString();if(change==='origin')x.factory.open.mockResolvedValue({...x.session,privateOrigins:['https://example.invalid/']});await expect(openFixtureMediaSession({...x,scope:'test_fixture'})).rejects.toThrow(/^MEDIA_SESSION_FACTORY_REJECTED$/u);}
});
it('isolates request mutation and never exposes a raw factory exception',async()=>{
 const x=setup();x.factory.open.mockImplementationOnce(async(request)=>{request.binding.candidateSha256='b'.repeat(64);return x.session;});expect((await openFixtureMediaSession({...x,scope:'test_fixture'})).session.descriptor.binding.candidateSha256).toBe(hash);expect(x.request.binding.candidateSha256).toBe(hash);
 x.factory.open.mockRejectedValueOnce(Error('Authorization: inert-fixture-secret'));await expect(openFixtureMediaSession({...x,scope:'test_fixture'})).rejects.toThrow(/^MEDIA_SESSION_FACTORY_REJECTED$/u);
});
