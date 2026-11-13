import {describe,it,expect} from 'vitest';
import type {ArticleJobSpec} from '@xpotato/content-contracts';
import {canonicalJson,fingerprint,sha256} from '../canonical.js';
import {compileDisclosureManifest,currentExternalAiPolicyBinding,type OutboundArtifact} from '../disclosure.js';
import {existingAuditPreparationRef,existingAuditJobBindingBytes,existingAuditInventorySchema,assertExactExistingAuditGrant,type ExistingAuditDisclosureGrant} from './existing-audit-grant.js';

type MutableArtifact={-readonly [K in keyof OutboundArtifact]:OutboundArtifact[K]};
const hash='a'.repeat(64);
function setup(body='inert fixture evidence',stage:'content_audit'|'visual_audit'='content_audit'){
 const spec:ArticleJobSpec={schemaVersion:1,jobId:'job-fixture',operation:'create',
  target:{collection:'blog',contentId:'11111111-1111-4111-8111-111111111111',workingTitle:'fixture',articleMode:'explanation'},
  reader:{outcome:'fixture',assumedKnowledge:[],language:'ja'},
  inputs:{userNotes:[],repositoryRefs:[],localSourceRefs:[existingAuditPreparationRef,{inputId:'existing-ai-intake',path:'.local/article-jobs/existing-inputs/'+hash+'/intake.json',artifactSha256:hash}],seedUrls:[],sourceDiscoveryQueries:[]},
  externalAiDisclosure:{policy:currentExternalAiPolicyBinding,explicitAuthorizations:[]},
  constraints:{requiredClaims:[],forbiddenClaims:[],requiredSections:[],forbiddenPublicationPatterns:[]},taxonomyHints:{tagIds:[]},
  media:{suppliedMediaRefs:[],heroPreference:'auto',requiredInlineVisuals:[]},
  permissions:{networkAccess:true,externalTextAI:true,externalImageAI:false,localMediaProcessing:false,privateCanonicalMediaStorage:false,publicMediaUpload:false,protectedMediaOperation:false,repositoryExport:false}};
 const unsigned={...(stage==='content_audit'?{profile:'existing-ai-content-audit-v1',jobFingerprint:fingerprint(spec)}:{protocol:'xpotato-private-visual-audit-request-v1'}),scope:'existing_ai',jobId:spec.jobId,attemptId:'attempt-fixture',inputSha256:hash};
 const target={...unsigned,requestSha256:fingerprint(unsigned)};
 const artifacts=Object.entries({'audit-target':canonicalJson(target),'audit-body':body,'audit-job-binding':existingAuditJobBindingBytes(spec).toString('utf8')}).map(([artifactId,text]):MutableArtifact=>{
  const bytes=Buffer.from(text),sha=sha256(bytes);
  const admissionProvenance={kind:'article_job_input_v1' as const,inputRef:'existing-audit-input',inputClass:'private_repository_or_document_v1' as const,artifactSha256:sha,representation:'raw' as const};
  const disclosureRecord={schemaVersion:1 as const,subject:{kind:'artifact' as const,id:artifactId,sha256:sha},mode:'allow_exact' as const,basis:'user_authorized' as const,...currentExternalAiPolicyBinding,authorizedBy:'user' as const,authorizedAt:'2026-11-13T00:00:00Z',notes:['Synthetic isolated test consent only.']};
  return {artifactId,sha256:sha,bytes,required:true,admissionProvenance,admissionProvenanceSha256:fingerprint(admissionProvenance),disclosureRecord,disclosureRecordSha256:fingerprint(disclosureRecord)};
 });
 const inventory=artifacts.map(a=>({artifactId:a.artifactId,sha256:a.sha256,sizeBytes:a.bytes.length})).sort((a,b)=>a.artifactId.localeCompare(b.artifactId));
 const grant:ExistingAuditDisclosureGrant={protocol:'xpotato-private-existing-audit-disclosure-grant-v1',jobId:spec.jobId,attemptId:'attempt-fixture',contentId:spec.target.contentId,intakeSha256:hash,inputSha256:hash,targetRequestSha256:target.requestSha256,destination:'openai-existing-chatgpt-codex-cli',authorizedBy:'user',stage,inventory,inventorySha256:fingerprint(inventory)};
 return {spec,artifacts,grant};
}
const compile=(x:ReturnType<typeof setup>,grant:ExistingAuditDisclosureGrant|undefined=x.grant,stage:any='content_audit')=>
 compileDisclosureManifest({jobSpec:x.spec,requestId:'request-fixture',stage,artifacts:x.artifacts,...(grant?{existingAuditGrant:grant}:{})});
describe('append-only exact existing audit grant',()=>{
 it('counts the added Job binding within the same 64-artifact inventory ceiling without omission',()=>{
  const items=Array.from({length:64},(_,i)=>({artifactId:'artifact-'+i,sha256:hash,sizeBytes:1}));
  expect(existingAuditInventorySchema.parse(items)).toHaveLength(64);
  expect(()=>existingAuditInventorySchema.parse([...items,{artifactId:'audit-job-binding',sha256:hash,sizeBytes:1}])).toThrow();
 });
 it('requires actual grant even for public-policy provenance, without granting generic stages',()=>{
  const x=setup();expect(()=>compile(x)).not.toThrow();
  expect(()=>compileDisclosureManifest({jobSpec:x.spec,requestId:'request-fixture',stage:'content_audit',artifacts:x.artifacts})).toThrow('EXACT_DISCLOSURE_GRANT_REQUIRED');
  for(const stage of ['author','revision','source_discovery','evidence','visual_plan','visual_audit'])expect(()=>compile(x,x.grant,stage)).toThrow();
  x.artifacts[1]!.admissionProvenance={kind:'public_anonymous_https_acquisition_v1',artifactSha256:x.artifacts[1]!.sha256,finalUrl:'https://example.invalid/fixture',anonymousReadable:true,credentialsUsed:false,secretScanResultSha256:hash,acquisitionReceiptSha256:hash};
  expect(()=>compileDisclosureManifest({jobSpec:x.spec,requestId:'request-fixture',stage:'author',artifacts:x.artifacts})).toThrow('EXACT_DISCLOSURE_GRANT_REQUIRED');
  expect(()=>compile(x)).toThrow('GRANT_INPUT_SCOPE_INVALID');
 });
 it.each(['jobId','attemptId','contentId','intakeSha256','inputSha256','targetRequestSha256','destination','authorizedBy','inventorySha256'] as const)('rejects changed %s',key=>{
  const x=setup(),changed={...x.grant,[key]:key==='contentId'?'22222222-2222-4222-8222-222222222222':key.endsWith('Sha256')?'b'.repeat(64):'other'};
  expect(()=>assertExactExistingAuditGrant(changed,x.spec,'content_audit',x.artifacts)).toThrow();
 });
 it('requires the complete exact id/hash/size set, target bytes and immutable spec fingerprint',()=>{
  const x=setup();
  for(const artifacts of [x.artifacts.slice(1),[...x.artifacts,x.artifacts[0]!],x.artifacts.map(a=>({...a,bytes:Buffer.from('changed')}))])
   expect(()=>assertExactExistingAuditGrant(x.grant,x.spec,'content_audit',artifacts)).toThrow();
  const bad={...x.grant,inventory:x.grant.inventory.map(a=>({...a,sizeBytes:a.sizeBytes+1}))};bad.inventorySha256=fingerprint(bad.inventory);
  expect(()=>compile(x,bad)).toThrow('GRANT_MISMATCH');
  const changedSpec=structuredClone(x.spec);changedSpec.reader.outcome='changed';
  expect(()=>assertExactExistingAuditGrant(x.grant,changedSpec,'content_audit',x.artifacts)).toThrow('JOB_FINGERPRINT_MISMATCH');
 });
 it('binds visual targets without a content profile through an exact immutable Job artifact',()=>{
  const x=setup('inert visual fixture','visual_audit');expect(()=>compile(x,x.grant,'visual_audit')).not.toThrow();
  const target=JSON.parse(Buffer.from(x.artifacts[0]!.bytes).toString('utf8'));expect(target).not.toHaveProperty('jobFingerprint');
  const missing=x.artifacts.filter(a=>a.artifactId!=='audit-job-binding');
  const inventory=missing.map(a=>({artifactId:a.artifactId,sha256:a.sha256,sizeBytes:a.bytes.length})).sort((a,b)=>a.artifactId.localeCompare(b.artifactId));
  expect(()=>assertExactExistingAuditGrant({...x.grant,inventory,inventorySha256:fingerprint(inventory)},x.spec,'visual_audit',missing)).toThrow('JOB_FINGERPRINT_MISMATCH');
 });
 it('cannot raise a false ceiling, alter preparation marker, or inject an init authorization',()=>{
  for(const key of ['networkAccess','externalTextAI'] as const){const x=setup();x.spec.permissions[key]=false;expect(()=>compile(x)).toThrow();}
  for(const key of ['path','artifactSha256'] as const){const x=setup();x.spec.inputs.localSourceRefs=structuredClone(x.spec.inputs.localSourceRefs);x.spec.inputs.localSourceRefs[0]![key]=key==='artifactSha256'?'b'.repeat(64):'base/changed.json';expect(()=>compile(x)).toThrow('PREPARATION_INVALID');}
  const x=setup();x.spec.externalAiDisclosure.explicitAuthorizations.push({inputRef:'existing-audit-input',requestedMode:'allow_exact',authorizedBy:'user'});
  expect(()=>compile(x)).toThrow('PREPARATION_INVALID');
 });
 it('keeps hard-deny, explicit record authority and raw-input scope in force after a valid grant',()=>{
  expect(()=>compile(setup('password: synthetic-secret-fixture'))).toThrow('Hard-deny');
  for(const mutation of ['record','scope','representation'] as const){
   const x=setup(),a=x.artifacts[1]!;
   if(mutation==='record'){a.disclosureRecord={...a.disclosureRecord,basis:'repository_policy'};a.disclosureRecordSha256=fingerprint(a.disclosureRecord);}
   else {a.admissionProvenance={...a.admissionProvenance,...(mutation==='scope'?{inputRef:'other-input'}:{representation:'derived'})} as any;a.admissionProvenanceSha256=fingerprint(a.admissionProvenance);}
   expect(()=>compile(x)).toThrow();
  }
 });
});
