import {randomUUID} from 'node:crypto';
import {readDraftStore,type DraftRepository} from './draft-job.js';
import {contentReviewContext} from './content-review.js';
import {loadReviewOutput} from './review-journal.js';
import {visualContext,visualPayload} from './visual-review.js';
import {requiredExistingAuditMaterial} from './existing-audit-material.js';
import {compileDisclosureManifest,currentExternalAiPolicyBinding,type OutboundArtifact} from './disclosure.js';
import {fingerprint,sha256} from './canonical.js';
import {fingerprintSemanticRequest} from './semantic-provider.js';
import type {ExistingAuditInvocationInput} from './codex-audit.js';

/** Explicit Job init authorization is separate from this exact-byte admission.
 * Historical deny records are retained; new request records bind the named
 * received article's actual audit artifact set, never unknown filesystem data. */
export async function buildExistingCodexAuditRequest(directory:string,repo:DraftRepository,repositoryRoot:string,stage:'content'|'visual'):Promise<ExistingAuditInvocationInput>{
 const store=await readDraftStore(directory);
 if(!store.spec.permissions.networkAccess||!store.spec.permissions.externalTextAI
  ||!store.spec.externalAiDisclosure.explicitAuthorizations.some(a=>a.inputRef==='existing-audit-input'&&a.requestedMode==='allow_exact'&&a.authorizedBy==='user'))throw Error('EXISTING_AUDIT_EXPLICIT_AUTHORIZATION_REQUIRED');
 let target:any;
 if(stage==='content')target=await loadReviewOutput((await contentReviewContext(directory,repo)).journal,'auditRequest');
 else target=await visualPayload(await visualContext(directory,repo,repositoryRoot),'auditRequest');
 const {materials,contract}=await requiredExistingAuditMaterial(directory,target,stage),authorizedAt=new Date().toISOString();
 const artifacts:OutboundArtifact[]=Object.entries(materials).map(([artifactId,bytes])=>{
  const hash=sha256(bytes),admissionProvenance={kind:'article_job_input_v1' as const,inputRef:'existing-audit-input',inputClass:artifactId.startsWith('audit-image-')?'raw_user_image_v1' as const:'private_repository_or_document_v1' as const,artifactSha256:hash,representation:'raw' as const};
  const disclosureRecord={schemaVersion:1 as const,subject:{kind:'artifact' as const,id:artifactId,sha256:hash},mode:'allow_exact' as const,basis:'user_authorized' as const,
   ...currentExternalAiPolicyBinding,authorizedBy:'user' as const,authorizedAt,notes:['Exact fixed audit input for the owner-requested existing article; existing ChatGPT login only; no generation or publication authority.']};
  return {artifactId,sha256:hash,bytes,required:true,admissionProvenance,admissionProvenanceSha256:fingerprint(admissionProvenance),disclosureRecord,disclosureRecordSha256:fingerprint(disclosureRecord)};
 });
 const requestId='existing-audit-'+randomUUID(),semanticStage=stage==='content'?'content_audit' as const:'visual_audit' as const;
 const manifest=compileDisclosureManifest({jobSpec:store.spec,requestId,stage:semanticStage,artifacts});
 const unsigned={schemaVersion:1 as const,requestId,jobId:store.jobId,jobFingerprint:store.jobFingerprint,stage:semanticStage,
  inputArtifacts:artifacts.map(a=>({artifactId:a.artifactId,sha256:a.sha256,sizeBytes:a.bytes.length,mediaType:a.artifactId.startsWith('audit-image-')?'image/webp':'text/plain'})),
  skill:{...target.skill,referenceBundleSha256:sha256(materials['audit-references']!)},responseSchema:{schemaId:contract.schemaId,schemaSha256:contract.sha256},
  constraints:{maxOutputBytes:1024*1024,publicSafetyRequired:true,externalFactPolicy:'fixed_sources_only' as const},executionMode:'external' as const,externalAiDisclosureManifestSha256:manifest.manifestSha256};
 return {directory,repo,repositoryRoot,attemptId:target.attemptId,inputSha256:target.inputSha256,auditTargetArtifactId:'audit-target',spec:store.spec,
  request:{...unsigned,requestSha256:fingerprintSemanticRequest(unsigned)},artifacts,physical:{skillArtifactId:'audit-skill',referenceArtifactId:'audit-references',responseSchemaArtifactId:'audit-schema'},
  profile:{executionProfileId:'existing-ai-independent-codex-v1',providerProfileId:'existing-chatgpt-codex-cli-v1',provider:'openai',model:'gpt-6.1-sol',modelProfileId:'gpt-6-1-sol-high-fresh-audit-v1',maxOutputBytes:1024*1024,timeoutMs:240000,freshContext:true},contract};
}
