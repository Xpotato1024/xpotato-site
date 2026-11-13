import {z} from 'zod';
import {contentIdSchema,sha256Schema,stableIdSchema,type ArticleJobSpec} from '@xpotato/content-contracts';
import {canonicalJson,fingerprint,sha256} from '../canonical.js';

export const existingAuditPreparation = Object.freeze({
 protocol:'xpotato-private-existing-audit-preparation-v1',
 purpose:'inventory_only_until_exact_grant',
 destination:'openai-existing-chatgpt-codex-cli',
});
export const existingAuditPreparationBytes=canonicalJson(existingAuditPreparation)+'\n';
export const existingAuditPreparationRef=Object.freeze({inputId:'existing-audit-preparation',
 path:'base/audit-preparation.json',artifactSha256:sha256(existingAuditPreparationBytes)});
export const isExistingAuditPreparation=(spec:ArticleJobSpec)=>spec.inputs.localSourceRefs.some(r=>r.inputId===existingAuditPreparationRef.inputId);
export const existingAuditJobBindingBytes=(spec:ArticleJobSpec)=>Buffer.from(canonicalJson({
 protocol:'xpotato-private-existing-audit-job-binding-v1',jobId:spec.jobId,jobFingerprint:fingerprint(spec),contentId:spec.target.contentId,
}));

export const existingAuditInventorySchema=z.array(z.object({artifactId:stableIdSchema,sha256:sha256Schema,sizeBytes:z.number().int().nonnegative()}).strict()).min(1).max(64);
export const existingAuditDisclosureGrantSchema=z.object({protocol:z.literal('xpotato-private-existing-audit-disclosure-grant-v1'),
 jobId:stableIdSchema,attemptId:stableIdSchema,contentId:contentIdSchema,intakeSha256:sha256Schema,inputSha256:sha256Schema,targetRequestSha256:sha256Schema,
 destination:z.literal('openai-existing-chatgpt-codex-cli'),authorizedBy:z.literal('user'),stage:z.enum(['content_audit','visual_audit']),
 inventory:existingAuditInventorySchema,inventorySha256:sha256Schema}).strict();
export type ExistingAuditDisclosureGrant=z.infer<typeof existingAuditDisclosureGrantSchema>;
type Artifact=Readonly<{artifactId:string;sha256:string;bytes:Uint8Array}>;

/** Validate a supplied, actual exact grant, never infer one from ceilings.
 * Filesystem admission/readback additionally binds the current immutable Job. */
export function assertExactExistingAuditGrant(input:unknown,spec:ArticleJobSpec,stage:string,artifacts:readonly Artifact[]){
 const grant=existingAuditDisclosureGrantSchema.parse(input);
 const markers=spec.inputs.localSourceRefs.filter(r=>r.inputId===existingAuditPreparationRef.inputId),marker=markers[0];
 if(markers.length>1)throw Error('EXISTING_AUDIT_PREPARATION_INVALID');
 if(marker&&(fingerprint(marker)!==fingerprint(existingAuditPreparationRef)||spec.externalAiDisclosure.explicitAuthorizations.length))
  throw Error('EXISTING_AUDIT_PREPARATION_INVALID');
 if(!marker&&!spec.externalAiDisclosure.explicitAuthorizations.some(a=>a.inputRef==='existing-audit-input'&&a.requestedMode==='allow_exact'&&a.authorizedBy==='user'))throw Error('EXISTING_AUDIT_INIT_AUTHORIZATION_REQUIRED');
 if(!spec.permissions.networkAccess||!spec.permissions.externalTextAI)throw Error('EXISTING_AUDIT_PROVIDER_CEILING_REQUIRED');
 const inventory=artifacts.map(a=>({artifactId:a.artifactId,sha256:a.sha256,sizeBytes:a.bytes.length}))
  .sort((a,b)=>a.artifactId<b.artifactId?-1:a.artifactId>b.artifactId?1:0);
 if(new Set(artifacts.map(a=>a.artifactId)).size!==artifacts.length||artifacts.some(a=>sha256(a.bytes)!==a.sha256)
  ||fingerprint(inventory)!==grant.inventorySha256||fingerprint(grant.inventory)!==grant.inventorySha256)
  throw Error('EXISTING_AUDIT_DISCLOSURE_GRANT_MISMATCH');
 if(marker){
  const binding=artifacts.find(a=>a.artifactId==='audit-job-binding');
  if(!binding||!Buffer.from(binding.bytes).equals(existingAuditJobBindingBytes(spec)))throw Error('EXISTING_AUDIT_GRANT_JOB_FINGERPRINT_MISMATCH');
 }
 const targetArtifact=artifacts.find(a=>a.artifactId==='audit-target');
 if(!targetArtifact)throw Error('EXISTING_AUDIT_GRANT_TARGET_REQUIRED');
 const target=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(targetArtifact.bytes));
 const {requestSha256,...unsigned}=target;
 const intake=spec.inputs.localSourceRefs.filter(r=>r.inputId==='existing-ai-intake');
 if(grant.jobId!==spec.jobId||grant.contentId!==spec.target.contentId||grant.stage!==stage
  ||intake.length!==1||intake[0]!.path!=='.local/article-jobs/existing-inputs/'+grant.intakeSha256+'/intake.json'
  ||target.scope!=='existing_ai'||(stage==='content_audit'
   ?target.profile!=='existing-ai-content-audit-v1'||target.jobFingerprint!==fingerprint(spec)
   :target.protocol!=='xpotato-private-visual-audit-request-v1')
  ||target.jobId!==spec.jobId||target.attemptId!==grant.attemptId
  ||target.inputSha256!==grant.inputSha256||requestSha256!==grant.targetRequestSha256||fingerprint(unsigned)!==requestSha256)
  throw Error('EXISTING_AUDIT_DISCLOSURE_GRANT_MISMATCH');
 return grant;
}
