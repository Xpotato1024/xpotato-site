import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {buildPrivateCandidateAstro} from '../packages/article-pipeline/src/candidate-astro.js';
import {contentMediaRegistrySchema} from '@xpotato/content-contracts';
const repo=fileURLToPath(new URL('../',import.meta.url));
const fixture=join(repo,'tests/fixtures/article-readability');
const target=join(repo,'.local/article-readability');
await mkdir(target,{recursive:true});
const sharp=createRequire(new URL('../apps/site/package.json',import.meta.url))('sharp');
const hash=(bytes:string|Buffer)=>createHash('sha256').update(bytes).digest('hex');
const contentId='e7562440-e0bf-42a9-8a90-d66f4e1a4eb8';
const ids=['cover','infill','layers-parallel','layers-normal','failure-modes'];
const records=[],objects=[],sourceFiles=[];
for(const id of ids){
 const svg=await readFile(join(fixture,id+'.svg'));
 if(/<text|<script|onload=|https?:\/\//u.test(svg.toString().replace('http://www.w3.org/2000/svg','')))throw Error('Only self-contained, text-free fixture SVG is allowed');
 const raster=await sharp(svg,{density:144}).png().toBuffer({resolveWithObject:true});
 const sha=hash(raster.data),file=id+'.png';await writeFile(join(target,file),raster.data);
 records.push({assetId:id,role:id==='cover'?'hero':'inline',origin:'diagram',defaultAlt:id==='cover'?'積層した部品の説明用イラスト':id,
 delivery:{mode:'fixed',master:{sha256:sha,objectKey:'media/v1/objects/sha256/'+sha.slice(0,2)+'/'+sha+'.png',format:'png',width:raster.info.width,height:raster.info.height,sizeBytes:raster.data.length},variants:[]},
 provenanceRef:'synthetic-readability-fixture',rightsRef:'self-created-fixture-not-publication-approved',status:'active'});
 objects.push({sha256:sha,path:file,contentType:'image/png'});
 sourceFiles.push({path:id+'.svg',sha256:hash(svg)});
}
const mdx=await readFile(join(fixture,'article.mdx'),'utf8');
const identity={mdxSha256:hash(mdx),sources:sourceFiles};
const built=await buildPrivateCandidateAstro({repositoryRoot:repo,contentId,route:'/blog/article-infill-review/',mdx,candidateInputSha256:hash(JSON.stringify(identity)),scope:'synthetic_fixture',reference:true,planConfirmed:false,
 plannedSeo:{canonical:'https://xpotato.net/blog/article-infill-review/',image:null},mediaFolder:target,
 media:{registry:contentMediaRegistrySchema.parse({schemaVersion:1,contentId,assets:records}),localObjects:objects}});
await writeFile(join(target,'preview.json'),JSON.stringify({scope:'synthetic_fixture',productionEligible:false,approval:false,identity,root:built.root,output:built.output,route:'/blog/article-infill-review/',files:built.files,buildConfigSha256:built.buildConfigSha256},null,2));
console.log(JSON.stringify({output:built.output,route:'/blog/article-infill-review/',identity},null,2));