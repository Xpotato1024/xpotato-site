import {z} from 'zod';
import {stableIdSchema} from '@xpotato/content-contracts';
import {fingerprint} from './canonical.js';import {runtimeDeadline} from './runtime-deadline.js';
import {inspectMediaWriteSession,mediaWriteSessionDescriptorSchema,type ServerMediaWriteSession} from './media-write-runtime.js';
import {isApprovedOperation,rememberOperatorSession} from './operator-capability.js';
import type {OneShotPublicationOperation} from './publication-operator-plan.js';
import type {Plane} from './publication-contracts.js';

const requestSchema=mediaWriteSessionDescriptorSchema.omit({sessionId:true,expiresAt:true}).extend({requestId:stableIdSchema.max(120),notAfter:z.iso.datetime({offset:true})}).strict();
export type MediaSessionRequest=z.infer<typeof requestSchema>;
/** The Server operator uses this exact validator; it owns no competing schema. */
export function inspectMediaSessionRequest(input:unknown){
 const request=requestSchema.parse(input),{requestId,notAfter,...requested}=request;
 inspectMediaWriteSession({...requested,sessionId:requestId,expiresAt:notAfter});
 return request;
}
/** Injected trusted Server boundary; no default implementation or credential
 * lookup. It may not be constructed from a JSON callback/URL descriptor.
 */
export interface ServerMediaSessionFactory {open(request:MediaSessionRequest,signal:AbortSignal):Promise<ServerMediaWriteSession>}
const objects=(items:MediaSessionRequest['objects'])=>[...items].sort((a,b)=>(a.plane+':'+a.key).localeCompare(b.plane+':'+b.key));

export async function openFixtureMediaSession(input:{request:MediaSessionRequest;factory:ServerMediaSessionFactory;scope:'test_fixture'|'operator_runtime';signal?:AbortSignal}){
 if(input.scope!=='test_fixture')throw Error('MEDIA_SESSION_LIVE_ACTIVATION_NOT_ESTABLISHED');
 return openCheckedMediaSession(input);
}
async function openCheckedMediaSession(input:{request:MediaSessionRequest;factory:ServerMediaSessionFactory;signal?:AbortSignal}){
 const request=inspectMediaSessionRequest(input.request),now=Date.now();
 // Reuse the exact key/authority/expiry validator; request validity does not
 // establish observed provider policy or authorization.
 const {requestId,notAfter,...requested}=request;
 inspectMediaWriteSession({...requested,sessionId:requestId,expiresAt:notAfter});
 if(Date.parse(request.notAfter)<=now)throw Error('MEDIA_SESSION_REQUEST_INVALID');
 try{return await runtimeDeadline(10000,input.signal,async signal=>{
  const raw=await input.factory.open(structuredClone(request),signal);signal.throwIfAborted();
  const descriptor=inspectMediaWriteSession(raw.descriptor);
  if(descriptor.authorityRevision!==request.authorityRevision||fingerprint(descriptor.binding)!==fingerprint(request.binding)
   ||fingerprint(objects(descriptor.objects))!==fingerprint(objects(request.objects))||Date.parse(descriptor.expiresAt)>Date.parse(request.notAfter)
   ||!Array.isArray(raw.privateOrigins)||raw.privateOrigins.length<1||raw.privateOrigins.length>3)throw Error();
  const privateOrigins=[...raw.privateOrigins];for(const text of privateOrigins){const u=new URL(text);if(u.protocol!=='https:'||u.username||u.password||u.port||u.pathname!=='/'||u.search||u.hash||!u.hostname.endsWith('.r2.cloudflarestorage.com'))throw Error();}
  if([raw.assertApproved,raw.policy,raw.inspect,raw.authorizePut].some(fn=>typeof fn!=='function'))throw Error();
  // Snapshot metadata and method references, so later mutation of the factory
  // response cannot silently replace an admitted capability.
  const session:ServerMediaWriteSession=Object.freeze({get descriptor(){return structuredClone(descriptor);},privateOrigins:Object.freeze(privateOrigins),
   assertApproved:raw.assertApproved.bind(raw),policy:raw.policy.bind(raw),inspect:raw.inspect.bind(raw),authorizePut:raw.authorizePut.bind(raw)});
  return Object.freeze({session,requestSha256:fingerprint(request),scope:'test_fixture' as const,liveReady:false as const,productionEligible:false as const});
 });}catch{throw Error('MEDIA_SESSION_FACTORY_REJECTED');}
}
/** Called by the adopted one-shot Server composition only. A caller-supplied
 * descriptor or fixture operation cannot activate the writer. */
export async function openOperatorMediaSession(input:{operation:OneShotPublicationOperation;plane:Plane;notAfter:string;
 factory:ServerMediaSessionFactory;signal?:AbortSignal}){
 if(!isApprovedOperation(input.operation))throw Error('MEDIA_APPROVED_OPERATOR_OPERATION_REQUIRED');
 const request=await input.operation.request(input.plane,input.notAfter,input.signal);
 const opened=await openCheckedMediaSession({request,factory:input.factory,...(input.signal?{signal:input.signal}:{})});
 await input.operation.assertApproved(opened.session.descriptor.binding,input.plane,input.signal??new AbortController().signal);
 return rememberOperatorSession(opened.session);
}
