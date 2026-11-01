import {it,expect,vi,beforeEach} from 'vitest';
import {articleMediaTargets} from '@xpotato/content-contracts/article-media-targets';
// Admission is deliberately stubbed at a unit boundary. These tests neither
// create human approval nor establish actual candidate/provider admission.
const ports=vi.hoisted(()=>({candidate:vi.fn(),head:vi.fn(),snapshot:vi.fn()}));
vi.mock('./publication-approval.js',()=>({publicationCandidate:ports.candidate,readPublicationHead:ports.head}));
vi.mock('./candidate-freshness.js',async original=>({...await original<object>(),candidatePreviewSnapshot:ports.snapshot}));
import {prepareOneShotPublicationOperation} from './publication-operator-plan.js';
const a='a'.repeat(64),b='b'.repeat(64),key='media/v1/objects/sha256/bb/'+b+'.png';
function setup(){
 const permissions={networkAccess:true,repositoryExport:true,privateCanonicalMediaStorage:true,publicMediaUpload:true,protectedMediaOperation:true};
 const c={v:{c:{store:{jobId:'job-unit',jobFingerprint:a,spec:{permissions}},binding:{attemptId:'attempt-unit',inputSha256:b}},
  media:{registry:{assets:[{}]}},audit:{},plan:{rights:[],visualInput:{}}},materials:{frontmatter:{pubDate:'2020-01-01'},timeZone:'Asia/Tokyo',contentAudit:{},
  storagePlan:{profile:articleMediaTargets,confirmed:true,sourceObjects:[{objectKey:'source/v1/objects/sha256/aa/'+a+'.webp',sha256:a,sizeBytes:24}],
   publicObjects:[{objectKey:key,sha256:b,sizeBytes:48,contentType:'image/png',cacheControl:articleMediaTargets.public.cacheControl}],
   protectedObjects:[{objectKey:key,sha256:b,sizeBytes:48}]}}};
 ports.candidate.mockResolvedValue(c);ports.head.mockResolvedValue({state:'HUMAN_APPROVED',approvalSha256:b,sources:null,publication:null,protection:null,export:null});
 ports.snapshot.mockResolvedValue(a);
 const repo={commit:'a'.repeat(40),fingerprint:a} as never,refreshRepository=vi.fn(async()=>repo);
 const input={directory:'/unit/private',root:'/unit/repository',repo,refreshRepository,candidateSha256:a,policySha256:b};
 return {c,permissions,input};
}
beforeEach(()=>vi.resetAllMocks());
it('connects admitted Site data to exact Server requests while remaining preparation-only',async()=>{
 const x=setup(),operation=await prepareOneShotPublicationOperation(x.input);
 expect(operation).toMatchObject({preparationOnly:true,liveReady:false,formalStorageReceipt:false,productionEligible:false});
 const request=await operation.request('protected',new Date(Date.now()+60000).toISOString());
 expect(request.objects.map(o=>o.plane)).toEqual(['public','protected']);
 await operation.assertApproved(operation.binding,'protected',new AbortController().signal);
 expect(ports.candidate.mock.calls.length).toBeGreaterThanOrEqual(3);
});
it('refuses missing publication/network capabilities and never elevates a review Job',async()=>{
 for(const field of ['networkAccess','repositoryExport','privateCanonicalMediaStorage','publicMediaUpload','protectedMediaOperation'] as const){
  const x=setup();x.permissions[field]=false;
  await expect(prepareOneShotPublicationOperation(x.input)).rejects.toThrow();
  expect(x.permissions[field]).toBe(false);
 }
});
it('rechecks stale approval and candidate bytes before giving a request or approval callback',async()=>{
 const x=setup(),operation=await prepareOneShotPublicationOperation(x.input);
 ports.snapshot.mockResolvedValueOnce(b);
 await expect(operation.request('source',new Date(Date.now()+60000).toISOString())).rejects.toThrow('BINDING_MISMATCH');
 const modified=operation.binding;modified.candidateSha256=b;
 await expect(operation.assertApproved(modified,'source',new AbortController().signal)).rejects.toThrow('BINDING_MISMATCH');
 ports.head.mockResolvedValueOnce({state:'HUMAN_APPROVED',approvalSha256:a});
 await expect(operation.request('source',new Date(Date.now()+60000).toISOString())).rejects.toThrow('BINDING_MISMATCH');
});
it('reloads repository identity instead of trusting the captured original repository object',async()=>{
 const x=setup(),operation=await prepareOneShotPublicationOperation(x.input);
 x.input.refreshRepository.mockResolvedValueOnce({commit:'b'.repeat(40),fingerprint:b} as never);
 await expect(operation.request('source',new Date(Date.now()+60000).toISOString())).rejects.toThrow('BINDING_MISMATCH');
});
