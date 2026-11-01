import {describe,it,expect} from 'vitest';
import sharp from 'sharp';
import {existingRenderContextSchema,assertRenderSourceBinding,assertRenderMasterBinding,assertRenderBuildBinding,decodeRenderImages,renderDependencyFingerprint,renderProducerPaths,referenceMdx} from './existing-render-context.js';
import {splitDraft} from './draft-job.js';
import {sha256} from './canonical.js';
const hash='a'.repeat(64),body='<Figure asset="diagram" alt="A fixed comparison" />';
const input={contentId:'e7562440-e0bf-42a9-8a90-d66f4e1a4eb8',baseCommit:'a'.repeat(40),manuscriptSha256:hash,body,compiledBody:body,workingInputSha256:hash,renderedMdxSha256:hash,
 artifacts:[{id:'hero',role:'hero',sha256:hash},{id:'figure-diagram',role:'inline',sha256:hash}]};
function fixture(){return existingRenderContextSchema.parse({protocol:'xpotato-private-existing-render-context-v1',...{contentId:input.contentId,baseCommit:input.baseCommit,manuscriptSha256:hash},bodySha256:sha256(body),compiledBodySha256:sha256(body),renderSourceSha256:hash,
 workingInputSha256:hash,renderedMdxSha256:hash,scope:'reference_render_only',productionEligible:false,humanApproval:false,sourceAssets:[{artifactId:'hero',assetId:'article-hero',sha256:hash},{artifactId:'figure-diagram',assetId:'diagram',sha256:hash}],
 canonicalAssets:['article-hero','article-social','diagram'].map(assetId=>({assetId,sha256:hash})),browser:'fixture browser',physicalMobile:false,
 observations:[320,390,1440].map(viewport=>({viewport,horizontalOverflow:false,imagesLoaded:true,bodyFontPx:18,diagramLabelPx:[16],bodyFontFamilies:['Zen Kaku Gothic New'],headingFontFamilies:['Noto Serif JP']})),
 images:[320,390,1440].flatMap(viewport=>['full_page','detail'].map(kind=>({imageId:kind.replace('_','-')+'-'+viewport,kind,viewport,assetIds:['diagram'],sha256:hash,sizeBytes:10,width:viewport,height:1000,base64:'AA=='})))});}
describe('fixed existing-article reference render context',()=>{
 it('binds all frontmatter and compiled text while projecting only draft:false for the private page',()=>{
  const source='---\nid: '+input.contentId+'\ntitle: Fixed title\ndescription: Fixed test description\npubDate: 2026-10-29\ncategory: 3d-printing\ntags: []\ndraft: true\n---\n'+body;
  const compiled=body+'\n\nFixed citation output.\n',parsed=splitDraft(referenceMdx(source,compiled));
  expect(parsed.body).toBe(compiled);expect(parsed.frontmatter).toEqual({...splitDraft(source).frontmatter,draft:false});
  expect(sha256(referenceMdx(source.replace('Fixed title','Changed title'),compiled))).not.toBe(sha256(referenceMdx(source,compiled)));
  for(const key of ['workingInputSha256','renderedMdxSha256'])expect(()=>assertRenderSourceBinding(fixture(),{...input,[key]:'b'.repeat(64)})).toThrow('ARTICLE_BINDING');
 });
 it('invalidates renderer/dependency changes and rejects oversized raster dimensions',()=>{
  const c=fixture();expect(()=>assertRenderBuildBinding(c,hash)).not.toThrow();expect(()=>assertRenderBuildBinding(c,'b'.repeat(64))).toThrow('BUILD_CHANGED');
  const sources=renderProducerPaths.map(path=>({path,sha256:hash})),before=renderDependencyFingerprint(hash,sources);
  for(const index of sources.map((_,i)=>i)){
   const changed=sources.map((s,i)=>i===index?{...s,sha256:'b'.repeat(64)}:s);
   expect(renderDependencyFingerprint(hash,changed)).not.toBe(before);
  }
  expect(renderDependencyFingerprint('b'.repeat(64),sources)).not.toBe(before);
  c.images[0]!.height=16384;expect(existingRenderContextSchema.safeParse(c).success).toBe(false);
 });
 it('requires exact current article, source media and all viewport detail coverage without claiming approval',()=>{
  const c=fixture();expect(()=>assertRenderSourceBinding(c,input)).not.toThrow();expect(c.humanApproval).toBe(false);
  for(const change of [()=>({...input,body:body+'changed'}),()=>({...input,compiledBody:body+'changed citation'}),()=>({...input,baseCommit:'b'.repeat(40)}),()=>({...input,artifacts:input.artifacts.slice(0,1)})])
   expect(()=>assertRenderSourceBinding(c,change())).toThrow();
  c.images=c.images.filter(i=>i.kind!=='detail'||i.viewport!==320);expect(()=>assertRenderSourceBinding(c,input)).toThrow('DETAIL_COVERAGE');
 });
 it('rejects stale/extra source identities, missing viewport, wrong font and different formal master pixels',()=>{
  for(const modify of [(c:ReturnType<typeof fixture>)=>{c.sourceAssets[1]!.sha256='b'.repeat(64);},
   (c:ReturnType<typeof fixture>)=>{c.images=c.images.filter(i=>i.viewport!==390);},
   (c:ReturnType<typeof fixture>)=>{c.observations[0]!.headingFontFamilies=['Fallback serif'];}]){
   const c=fixture();modify(c);expect(()=>assertRenderSourceBinding(c,input)).toThrow();
  }
  const c=fixture(),masters={assets:c.canonicalAssets.map(a=>({assetId:a.assetId,ingest:{canonicalMaster:{sha256:a.sha256}}}))};
  expect(()=>assertRenderMasterBinding(c,masters)).not.toThrow();masters.assets[0]!.ingest.canonicalMaster.sha256='b'.repeat(64);
  expect(()=>assertRenderMasterBinding(c,masters)).toThrow('MASTERS_DIFFER');
 });
 it('checks actual image format/dimensions/hash and rejects changed bytes or hidden mismatches',async()=>{
  const c=fixture(),bytes=await sharp({create:{width:320,height:1000,channels:3,background:'white'}}).webp({lossless:true}).toBuffer();
  c.images=[{...c.images[0]!,base64:bytes.toString('base64'),sha256:sha256(bytes),sizeBytes:bytes.length}];
  expect(Object.keys(await decodeRenderImages(c))).toHaveLength(1);
  c.images[0]!.width=390;await expect(decodeRenderImages(c)).rejects.toThrow('PROFILE');c.images[0]!.width=320;
  c.images[0]!.sha256='b'.repeat(64);await expect(decodeRenderImages(c)).rejects.toThrow('CHANGED');
 });
});
