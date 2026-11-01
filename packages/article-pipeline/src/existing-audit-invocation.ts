import {existingAiContentAuditResponseSchema,existingAiVisualAuditResponseSchema,sha256Schema,type SemanticRequestEnvelope} from '@xpotato/content-contracts';
import {canonicalJson,fingerprint,sha256} from './canonical.js';
import {prepareSemanticInvocation,semanticResponseContract} from './semantic-runtime.js';
import {readDraftStore,assertCurrentDraft,type DraftRepository} from './draft-job.js';
import {contentReviewContext} from './content-review.js';
import {loadReviewOutput} from './review-journal.js';
import {visualContext,visualPayload} from './visual-review.js';
import {requiredExistingAuditMaterial,assertExistingAuditPhysicalSet} from './existing-audit-material.js';

/** Compile only an exact admitted audit invocation. No provider/process is
 * started here, and a prepared or fixture result cannot admit an audit record.
 * The trusted live runner and stage-receipt import remain separate boundaries. */
export async function prepareExistingAuditInvocation<T>(input:Parameters<typeof prepareSemanticInvocation<T>>[0]&{
 directory:string;repo:DraftRepository;repositoryRoot:string;attemptId:string;inputSha256:string;
 auditTargetArtifactId:string;
}){
 const store=await readDraftStore(input.directory),current=await assertCurrentDraft(input.directory,store,input.repo);
 const received=store.receivedInput,stage=input.request.stage;
 if(!received?.reviewProfile||!['content_audit','visual_audit'].includes(stage)
  ||store.activeAttemptId!==input.attemptId||current.inputSha256!==input.inputSha256
  ||input.spec.jobId!==store.jobId||fingerprint(input.spec)!==store.jobFingerprint
  ||fingerprint(input.spec)!==fingerprint(store.spec))throw Error('EXISTING_AUDIT_JOB_BINDING_INVALID');
 let auditTarget:Record<string,unknown>;
 let assertFresh:()=>Promise<void>;
 if(stage==='content_audit'){
  const c=await contentReviewContext(input.directory,input.repo);
  if(c.journal.state!=='EXAMPLES_ASSESSED')throw Error('EXISTING_AUDIT_STAGE_NOT_READY');
  auditTarget=await loadReviewOutput(c.journal,'auditRequest');
  assertFresh=c.fresh;
 }else{
  const v=await visualContext(input.directory,input.repo,input.repositoryRoot);
  if(v.state!=='VISUAL_READY'||v.head.rejection)throw Error('EXISTING_AUDIT_STAGE_NOT_READY');
  auditTarget=await visualPayload(v,'auditRequest');
  assertFresh=v.fresh;
 }
 if(auditTarget.scope!=='existing_ai'||auditTarget.jobId!==store.jobId
  ||auditTarget.attemptId!==store.activeAttemptId||auditTarget.inputSha256!==current.inputSha256)throw Error('EXISTING_AUDIT_TARGET_INVALID');
 const {requestSha256:rawTargetSha256,...unsigned}=auditTarget;
 const requestSha256=sha256Schema.parse(rawTargetSha256);
 if(fingerprint(unsigned)!==requestSha256)throw Error('EXISTING_AUDIT_TARGET_INVALID');
 const target=input.artifacts.find(a=>a.artifactId===input.auditTargetArtifactId);
 if(!target||!Buffer.from(target.bytes).equals(Buffer.from(canonicalJson(auditTarget)))
  ||target.sha256!==sha256(target.bytes))throw Error('EXISTING_AUDIT_PHYSICAL_TARGET_MISSING');
 const skillId=stage==='content_audit'?'independent-article-audit':'independent-visual-audit';
 const contract=stage==='content_audit'
  ?semanticResponseContract('existing-ai-content-audit-response-v1',existingAiContentAuditResponseSchema)
  :semanticResponseContract('existing-ai-visual-audit-response-v1',existingAiVisualAuditResponseSchema);
 if(input.contract.schemaId!==contract.schemaId||input.contract.sha256!==contract.sha256)throw Error('EXISTING_AUDIT_RESPONSE_CONTRACT_INVALID');
 const pinned=store.spec.inputs.localSourceRefs.find(r=>r.inputId===skillId);
 if(input.request.skill.skillId!==skillId||input.request.skill.skillSha256!==pinned?.artifactSha256
  ||!input.profile.freshContext)throw Error('EXISTING_AUDIT_SKILL_OR_CONTEXT_INVALID');
 if(input.auditTargetArtifactId!=='audit-target'||input.physical.skillArtifactId!=='audit-skill'
  ||input.physical.referenceArtifactId!=='audit-references'||input.physical.responseSchemaArtifactId!=='audit-schema')throw Error('EXISTING_AUDIT_PHYSICAL_BINDINGS_INVALID');
 const required=await requiredExistingAuditMaterial(input.directory,auditTarget,stage==='content_audit'?'content':'visual');
 assertExistingAuditPhysicalSet(input.artifacts,required.materials);
 const prepared=prepareSemanticInvocation(input);
 await assertFresh();
 return {...prepared,existingAuditTargetSha256:requestSha256,attemptId:input.attemptId,inputSha256:input.inputSha256,
  formalStageReceipt:false as const,productionEligible:false as const};
}

export const existingAuditStage=(stage:'content'|'visual'):SemanticRequestEnvelope['stage']=>stage==='content'?'content_audit':'visual_audit';
