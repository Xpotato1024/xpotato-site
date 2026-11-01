import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {contentMediaRegistrySchema,articleRoute,localSourceBundleSchema,localEvidenceBundleSchema} from '@xpotato/content-contracts';
import {repository,loadRepository} from './article-repository.js';
import {readDraftStore,splitDraft} from '../packages/article-pipeline/src/draft-job.js';
import {readExistingArticleInput} from '../packages/article-pipeline/src/existing-article-intake.js';
import {compileReceivedCitations} from '../packages/article-pipeline/src/received-citations.js';
import {buildPrivateCandidateAstro} from '../packages/article-pipeline/src/candidate-astro.js';
import {fingerprint,sha256} from '../packages/article-pipeline/src/canonical.js';
import {safeReadBytes,immutable} from '../packages/article-pipeline/src/private-files.js';
import {existingRenderBuildFingerprint,referenceMdx} from '../packages/article-pipeline/src/existing-render-context.js';
import {prepareExistingPublicationMetadata} from '../packages/article-pipeline/src/existing-publication-metadata.js';

// First-article reference only, before the content/visual stage gates. This
// produces no stage receipt, approval, formal candidate or storage operation.
const jobId=process.argv[2];if(!/^job-[a-f0-9-]{36}$/u.test(jobId??''))throw Error('EXACT_EXISTING_JOB_REQUIRED');
const directory=join(repository,'.local/article-jobs',jobId!),store=await readDraftStore(directory),repo=await loadRepository();
if(!store.receivedInput)throw Error('RECEIVED_INPUT_REQUIRED');
const intake=await readExistingArticleInput(join(directory,'..','existing-inputs',store.receivedInput.inputSha256),store.spec.target.contentId,store.receivedInput.inputSha256);
const manuscript=intake.artifacts.find(a=>a.role==='manuscript')!,hero=intake.artifacts.find(a=>a.role==='hero')!;
const original=await safeReadBytes(join(intake.directory,'objects',manuscript.sha256));
const workingText=await readFile(join(directory,'working.md'),'utf8'),working=splitDraft(workingText),originalParsed=splitDraft(original.toString('utf8'));
if(sha256(original)!==store.receivedInput.manuscriptSha256||originalParsed.body!==working.body
 ||fingerprint({...originalParsed.frontmatter,draft:true})!==fingerprint(working.frontmatter))throw Error('REFERENCE_ORIGINAL_INPUT_CHANGED');
const review=join(directory,'attempts',store.activeAttemptId,'review'),head=JSON.parse(await readFile(join(review,'head.json'),'utf8'));
const bound=async(hash:string)=>{if(!/^[a-f0-9]{64}$/u.test(hash))throw Error('REFERENCE_BINDING_INVALID');const value=JSON.parse(await readFile(join(review,'artifacts',hash+'.json'),'utf8'));if(fingerprint(value)!==hash)throw Error('REFERENCE_ARTIFACT_CHANGED');return value;};
const sources=localSourceBundleSchema.parse(await bound(head.bindings.sources)),evidence=localEvidenceBundleSchema.parse(await bound(head.bindings.evidence));
if(sources.scope!=='existing_ai'||sources.existingInput?.inputSha256!==store.receivedInput.inputSha256||sources.existingInput?.manuscriptSha256!==store.receivedInput.manuscriptSha256
 ||evidence.bodySha256!==sha256(working.body)||evidence.sourceBundleSha256!==fingerprint(sources)||!evidence.receivedCitationMarkers)throw Error('REFERENCE_FIXED_INPUT_REQUIRED');
const compiled=compileReceivedCitations(working.body,sources.sources.map(s=>s.record),evidence.receivedCitationMarkers).compiled;
const mdx=referenceMdx(workingText,compiled);
const mediaFolder=join(repository,'.local/article-concrete'),previewPath=join(mediaFolder,'preview.json');
const preview=JSON.parse(await readFile(previewPath,'utf8')),registry=contentMediaRegistrySchema.parse(preview.media.registry);
if(preview.identity.mdxSha256!==manuscript.sha256){
 // Date-only intake reuses unchanged image inputs, never an old page render.
 // The previous exact AI manuscript remains in the new immutable lineage.
 const prior=intake.artifacts.find(a=>a.id==='publication-before-body'&&a.role==='lineage');
 if(!prior||prior.sha256!==preview.identity.mdxSha256)throw Error('REFERENCE_PRIOR_MANUSCRIPT_REQUIRED');
 const priorMdx=(await safeReadBytes(join(intake.directory,'objects',prior.sha256))).toString('utf8');
 const derived=prepareExistingPublicationMetadata(priorMdx,originalParsed.frontmatter.pubDate);
 if(derived.manuscript!==original.toString('utf8'))throw Error('REFERENCE_METADATA_DERIVATION_CHANGED');
}
if(registry.contentId!==store.spec.target.contentId||preview.heroState!=='provided-hero'
 ||preview.identity.hero.sourceSha256!==hero.sha256||preview.identity.icons.length)throw Error('REFERENCE_VISUAL_INPUT_CHANGED');
const originals=intake.artifacts.filter(a=>a.role==='inline');
if(originals.length!==8||preview.identity.sources.length!==8||new Set(preview.identity.sources.map((s:any)=>s.asset)).size!==8||preview.identity.sources.some((s:any)=>!originals.some(a=>a.id==='figure-'+s.asset&&a.sha256===s.sourceSha256)))throw Error('REFERENCE_DIAGRAM_SET_CHANGED');
const ids=['cover','social',...originals.map(a=>a.id.replace(/^figure-/u,''))].sort();
if(fingerprint(registry.assets.map(a=>a.assetId).sort())!==fingerprint(ids)||preview.media.localObjects.length!==10
 ||new Set(preview.media.localObjects.map((o:any)=>o.path)).size!==10||new Set(preview.media.localObjects.map((o:any)=>o.sha256)).size!==10)throw Error('REFERENCE_MEDIA_SET_CHANGED');
for(const object of preview.media.localObjects){
 if(!/^[a-z][a-z0-9-]*\.png$/u.test(object.path)||object.contentType!=='image/png'||!registry.assets.some(a=>a.delivery.master.sha256===object.sha256)
  ||sha256(await safeReadBytes(join(mediaFolder,object.path)))!==object.sha256)throw Error('REFERENCE_IMAGE_CHANGED');
}
const identity={...preview.identity,mdxSha256:manuscript.sha256,compiledBodySha256:sha256(compiled),workingInputSha256:sha256(workingText),renderedMdxSha256:sha256(mdx)};
const route=articleRoute(store.spec.target.contentId),social=registry.assets.find(a=>a.role==='social_card')!.delivery.master;
const renderSourceSha256=await existingRenderBuildFingerprint(repository);
const built=await buildPrivateCandidateAstro({repositoryRoot:repository,contentId:store.spec.target.contentId,route,mdx,
 candidateInputSha256:fingerprint({profile:'existing-reference-with-citations-v1',baseCommit:repo.commit,identity}),scope:'existing_ai',reference:true,planConfirmed:false,
 plannedSeo:{canonical:new URL(route,'https://xpotato.net').href,image:{url:'https://assets.xpotato.net/'+social.objectKey,width:social.width!,height:social.height!,alt:registry.assets.find(a=>a.role==='social_card')!.defaultAlt!}},
 mediaFolder,media:{registry,localObjects:preview.media.localObjects}});
if(renderSourceSha256!==await existingRenderBuildFingerprint(repository))throw Error('REFERENCE_BUILD_SOURCE_CHANGED');
await immutable(join(mediaFolder,'compiled-reference-'+sha256(mdx)+'.mdx'),mdx);
await writeFile(previewPath,JSON.stringify({...preview,root:built.root,output:built.output,route,productionEligible:false,identity,files:built.files,referenceScope:'existing_ai',referenceBaseCommit:repo.commit,referenceRenderSourceSha256:renderSourceSha256},null,2));
console.log(JSON.stringify({reference:true,productionEligible:false,baseCommit:repo.commit,sourceMdxSha256:manuscript.sha256,compiledBodySha256:identity.compiledBodySha256,renderedMdxSha256:identity.renderedMdxSha256,output:built.output}));
