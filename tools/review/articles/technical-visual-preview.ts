// Explicit synthetic fixture only. It never writes canonical content or publication artifacts.
import {readFile,mkdir,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {articleRoute,contentMediaRegistrySchema} from '@xpotato/content-contracts';
import {buildPrivateCandidateAstro,removeOwnedCandidateTemp} from '../../../packages/article-pipeline/src/candidate/candidate-astro.js';
// Authoring-only JavaScript entrypoint; the public build never imports this fixture.
// @ts-expect-error Authoring CLI intentionally exposes a JavaScript API.
import {produceVisual,noLinks} from '../../authoring/technical-visuals/cli.mjs';
const repo=fileURLToPath(new URL('../../../',import.meta.url));
const target=resolve(repo,'.local/technical-visual-preview');
await noLinks(join(repo,'.local'));await mkdir(target,{mode:0o700});
let ownedBuildRoot:string|undefined,success=false;
try {
const hash=(bytes:string|Buffer)=>createHash('sha256').update(bytes).digest('hex');
const contentId='930963de-d46e-4db0-97b6-2d0b70bb0062';
const records=[],objects=[],sources=[];
const sharp=createRequire(new URL('../../../apps/site/package.json',import.meta.url))('sharp');
for(const [id,mode,file] of [['flow','mermaid','flow.mmd'],['line','chart','line.json'],['scatter','chart','scatter.json'],['bar','chart','bar.json']]){
  const folder=join(target,id!);
  const receipt=await produceVisual({mode,input:join(repo,'templates/technical-visuals',file!),output:folder});
  const png=await readFile(join(folder,'poster.png')),metadata=await sharp(png).metadata();
  const sha=hash(png),path=id+'.png';await writeFile(join(target,path),png,{flag:'wx'});
  sources.push({id,inputSha256:receipt.inputSha256,receiptSha256:hash(await readFile(join(folder,'receipt.json')))});
  records.push({assetId:id,role:'inline',origin:'diagram',defaultAlt:'合成データの表示検証用 '+id,
    delivery:{mode:'fixed',master:{sha256:sha,objectKey:'media/v1/objects/sha256/'+sha.slice(0,2)+'/'+sha+'.png',format:'png',
      width:metadata.width,height:metadata.height,sizeBytes:png.length},variants:[]},
    provenanceRef:'synthetic-technical-visual-fixture',rightsRef:'self-created-fixture-not-publication-approved',status:'active'});
  objects.push({sha256:sha,path,contentType:'image/png'});
}
const mdx=await readFile(join(repo,'tests/fixtures/technical-visuals/article.mdx'),'utf8');
const identity={mdxSha256:hash(mdx),sources};
const built=await buildPrivateCandidateAstro({repositoryRoot:repo,contentId,route:articleRoute(contentId),mdx,
  candidateInputSha256:hash(JSON.stringify(identity)),scope:'synthetic_fixture',reference:true,planConfirmed:false,
  plannedSeo:{canonical:new URL(articleRoute(contentId),'https://xpotato.net/').href,image:null},mediaFolder:target,
  media:{registry:contentMediaRegistrySchema.parse({schemaVersion:1,contentId,assets:records}),localObjects:objects},
  onTemporaryRoot:root=>{ownedBuildRoot=root;}});
  // Persist only the isolated preview. Do not copy fonts into review/download bundles.
  const {cp}=await import('node:fs/promises');
  const output=join(target,'preview');await cp(built.output,output,{recursive:true,errorOnExist:true,force:false});
  await removeOwnedCandidateTemp(built.root,repo);ownedBuildRoot=undefined;
  await writeFile(join(target,'preview.json'),JSON.stringify({protocol:'xpotato-private-technical-visual-preview-v1',scope:'synthetic_fixture',productionEligible:false,approval:false,
    identity,output,route:articleRoute(contentId),buildConfigSha256:built.buildConfigSha256,
    limitations:['Private preview only; excluded from all public build inputs','Local site fonts may be used by preview; never include font files in review downloads']},null,2),{flag:'wx',mode:0o600});
  success=true;
  console.log(JSON.stringify({output,route:articleRoute(contentId)}));
} finally {
  try {if(ownedBuildRoot) await removeOwnedCandidateTemp(ownedBuildRoot,repo);}
  finally {if(!success){await noLinks(target);await rm(target,{recursive:true});}}
}
