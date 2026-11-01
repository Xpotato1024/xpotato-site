import {z} from 'zod';
import {stringify} from 'yaml';
import {join,resolve} from 'node:path';
import {contentIdSchema,sha256Schema,stableIdSchema} from '@xpotato/content-contracts';
import {inspectRasterBytes} from '@xpotato/media-ingest';
import {articleMediaReferences} from '@xpotato/portable-content/media';
import {readExistingArticleInput} from './existing-article-intake.js';
import {safeReadBytes} from './private-files.js';
import {fingerprint,canonicalJson,sha256} from './canonical.js';
import type {readDraftStore} from './draft-job.js';
import {splitDraft} from './draft-job.js';

const image=z.object({imageId:stableIdSchema,kind:z.enum(['full_page','detail']),viewport:z.union([z.literal(320),z.literal(390),z.literal(1440)]),
 assetIds:z.array(stableIdSchema).max(12),sha256:sha256Schema,sizeBytes:z.number().int().positive().max(4*1024*1024),
 width:z.number().int().positive().max(1440),height:z.number().int().positive().max(16383),base64:z.string().max(6*1024*1024)}).strict();
export const existingRenderContextSchema=z.object({protocol:z.literal('xpotato-private-existing-render-context-v1'),contentId:contentIdSchema,
 baseCommit:z.string().regex(/^[a-f0-9]{40}$/u),renderSourceSha256:sha256Schema,manuscriptSha256:sha256Schema,bodySha256:sha256Schema,compiledBodySha256:sha256Schema,
 workingInputSha256:sha256Schema,renderedMdxSha256:sha256Schema,
 scope:z.literal('reference_render_only'),productionEligible:z.literal(false),humanApproval:z.literal(false),
 sourceAssets:z.array(z.object({artifactId:stableIdSchema,assetId:stableIdSchema,sha256:sha256Schema}).strict()).min(1).max(13),
 canonicalAssets:z.array(z.object({assetId:stableIdSchema,sha256:sha256Schema}).strict()).min(2).max(14),
 browser:z.string().min(1).max(200),physicalMobile:z.literal(false),
 observations:z.array(z.object({viewport:z.union([z.literal(320),z.literal(390),z.literal(1440)]),horizontalOverflow:z.literal(false),
  imagesLoaded:z.literal(true),bodyFontPx:z.number().positive(),diagramLabelPx:z.array(z.number().min(14).max(18.1)).max(12),
  bodyFontFamilies:z.array(z.string().min(1)).min(1).max(8),headingFontFamilies:z.array(z.string().min(1)).min(1).max(8)}).strict()).length(3),
 images:z.array(image).min(3).max(32)}).strict();

export function referenceMdx(workingText:string,compiledBody:string){
 const frontmatter=splitDraft(workingText).frontmatter;
 return '---\n'+stringify({...frontmatter,draft:false},{lineWidth:0}).trimEnd()+'\n---\n'+compiledBody;
}
export function assertRenderSourceBinding(context:z.infer<typeof existingRenderContextSchema>,input:{contentId:string;baseCommit:string;manuscriptSha256:string;body:string;compiledBody:string;workingInputSha256:string;renderedMdxSha256:string;
 artifacts:readonly {id:string;role:string;sha256:string}[]}){
 if(context.contentId!==input.contentId||context.baseCommit!==input.baseCommit||context.manuscriptSha256!==input.manuscriptSha256||context.bodySha256!==sha256(input.body)||context.compiledBodySha256!==sha256(input.compiledBody)
  ||context.workingInputSha256!==input.workingInputSha256||context.renderedMdxSha256!==input.renderedMdxSha256)throw Error('AUDIT_RENDER_ARTICLE_BINDING_INVALID');
 const original=input.artifacts.filter(a=>a.role==='hero'||a.role==='inline');
 const expected=[...articleMediaReferences(input.body)].sort();
 if(context.sourceAssets.length!==original.length||new Set(context.sourceAssets.map(a=>a.artifactId)).size!==original.length
  ||context.sourceAssets.some(s=>!original.some(a=>a.id===s.artifactId&&a.sha256===s.sha256))
  ||context.sourceAssets.find(a=>a.artifactId===original.find(a=>a.role==='hero')?.id)?.assetId!=='article-hero'
  ||fingerprint(context.sourceAssets.filter(a=>a.artifactId!==original.find(a=>a.role==='hero')?.id).map(a=>a.assetId).sort())!==fingerprint(expected))throw Error('AUDIT_RENDER_SOURCE_SET_INVALID');
 const assets=[...expected,'article-hero','article-social'].sort();
 if(fingerprint(context.canonicalAssets.map(a=>a.assetId).sort())!==fingerprint(assets))throw Error('AUDIT_RENDER_CANONICAL_SET_INVALID');
 if(new Set(context.images.map(i=>i.imageId)).size!==context.images.length||new Set(context.observations.map(o=>o.viewport)).size!==3)throw Error('AUDIT_RENDER_VIEWPORT_SET_INVALID');
 for(const viewport of [320,390,1440]){
  const rows=context.images.filter(i=>i.viewport===viewport);
  if(rows.filter(i=>i.kind==='full_page').length!==1||fingerprint(rows.find(i=>i.kind==='full_page')?.assetIds.slice().sort())!==fingerprint(expected)
   ||rows.some(i=>i.width!==viewport||i.assetIds.some(id=>!expected.includes(id))))throw Error('AUDIT_RENDER_VIEWPORT_SET_INVALID');
  const details=new Set(rows.filter(i=>i.kind==='detail').flatMap(i=>i.assetIds));
  if(expected.some(id=>!details.has(id)))throw Error('AUDIT_RENDER_DETAIL_COVERAGE_REQUIRED');
  const observation=context.observations.find(o=>o.viewport===viewport)!;
  if(observation.diagramLabelPx.length!==expected.length||!observation.bodyFontFamilies.some(s=>/Zen.*Kaku/iu.test(s))
   ||!observation.headingFontFamilies.some(s=>/Noto.*Serif.*JP/iu.test(s)))throw Error('AUDIT_RENDER_FONT_OBSERVATION_REQUIRED');
 }
}
export function assertRenderMasterBinding(context:z.infer<typeof existingRenderContextSchema>,masters:{assets:readonly {assetId:string;ingest:{canonicalMaster:{sha256:string}}}[]}){
 if(fingerprint(masters.assets.map(a=>({assetId:a.assetId,sha256:a.ingest.canonicalMaster.sha256})).sort((a,b)=>a.assetId.localeCompare(b.assetId)))
  !==fingerprint([...context.canonicalAssets].sort((a,b)=>a.assetId.localeCompare(b.assetId))))throw Error('AUDIT_RENDER_MASTERS_DIFFER');
}
export function assertRenderBuildBinding(context:z.infer<typeof existingRenderContextSchema>,current:string){
 if(context.renderSourceSha256!==current)throw Error('AUDIT_RENDER_BUILD_CHANGED');
}
export const renderProducerPaths=[
 'scripts/article-concrete-preview.ts','scripts/article-concrete-render.mjs','scripts/article-concrete-browser.mjs',
 'scripts/article-concrete-check.mjs','scripts/article-concrete-export.mjs','scripts/article-preview-state.mjs','scripts/article-existing-reference.ts',
 'docs/acceptance/articles/3d-print-publication-plan.json',
 ...['article.mdx','walls-a.svg','walls-b.svg','walls-c.svg','orientation-a.svg','orientation-b.svg','roof-a.svg','roof-b.svg','roof-c.svg'].map(p=>'tests/fixtures/article-concrete/'+p),
] as const;
export function renderDependencyFingerprint(sharedLayout:string,producer:readonly {path:string;sha256:string}[]){
 return fingerprint({profile:'existing-reference-page-render-v1',sharedLayout,producer});
}
export async function existingRenderBuildFingerprint(repositoryRoot:string){
 const {candidateBuildFingerprint}=await import('./candidate-material.js');
 const producer=await Promise.all(renderProducerPaths.map(async path=>({path,sha256:sha256(await safeReadBytes(join(repositoryRoot,path)))})));
 return renderDependencyFingerprint(await candidateBuildFingerprint(repositoryRoot),producer);
}
export async function decodeRenderImages(context:z.infer<typeof existingRenderContextSchema>){
 const images:Record<string,Buffer>={};
 for(const i of context.images){
  const raw=Buffer.from(i.base64,'base64');if(raw.toString('base64')!==i.base64||raw.length!==i.sizeBytes||sha256(raw)!==i.sha256)throw Error('AUDIT_RENDER_IMAGE_CHANGED');
  const m=await inspectRasterBytes(raw);
  if(m.format!=='webp'||m.width!==i.width||m.height!==i.height||m.exif||m.xmp||m.orientation||(m.pages??1)>1)throw Error('AUDIT_RENDER_IMAGE_PROFILE_INVALID');
  images['audit-image-render-'+i.imageId]=raw;
 }
 return images;
}

/** Existing article input may carry a deterministic reference-render lineage.
 * It is neither publication nor human approval. The exact current article,
 * original media, canonical pixels and every screenshot remain hash-bound.
 */
export async function existingRenderMaterials(directory:string,store:Awaited<ReturnType<typeof readDraftStore>>,workingText:string,compiledBody:string,
 masters?:{assets:readonly {assetId:string;ingest:{canonicalMaster:{sha256:string}}}[]}){
 const intake=await readExistingArticleInput(join(directory,'..','existing-inputs',store.receivedInput!.inputSha256),store.spec.target.contentId,store.receivedInput!.inputSha256);
 const artifact=intake.artifacts.find(a=>a.id==='audit-page-rendering'&&a.role==='lineage');
 if(!artifact)return {} as Record<string,Buffer>;
 const bytes=await safeReadBytes(join(intake.directory,'objects',artifact.sha256));
 if(sha256(bytes)!==artifact.sha256)throw Error('AUDIT_RENDER_ARTIFACT_CHANGED');
 const context=existingRenderContextSchema.parse(JSON.parse(bytes.toString('utf8')));
 const repositoryRoot=resolve(directory,'../../..');
 if(resolve(directory)!==join(repositoryRoot,'.local','article-jobs',store.jobId))throw Error('AUDIT_RENDER_JOB_LOCATION_INVALID');
 // This is historical evidence of the page the auditor actually saw, not
 // an assertion that today's renderer is byte-identical. Article/source/
 // canonical image bindings below remain exact; current rendering is QA'd
 // separately and unrelated code changes do not rerun semantic AI audits.
 assertRenderSourceBinding(context,{contentId:store.spec.target.contentId,baseCommit:store.baseCommit,manuscriptSha256:store.receivedInput!.manuscriptSha256,
  body:splitDraft(workingText).body,compiledBody,workingInputSha256:sha256(workingText),renderedMdxSha256:sha256(referenceMdx(workingText,compiledBody)),artifacts:intake.artifacts});
 if(masters)assertRenderMasterBinding(context,masters);
 const images=await decodeRenderImages(context);
 const metadata={...context,images:context.images.map(({base64,...i})=>i)};
 return {'audit-render-context':Buffer.from(canonicalJson(metadata)),...images};
}
