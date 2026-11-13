import {z} from 'zod';
import {join} from 'node:path';
import {mkdir} from 'node:fs/promises';
import {stringify} from 'yaml';
import {sha256Schema,articleVisualInputSchema,articleStageReceiptSchema,type ArticleJobState} from '@xpotato/content-contracts';
import {articleMediaReferences} from '@xpotato/portable-content/media';
import {readDraftStore,assertCurrentDraft,splitDraft,type DraftRepository} from '../draft-job.js';
import {readExistingArticleInput} from '../existing-article-intake.js';
import {validateLocalSources,analyzeLocalEvidence} from '../review/review-analysis.js';
import {canonicalJson,fingerprint,sha256} from '../canonical.js';
import {safeRead,safeReadBytes,immutable,atomic,noLinks} from '../private-files.js';
import {assembleVisualPlan,type VisualPlanningContext} from '../visual/visual-plan.js';
import {validateCandidateMediaPlan} from '../visual/visual-analysis.js';
import {coverForPlan,materializeVisualMasters,prepareOwnerReviewedVisualDelivery,verifyVisualMediaBytes} from '../visual/visual-media-runtime.js';
import {assertPersistenceCapabilities} from '../media/media-persistence.js';
import {assertPublicationRights} from './publication-public-metadata.js';
import {preparePublicationRevision,assertPublicationRevisionGit} from './publication-revision.js';
import {ciPublicationAdmissionSchema,validateCiPublicationPackage,validateCiPublicationMedia,publicationSemanticIdentity,type CiPublicationPackage} from './ci-publication-package.js';
import {canTransition} from '../state-machine.js';
import {currentExternalAiPolicyBinding} from '../disclosure.js';
import {ownerReviewDerivations,ownerReviewSubjectSchema,registerOwnerReviewPreparation,ownerReviewPreparationDetails,
 assertOwnerReviewProof,readOwnerReviewProof,type OwnerReviewPreparation,type OwnerReviewProof} from './owner-review-evidence.js';

const sourceHeadSchema=z.object({schemaVersion:z.literal(1),profile:z.literal('article-private-review-journal-v1'),
 receipts:z.array(sha256Schema).max(10),bindings:z.object({sources:sha256Schema,evidence:sha256Schema,audit:sha256Schema.optional()}).strict(),
 outputs:z.record(z.string(),sha256Schema)}).strict();
async function readInputs(directory:string,repo:DraftRepository){
 const store=await readDraftStore(directory),status=await assertCurrentDraft(directory,store,repo);
 if(store.receivedInput?.kind!=='existing_ai'||!store.receivedInput.reviewProfile)throw Error('OWNER_PUBLICATION_EXISTING_AI_REQUIRED');
 const binding={jobId:store.jobId,jobFingerprint:store.jobFingerprint,attemptId:store.activeAttemptId,inputSha256:status.inputSha256};
 const folder=join(directory,'attempts',store.activeAttemptId,'review'),head=sourceHeadSchema.parse(JSON.parse(await safeRead(join(folder,'head.json'))));
 const artifact=async(hash:string)=>{sha256Schema.parse(hash);const data=JSON.parse(await safeRead(join(folder,'artifacts',hash+'.json')));if(fingerprint(data)!==hash)throw Error('OWNER_PUBLICATION_SOURCE_CHANGED');return data;};

 // Verify historical bytes and stage chain without replaying old AI authority.
 let state:ArticleJobState='CREATED',previous:string|null=null;
 const stages=new Set<string>(),allowed:Record<string,ArticleJobState>={sources:'SOURCES_READY',evidence:'EVIDENCE_READY',draft:'DRAFTED',examples:'EXAMPLES_ASSESSED',audit:'CONTENT_AUDITED',content:'CONTENT_READY',revision:'REVISION_REQUIRED'};
 for(const hash of head.receipts){
  const r=articleStageReceiptSchema.parse(JSON.parse(await safeRead(join(folder,'receipts',hash+'.json')))),{receiptSha256,...unsigned}=r;
  const audited=['audit','content','revision'].includes(r.stage),inputs=r.stage==='sources'?['sources']:audited?['sources','evidence','audit']:['sources','evidence'],outputs=r.stage==='sources'?[]:['analysis','auditRequest'];
  const result=r.stage==='revision'?'revision_required':r.stage==='audit'?null:'success';
  if(receiptSha256!==hash||fingerprint(unsigned)!==hash||r.previousReceiptSha256!==previous||r.from!==state||allowed[r.stage]!==r.to||!canTransition(state,r.to)
   ||r.jobId!==binding.jobId||r.jobFingerprint!==binding.jobFingerprint||r.attemptId!==binding.attemptId||r.inputSha256!==binding.inputSha256||r.profileId!=='local-content-review-v1'
   ||fingerprint(Object.keys(r.inputs).sort())!==fingerprint(inputs.sort())||fingerprint(Object.keys(r.outputs).sort())!==fingerprint(outputs.sort())
   ||Object.entries(r.inputs).some(([key,value])=>head.bindings[key as keyof typeof head.bindings]!==value)
   ||Object.entries(r.outputs).some(([key,value])=>head.outputs[key]!==value)
   ||(result?r.result!==result:!['success','revision_required'].includes(r.result)))throw Error('OWNER_PUBLICATION_SOURCE_HISTORY_INVALID');
  stages.add(r.stage);state=r.to;previous=hash;
 }
 if(!['sources','evidence','draft','examples'].every(s=>stages.has(s)))throw Error('OWNER_PUBLICATION_SOURCE_HISTORY_REQUIRED');
 for(const hash of [...Object.values(head.bindings),...Object.values(head.outputs)])if(hash)await artifact(hash);
 for(const role of ['sources','evidence'] as const)if(fingerprint(JSON.parse(await safeRead(join(directory,'working-'+role+'.json'))))!==head.bindings[role])throw Error('OWNER_PUBLICATION_SOURCE_CHANGED');
 const sources=validateLocalSources(await artifact(head.bindings.sources)),evidence=await artifact(head.bindings.evidence),body=splitDraft(status.input).body;
 if(sources.scope!=='existing_ai'||sources.existingInput?.inputSha256!==store.receivedInput.inputSha256||sources.existingInput.manuscriptSha256!==store.receivedInput.manuscriptSha256)throw Error('OWNER_PUBLICATION_INTAKE_BINDING_REQUIRED');
 // Reconstruct factual support and example outcomes. Prior AI judgments are
 // preserved as history, never changed to PASS or used as owner authority.
 const analysis=analyzeLocalEvidence(body,sources,evidence,binding);
 if(fingerprint(analysis)!==head.outputs.analysis||!analysis.examplesReady)throw Error('OWNER_PUBLICATION_EXAMPLE_OR_EVIDENCE_INVALID');
 const intake=await readExistingArticleInput(join(directory,'..','existing-inputs',store.receivedInput.inputSha256),store.spec.target.contentId,store.receivedInput.inputSha256);
 const c:VisualPlanningContext={store,status,binding,body,journal:{head,folder}};
 return {c,sources,analysis,intake};
}
type Details={directory:string;repo:DraftRepository;root:string;visualInput:unknown;createdAt:string;folder:string};
const prepared=new WeakMap<object,Details>();
async function materials(d:Omit<Details,'createdAt'|'folder'>&{createdAt?:string}){
 const {c,sources,analysis,intake}=await readInputs(d.directory,d.repo),fm=splitDraft(c.status.input).frontmatter;
 if(!c.store.spec.permissions.localMediaProcessing||!c.store.spec.permissions.repositoryExport)throw Error('OWNER_PUBLICATION_CAPABILITY_REQUIRED');
 const category=d.repo.categories.find(row=>row.id===fm.category);if(!category)throw Error('OWNER_PUBLICATION_CATEGORY_REQUIRED');
 const visualInput=articleVisualInputSchema.parse(d.visualInput);
 // Reviewed source images must be original intake bytes; no untracked crop,
 // relabelled diagram or newly invented poster is inferred to be reviewed.
 const inputs=[...(visualInput.hero.kind==='local_raster'?[visualInput.hero]:[]),...visualInput.inline];
 if(visualInput.hero.kind!=='local_raster')throw Error('OWNER_PUBLICATION_REVIEWED_HERO_REQUIRED');
 const reviewedMedia=inputs.map(a=>{
  if(!intake.artifacts.some(original=>['hero','inline'].includes(original.role)&&original.sha256===a.sha256))throw Error('OWNER_PUBLICATION_REVIEWED_SOURCE_MAPPING_REQUIRED');
  return {assetId:a.assetId,sha256:a.sha256};
 });
 const cover=await coverForPlan(d.root,fm,category.label,visualInput.socialCardDisplay),seed=fingerprint({binding:c.binding,head:c.journal.head,visualInput,generator:cover.binding});
 const folder=join(d.directory,'attempts',c.binding.attemptId,'owner-publication',seed);
 await noLinks(folder);await mkdir(folder,{recursive:true,mode:0o700});
 let createdAt=d.createdAt;
 if(!createdAt){try{createdAt=z.iso.datetime().parse(JSON.parse(await safeRead(join(folder,'planning.json'))).createdAt);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;createdAt=new Date().toISOString();await immutable(join(folder,'planning.json'),canonicalJson({createdAt})+'\n');}}
 const plan=await assembleVisualPlan(c,sources,visualInput,fingerprint(cover.binding),createdAt);
 if(!validateCandidateMediaPlan(plan.visualInput.mediaPlan,'existing_ai').confirmed)throw Error('OWNER_PUBLICATION_STORAGE_PLAN_REQUIRED');
 assertPublicationRights(plan.rights);
 const masters=await materializeVisualMasters(d.directory,folder,plan,cover);
 assertPersistenceCapabilities(c.store.spec.permissions,masters.assets.length);
 const unsigned={protocol:'xpotato-private-owner-review-subject-v1' as const,origin:'existing_ai' as const,
  ...c.binding,contentId:fm.id,intakeSha256:c.store.receivedInput!.inputSha256,manuscriptSha256:c.store.receivedInput!.manuscriptSha256,
  bodySha256:sha256(c.body),compiledBodySha256:sha256(analysis.compiled),frontmatterSha256:fingerprint(fm),figureOrder:articleMediaReferences(c.body),
  sourceBundleSha256:analysis.sourceBundleSha256,evidenceBundleSha256:analysis.evidenceBundleSha256,citationCompilationSha256:analysis.citationCompilationSha256,
  technicalExampleVerificationSha256:fingerprint(analysis.examples),reviewHeadSha256:fingerprint(c.journal.head),priorReviewState:'preserved_not_used_as_owner_authority',
  planSha256:plan.planSha256,mastersSha256:masters.mastersSha256,rightsSha256:fingerprint(plan.rights),reviewedMedia,
  canonicalMedia:masters.assets.map(a=>({assetId:a.assetId,sha256:a.ingest.canonicalMaster.sha256})),generatorBindingSha256:plan.generatorBindingSha256,
  derivations:[...ownerReviewDerivations]};
 const subject=ownerReviewSubjectSchema.parse({...unsigned,subjectSha256:fingerprint(unsigned)});
 await immutable(join(folder,'subject.json'),canonicalJson(subject)+'\n');
 return {c,analysis,plan,masters,subject,folder,createdAt,visualInput};
}
/** Local preparation only. No authority, legacy audit stage, network or storage
 * record is created. The current owner-confirmed version can remain unknown. */
export async function prepareOwnerPublicationSubject(directory:string,repo:DraftRepository,root:string,visualInput:unknown){
 const result=await materials({directory,repo,root,visualInput});
 const handle=registerOwnerReviewPreparation(directory,result.subject);
 prepared.set(handle,{directory,repo,root,visualInput:result.visualInput,createdAt:result.createdAt,folder:result.folder});
 await atomic(join(directory,'owner-publication-preparation.json'),canonicalJson({protocol:'xpotato-private-owner-publication-preparation-v1',subjectSha256:result.subject.subjectSha256,visualInput:result.visualInput,createdAt:result.createdAt})+'\n');
 return {handle,subject:result.subject,subjectPath:join(result.folder,'subject.json'),ownerConfirmed:false,storageWrites:0};
}
export async function restoreOwnerPublicationPreparation(directory:string,repo:DraftRepository,root:string){
 const raw=z.object({protocol:z.literal('xpotato-private-owner-publication-preparation-v1'),subjectSha256:sha256Schema,visualInput:articleVisualInputSchema,createdAt:z.iso.datetime()}).strict().parse(JSON.parse(await safeRead(join(directory,'owner-publication-preparation.json'))));
 const m=await materials({directory,repo,root,visualInput:raw.visualInput,createdAt:raw.createdAt});
 if(m.subject.subjectSha256!==raw.subjectSha256)throw Error('OWNER_PUBLICATION_PREPARATION_STALE');
 const handle=registerOwnerReviewPreparation(directory,m.subject);prepared.set(handle,{directory,repo,root,visualInput:raw.visualInput,createdAt:raw.createdAt,folder:m.folder});return handle;
}
export async function prepareOwnerReviewedPublicationBundle(handle:OwnerReviewPreparation,proof:OwnerReviewProof){
 const d=prepared.get(handle);if(!d)throw Error('OWNER_PUBLICATION_PRODUCER_HANDLE_REQUIRED');
 const m=await materials(d),expected=ownerReviewPreparationDetails(handle).subject;
 if(m.subject.subjectSha256!==expected.subjectSha256)throw Error('OWNER_PUBLICATION_PREPARATION_STALE');
 const review=await assertOwnerReviewProof(proof,{planSha256:m.plan.planSha256,mastersSha256:m.masters.mastersSha256});
 if(review.subject.subjectSha256!==expected.subjectSha256)throw Error('OWNER_PUBLICATION_REVIEW_TARGET_MISMATCH');
 const media=await prepareOwnerReviewedVisualDelivery(m.folder,m.plan,m.masters,proof);
 await verifyVisualMediaBytes(m.folder,m.masters,media);
 const fm=splitDraft(m.c.status.input).frontmatter,mdx='---\n'+stringify({...fm,draft:false},{lineWidth:0,compat:'yaml-1.1'}).trimEnd()+'\n---\n'+m.analysis.compiled;
 const revision=m.c.store.original?preparePublicationRevision(d.repo,fm.id,m.c.store.spec.target.updateKind):undefined;
 if(revision){if(m.c.store.original!.sourceSha256!==revision.previous.mdxSha256)throw Error('CI_UPDATE_BASE_CONFLICT');assertPublicationRevisionGit(d.root,d.repo.commit,fm.id,revision);}
 const objects:CiPublicationPackage['objects']=[],seen=new Set<string>();
 const add=async(plane:'source'|'public',key:string,hash:string,sizeBytes:number,path:string,contentType:string,cacheControl:string)=>{
  if(seen.has(plane+':'+key))return;const bytes=await safeReadBytes(join(m.folder,path));
  if(sha256(bytes)!==hash||bytes.length!==sizeBytes)throw Error('OWNER_PUBLICATION_MEDIA_CHANGED');
  seen.add(plane+':'+key);objects.push({plane,key,sha256:hash,sizeBytes,contentType,cacheControl,base64:bytes.toString('base64')});
 };
 for(const a of media.registry.assets){
  const s=a.canonicalSource!,master=m.masters.assets.find(x=>x.assetId===a.assetId)!;
  await add('source','source/v1/objects/sha256/'+s.sha256.slice(0,2)+'/'+s.sha256+'.'+s.format,s.sha256,s.sizeBytes,master.ingest.canonicalMaster.privateRelativePath,'image/'+s.format,'private, no-store');
  for(const o of [a.delivery.master,...a.delivery.variants]){
   const local=media.localObjects.find(x=>x.sha256===o.sha256);if(!local)throw Error('OWNER_PUBLICATION_MEDIA_CHANGED');
   await add('public',o.objectKey,o.sha256,o.sizeBytes,local.path,local.contentType,'public, max-age=31536000, immutable');
  }
 }
 const unsigned={protocol:'xpotato-ci-publication-package-v1' as const,scope:'existing_ai' as const,contentId:fm.id,mdx,registry:media.registry,rights:m.plan.rights,
  evidence:{jobId:m.c.store.jobId,sourceBundleSha256:m.analysis.sourceBundleSha256,evidenceBundleSha256:m.analysis.evidenceBundleSha256,
   citationCompilationSha256:m.analysis.citationCompilationSha256,technicalExampleVerificationSha256:fingerprint(m.analysis.examples),
   externalAiPolicyId:currentExternalAiPolicyBinding.policyId,externalAiPolicySha256:currentExternalAiPolicyBinding.policySha256,
   reviewBasis:'owner_reviewed' as const,ownerReview:review.compact},
  sourceRefs:m.analysis.sourceRefs,materialClaims:m.analysis.materialClaims,
  mediaSources:media.registry.assets.map(a=>({assetId:a.assetId,canonicalSha256:a.canonicalSource!.sha256,format:a.canonicalSource!.format,
   width:a.canonicalSource!.width,height:a.canonicalSource!.height,ingestProfileId:a.canonicalSource!.ingestProfileId,ingestProfileSha256:a.canonicalSource!.ingestProfileSha256,storageClass:a.canonicalSource!.storageClass})),
  aiRuns:[],variantManifests:media.variants.map(v=>({assetId:v.assetId,sha256:v.manifestSha256})),objects,...(revision?{revision}:{})};
 const p=validateCiPublicationPackage({...unsigned,semanticSha256:publicationSemanticIdentity(unsigned)});await validateCiPublicationMedia(p);
 const bytes=Buffer.from(canonicalJson(p)+'\n'),admission=ciPublicationAdmissionSchema.parse({protocol:'xpotato-reviewed-publication-admission-v1',
  contentId:p.contentId,packageSha256:sha256(bytes),semanticSha256:p.semanticSha256,producer:'verified-owner-reviewed-existing-ai-prepare-v1',evidence:p.evidence,aiRuns:p.aiRuns});
 // Detect changes/withdrawal during local compilation. No provider is invoked.
 if((await materials(d)).subject.subjectSha256!==expected.subjectSha256)throw Error('OWNER_PUBLICATION_PREPARATION_STALE');
 await assertOwnerReviewProof(proof);
 return {package:p,bytes,admission,storageWrites:0,publicationApproved:false};
}
export async function prepareStoredOwnerReviewedPublicationBundle(directory:string,repo:DraftRepository,root:string){
 const handle=await restoreOwnerPublicationPreparation(directory,repo,root);
 return prepareOwnerReviewedPublicationBundle(handle,await readOwnerReviewProof(handle));
}
