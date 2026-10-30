import {articleRoute} from "@xpotato/content-contracts";
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {contentMediaRegistrySchema} from '@xpotato/content-contracts';import {buildPrivateCandidateAstro} from '../packages/article-pipeline/src/candidate-astro.js';
import {deterministicBlogSocialCard,SharpCanonicalMediaProcessor,generatePublicDeliveryMaster} from '@xpotato/media-ingest';
import {splitDraft} from '../packages/article-pipeline/src/draft-job.js';
import {taxonomyRegistry} from '../apps/site/src/content-registry/taxonomy/index.js';
import {publicationMetadataPlanSchema} from '../packages/article-pipeline/src/publication-preparation.js';
// Fixture-only rendering helper; never writes canonical content or publishes media.
// @ts-ignore Plain JS uses the browser CDP without a new dependency.
import {renderConcreteVisuals} from './article-concrete-render.mjs';
// @ts-ignore Plain-JS preview state validator.
import {previewHeroOptions} from './article-preview-state.mjs';
const {heroPath,compositionOnly}=previewHeroOptions(process.argv.slice(2),process.env);
const repo=fileURLToPath(new URL('../',import.meta.url)),fixture=join(repo,'tests/fixtures/article-concrete'),out=join(repo,'.local/article-concrete');await mkdir(out,{recursive:true});
const publicationPlan=publicationMetadataPlanSchema.parse(JSON.parse(await readFile(join(repo,'docs/acceptance/articles/3d-print-publication-plan.json'),'utf8')));
const route=articleRoute(publicationPlan.contentId);
const hash=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');const sharp=createRequire(new URL('../apps/site/package.json',import.meta.url))('sharp');
const fonts=(await readFile(join(repo,'apps/site/src/styles/fonts.css'),'utf8'))+(await readFile(join(repo,'apps/site/src/styles/fonts-core.css'),'utf8'));
const ids=["walls-a","walls-b","walls-c","orientation-a","orientation-b","roof-a","roof-b","roof-c"],diagrams:Record<string,string>={};
for(const id of ids)diagrams[id]=hash(await readFile(join(fixture,id+'.svg')));
const renderInput=JSON.stringify({protocol:'xpotato-private-concrete-render-v2',fonts,diagrams});await writeFile(join(out,'render-input.json'),renderInput);
const renderNode=process.env.ARTICLE_PREVIEW_RENDER_NODE;
if(renderNode){
 const script=fileURLToPath(new URL('./article-concrete-render.mjs',import.meta.url));
 const path=process.platform==='linux'&&renderNode.endsWith('.exe')?execFileSync('wslpath',['-w',script],{encoding:'utf8'}).trim():script;
 execFileSync(renderNode,[path],{stdio:'inherit',windowsHide:true,timeout:180000});
}else await renderConcreteVisuals();
const rendered=JSON.parse(await readFile(join(out,'rendered-visuals.json'),'utf8'));
if(rendered.protocol!=='xpotato-private-concrete-render-v2'||rendered.renderInputSha256!==hash(renderInput)||rendered.productionEligible!==false||rendered.images.length!==8||new Set(rendered.images.map((item:{assetId:string})=>item.assetId)).size!==8)throw Error('CONCRETE_RENDER_BINDING_INVALID');
for(const item of rendered.images){if(!ids.includes(item.assetId)||item.file!==item.assetId+'.png')throw Error('CONCRETE_RENDER_PATH_INVALID');const bytes=await readFile(join(out,item.file));if(bytes.length!==item.sizeBytes||hash(bytes)!==item.sha256)throw Error('CONCRETE_RENDER_BYTES_CHANGED');}
const records:any[]=[],objects:any[]=[],sources=rendered.sources;const contentId='e7562440-e0bf-42a9-8a90-d66f4e1a4eb8';
// Final exports require a supplied local hero. Empty slots are explicit composition-only fixtures.
let heroBytes:Buffer,heroSourceSha256:string|null=null;
if(heroPath){
 const input=await readFile(heroPath);if(input.length>24*1024*1024)throw Error('PREVIEW_HERO_TOO_LARGE');
 const metadata=await sharp(input).metadata();
 if(!metadata.width||!metadata.height||Math.abs(metadata.width/metadata.height-16/9)>0.01)throw Error('PREVIEW_HERO_MUST_BE_16_9');
 heroBytes=await sharp(input).rotate().resize(1200,675,{fit:'fill'}).png().toBuffer();heroSourceSha256=hash(input);
}else heroBytes=await sharp({create:{width:1200,height:675,channels:3,background:'#eadfe8'}}).png().toBuffer();
await writeFile(join(out,'cover.png'),heroBytes);
const heroState=compositionOnly?'internal-composition-slot-not-final':'provided-hero';
for(const id of ['cover',...ids]){
 const bytes=await readFile(join(out,id+'.png')),meta=await sharp(bytes).metadata(),sha=hash(bytes);
 const canonical=await new SharpCanonicalMediaProcessor('preview-canonical',out).ingest({schemaVersion:1,sourcePath:join(out,id+'.png'),target:{contentId,semanticAssetId:id},kind:id==='cover'&&!compositionOnly?'photo':'diagram',profileId:'canonical-raster-srgb8-lossless-webp-v1',overwrite:false});
 const {privateRelativePath:_private,...canonicalMaster}=canonical.canonicalMaster;
 records.push({assetId:id,role:id==='cover'?'hero':'inline',origin:id==='cover'&&!compositionOnly?'ai_generated':'diagram',defaultAlt:id==='cover'?(compositionOnly?'扉画像の配置確認用の未確定枠':'フック、小物ケース、内部構造の見本を並べた作業机の生成イメージ'):id,
  canonicalSource:{...canonicalMaster,storageClass:'private_canonical_media_v1',ingestProfileId:canonical.processing.profileId,ingestProfileSha256:canonical.processing.profileSha256},
  delivery:{mode:'fixed',master:{sha256:sha,objectKey:'media/v1/objects/sha256/'+sha.slice(0,2)+'/'+sha+'.png',format:'png',width:meta.width,height:meta.height,sizeBytes:bytes.length},variants:[]},provenanceRef:'article-concrete-review-fixture',rightsRef:'original-review-not-approved',status:'active'});
 objects.push({sha256:sha,path:id+'.png',contentType:'image/png'});
}
const mdx=await readFile(join(fixture,'article.mdx'),'utf8'),fm=splitDraft(mdx).frontmatter;
const category=taxonomyRegistry.blogCategories.find(c=>c.id===fm.category&&c.status==='active');if(!category)throw Error('Unknown fixture category');
const social=await deterministicBlogSocialCard({repositoryRoot:repo,contentId,title:fm.title,categoryLabel:category.label,cardDisplay:fm.cardDisplay});
const socialSource=join(out,'social.svg');await writeFile(socialSource,social.svg);
const socialCanonical=await new SharpCanonicalMediaProcessor('social-canonical',out).ingest({schemaVersion:1,sourcePath:socialSource,target:{contentId,semanticAssetId:'social'},kind:'diagram',profileId:'canonical-raster-srgb8-lossless-webp-v1',overwrite:false});
const socialDelivery=await generatePublicDeliveryMaster(socialCanonical,'social-card-v1','social-delivery',out);
const socialBytes=await readFile(join(out,socialDelivery.privateRelativePath)),socialHash=hash(socialBytes);await writeFile(join(out,'social.png'),socialBytes);
records.push({assetId:'social',role:'social_card',origin:'deterministic_cover',decorative:false,defaultAlt:social.alt,canonicalSource:{...socialCanonical.canonicalMaster,privateRelativePath:undefined,storageClass:'private_canonical_media_v1',ingestProfileId:socialCanonical.processing.profileId,ingestProfileSha256:socialCanonical.processing.profileSha256},
 delivery:{mode:'fixed',master:{sha256:socialHash,objectKey:'media/v1/objects/sha256/'+socialHash.slice(0,2)+'/'+socialHash+'.png',format:'png',width:1200,height:630,sizeBytes:socialBytes.length},variants:[]},provenanceRef:'article-concrete-review-fixture',rightsRef:'original-review-not-approved',status:'active'});
delete records.at(-1).canonicalSource.privateRelativePath;
objects.push({sha256:socialHash,path:'social.png',contentType:'image/png'});
const identity={mdxSha256:hash(mdx),sources,icons:[],hero:{sha256:hash(heroBytes),sourceSha256:heroSourceSha256,state:heroState},social:{sha256:socialHash,profileId:social.binding.profileId,derivationSha256:social.derivationSha256,binding:social.binding}};
const plannedSocialUrl='https://assets.xpotato.net/media/v1/objects/sha256/'+socialHash.slice(0,2)+'/'+socialHash+'.png';
if(publicationPlan.contentId!==contentId||publicationPlan.categoryId!==fm.category||JSON.stringify(publicationPlan.tagIds)!==JSON.stringify(fm.tags))throw Error('PRIVATE_PUBLICATION_PLAN_STALE');
const built=await buildPrivateCandidateAstro({repositoryRoot:repo,contentId,route,mdx,candidateInputSha256:hash(JSON.stringify(identity)),scope:'synthetic_fixture',reference:true,planConfirmed:false,plannedSeo:{canonical:new URL(route,'https://xpotato.net/').href,image:{url:plannedSocialUrl,width:1200,height:630,alt:social.alt}},mediaFolder:out,media:{registry:contentMediaRegistrySchema.parse({schemaVersion:1,contentId,assets:records}),localObjects:objects}});
await writeFile(join(out,'preview.json'),JSON.stringify({root:built.root,output:built.output,route,productionEligible:false,heroState,identity,heroSha256:hash(heroBytes),media:{registry:contentMediaRegistrySchema.parse({schemaVersion:1,contentId,assets:records}),localObjects:objects},files:built.files},null,2));console.log(JSON.stringify({output:built.output,mdxSha256:identity.mdxSha256,socialSha256:socialHash,heroState,productionEligible:false},null,2));
