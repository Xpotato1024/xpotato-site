import {articleUrlId,assertArticleRoute} from "@xpotato/content-contracts";
import {constants} from "node:fs";
import {mkdir,readdir,writeFile,readFile,rm,realpath,open} from "node:fs/promises";
import {join,dirname,resolve,basename} from "node:path";
import {tmpdir} from "node:os";
import {createRequire} from "node:module";
import {pathToFileURL} from "node:url";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {candidateBuildInputSchema,semanticContentModulePropsSchemas,type CandidateBuildInput,type ArticleVisualMedia} from "@xpotato/content-contracts";
import {validatePortableMdx} from "@xpotato/portable-content";
import {articleMediaReferences} from "@xpotato/portable-content/media";
import {reviewTree,walkReview} from "@xpotato/portable-content/review";
import {splitDraft} from "./draft-job.js";
import {canonicalJson,sha256,fingerprint} from "./canonical.js";
import {safeRead,safeReadBytes,noLinks,immutableBytes,inside,fail} from "./private-files.js";
const run=promisify(execFile);
export async function assertCandidateContentAllowed(repositoryRoot:string,contentId:string){
 const map=JSON.parse(await safeRead(join(repositoryRoot,"docs/migration/content-id-map-v1.json")));
 const entries=map.entries.filter((item:{collection:string})=>item.collection==="blog");
 if(entries.length!==44||new Set(entries.map((item:{vNextContentId:string})=>item.vNextContentId)).size!==44)fail("CANDIDATE_MIGRATION_COHORT_INVALID",3);
 if(entries.some((item:{vNextContentId:string})=>item.vNextContentId===contentId))fail("CANDIDATE_LEGACY_HOLD_PROTECTED",3);
}
export async function localFileManifest(root:string){
 const entries:{path:string;absolute:string}[]=[],files:{path:string;sha256:string;sizeBytes:number}[]=[];let totalBytes=0;
 async function walk(folder:string,prefix=""){
  if(prefix.split("/").length>32)fail("CANDIDATE_FILE_TREE_LIMIT",3);
  await noLinks(folder);
  for(const entry of (await readdir(folder,{withFileTypes:true})).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){
   const path=prefix+entry.name;
   if(entry.isDirectory())await walk(join(folder,entry.name),path+"/");
   else if(entry.isFile()){
    if(entries.length>=10000)fail("CANDIDATE_FILE_TREE_LIMIT",3);
    entries.push({path,absolute:join(folder,entry.name)});
   }else fail("CANDIDATE_OUTPUT_NOT_REGULAR",3);
  }
 }
 await walk(root);
 const readEntry=async(entry:{path:string;absolute:string})=>{
  const file=await open(entry.absolute,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
  try{
   const info=await file.stat();
   if(!info.isFile()||info.nlink>1||info.size>24*1024*1024)fail("CANDIDATE_OUTPUT_FILE_INVALID",3);
   const bytes=await file.readFile();totalBytes+=bytes.length;
   if(bytes.length>24*1024*1024||totalBytes>256*1024*1024)fail("CANDIDATE_FILE_TREE_LIMIT",3);
   return {path:entry.path,sha256:sha256(bytes),sizeBytes:bytes.length};
  }finally{await file.close();}
 };
 // Bound descriptors/memory; settle every open file before propagating a batch error.
 for(let offset=0;offset<entries.length;offset+=8){
  const results=await Promise.allSettled(entries.slice(offset,offset+8).map(readEntry));
  const rejected=results.find(result=>result.status==="rejected");
  if(rejected?.status==="rejected")throw rejected.reason;
  for(const result of results)if(result.status==="fulfilled")files.push(result.value);
 }
 return files.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
}
async function copyStaticPublic(source:string,target:string){
 for(const item of await localFileManifest(source)){
  await mkdir(dirname(join(target,item.path)),{recursive:true,mode:0o700});
  await immutableBytes(join(target,item.path),await safeReadBytes(join(source,item.path)));
 }
}
export async function removeOwnedCandidateTemp(root:string,repositoryRoot:string){
 const base=await realpath(join(repositoryRoot,"apps/site/.local/article-candidate-builds"));
 if(!inside(base,resolve(root))||!basename(root).startsWith("xpotato-private-candidate-"))fail("CANDIDATE_TEMP_DELETE_DENIED",3);
 await noLinks(root);await rm(root,{recursive:true,force:true});
}
export function candidateAstroConfiguration(repositoryRoot:string,canonical:string){
 const siteRequire=createRequire(join(repositoryRoot,"apps/site/package.json"));
 const absolute=(path:string)=>pathToFileURL(siteRequire.resolve(path)).href;
 const local=(path:string)=>pathToFileURL(join(repositoryRoot,path)).href;
 const config='import {defineConfig} from '+JSON.stringify(absolute("astro/config"))+';\n'
  +'import mdx from '+JSON.stringify(absolute("@astrojs/mdx"))+';\n'
  +'import tailwindcss from '+JSON.stringify(absolute("@tailwindcss/vite"))+';\n'
  +'import {unified} from '+JSON.stringify(absolute("@astrojs/markdown-remark"))+';\n'
  +'import {codeBlockTransformer} from '+JSON.stringify(local("apps/site/src/lib/code-block-transformer.mjs"))+';\n'
  +'import {remarkMathBlocks} from '+JSON.stringify(local("apps/site/src/lib/math-blocks.mjs"))+';\n'
  +'import {routeFontIntegration} from '+JSON.stringify(local("apps/site/src/lib/font-subsets.mjs"))+';\n'
  +'export default defineConfig({site:'+JSON.stringify(new URL(canonical).origin)+',output:"static",outDir:"./output",cacheDir:"./cache",'
  +'markdown:{shikiConfig:{theme:"github-dark",transformers:[codeBlockTransformer]}},'
  +'integrations:[routeFontIntegration(),mdx({processor:unified({remarkPlugins:[remarkMathBlocks]})})],'
  +'vite:{plugins:[tailwindcss()],ssr:{noExternal:["@astrojs/react","@astrojs/mdx","@xpotato/content-contracts","@xpotato/portable-content"]},resolve:{alias:{react:'+JSON.stringify(dirname(siteRequire.resolve("react/package.json")))
  +',"react-dom":'+JSON.stringify(dirname(siteRequire.resolve("react-dom/package.json")))+'},dedupe:["react","react-dom"]}}});\n';

 return config;
}
export function candidateAstroConfigurationSha256(repositoryRoot:string,canonical:string){
 return sha256(candidateAstroConfiguration(repositoryRoot,canonical).replaceAll(pathToFileURL(repositoryRoot).href,"$REPO_URL").replaceAll(repositoryRoot,"$REPO"));
}
export async function buildPrivateCandidateAstro(input:{repositoryRoot:string;contentId:string;route:string;mdx:string;candidateInputSha256:string;
 scope:"human_local"|"synthetic_fixture"|"existing_ai";reference?:boolean;planConfirmed:boolean;plannedSeo:CandidateBuildInput["plannedSeo"];mediaFolder:string;media:Pick<ArticleVisualMedia,"registry"|"localObjects">}){
 const {repositoryRoot,contentId,route,mdx,media}=input;
 await assertCandidateContentAllowed(repositoryRoot,contentId);
 const parsed=splitDraft(mdx),errors=validatePortableMdx(parsed.body);
 if(parsed.frontmatter.id!==contentId||parsed.frontmatter.draft!==false||errors.length)fail("CANDIDATE_MDX_INVALID");
 const modules=new Set<string>(),allowedModules=new Set(Object.keys(semanticContentModulePropsSchemas));
 walkReview(reviewTree(parsed.body),node=>{const item=node as {type:string;name?:string};if(!["mdxJsxFlowElement","mdxJsxTextElement"].includes(item.type))return;
  if(item.name==="Demo")fail("CANDIDATE_INLINE_DEMO_NOT_ADMITTED",3);
  if(!item.name||!allowedModules.has(item.name)||!/^[A-Z][A-Za-z]+$/u.test(item.name))fail("CANDIDATE_MODULE_NOT_ADMITTED");modules.add(item.name);});
 const refs=articleMediaReferences(parsed.body);
 if(refs.some(id=>!media.registry.assets.some(asset=>asset.assetId===id&&asset.status==="active")))fail("CANDIDATE_MEDIA_REFERENCE_INVALID");
 const {mkdtemp}=await import("node:fs/promises");
 const scratchBase=join(repositoryRoot,"apps/site/.local/article-candidate-builds");await noLinks(scratchBase);await mkdir(scratchBase,{recursive:true,mode:0o700});
 const root=await mkdtemp(join(scratchBase,"xpotato-private-candidate-"));await noLinks(root);
 const output=join(root,"output"),contentRoot=join(root,"src/input"),target=join(contentRoot,"candidate.mdx");
 await mkdir(contentRoot,{recursive:true,mode:0o700});await mkdir(join(root,"public"),{recursive:true,mode:0o700});
 await immutableBytes(target,Buffer.from(mdx));
 await copyStaticPublic(join(repositoryRoot,"apps/site/public"),join(root,"public"));
 const urls:Record<string,string>={};
 for(const item of media.localObjects){
  const refs=media.registry.assets.flatMap(asset=>[asset.delivery.master,...asset.delivery.variants]).filter(ref=>ref.sha256===item.sha256);
  if(!refs.length)fail("CANDIDATE_LOCAL_OBJECT_UNREGISTERED");
  const ext=refs[0]!.format==="jpeg"?"jpg":refs[0]!.format;
  const bytes=await safeReadBytes(join(input.mediaFolder,item.path));
  if(sha256(bytes)!==item.sha256)fail("CANDIDATE_MEDIA_HASH_MISMATCH",3);
  const name=item.sha256+"."+ext;urls[item.sha256]="/__candidate_media/"+name;
  await mkdir(join(root,"public/__candidate_media"),{recursive:true,mode:0o700});
  await immutableBytes(join(root,"public/__candidate_media",name),bytes);
 }
 const overlay=candidateBuildInputSchema.parse({schemaVersion:1,protocol:"xpotato-private-candidate-build-input-v1",
  candidateInputSha256:input.candidateInputSha256,contentId,route,buildRoot:root,contentRoot,targetPath:"candidate.mdx",mdxSha256:sha256(mdx),
  overlayFiles:[{path:"candidate.mdx",sha256:sha256(mdx)}],registry:media.registry,localMediaUrls:urls,plannedSeo:input.plannedSeo,
  scope:input.scope,reference:input.reference??true,planConfirmed:input.planConfirmed,productionEligible:false});
 const overlayText=canonicalJson(overlay)+"\n",overlayPath=join(root,"build-input.json");
 await immutableBytes(overlayPath,Buffer.from(overlayText));
 const config=candidateAstroConfiguration(repositoryRoot,input.plannedSeo.canonical);
 const siteRequire=createRequire(join(repositoryRoot,"apps/site/package.json"));
 await writeFile(join(root,"astro.config.mjs"),config,{mode:0o600});
 await writeFile(join(root,"src/content.config.ts"),"export const collections = {};\n",{mode:0o600});
 await writeFile(join(root,"package.json"),JSON.stringify({name:"xpotato-private-candidate",version:"0.0.0",private:true,type:"module"}),{mode:0o600});
 const page='---\nimport Content,{getHeadings} from '+JSON.stringify(target.replaceAll("\\","/"))+';\n'
  +'import ContentLayout from '+JSON.stringify(join(repositoryRoot,"apps/site/src/layouts/ContentLayout.astro").replaceAll("\\","/"))+';\n'
  +[...modules].sort().map(name=>'import '+name+' from '+JSON.stringify(join(repositoryRoot,'apps/site/src/components/content',name+'.astro').replaceAll('\\','/'))+';\n').join('')
  +'import HistoricalReferenceLink from '+JSON.stringify(join(repositoryRoot,"apps/site/src/components/content/HistoricalReferenceLink.astro").replaceAll("\\","/"))+';\n'
  +'import {selectTableOfContents} from '+JSON.stringify(join(repositoryRoot,"apps/site/src/lib/table-of-contents.ts").replaceAll("\\","/"))+';\n'
  +'const fm='+JSON.stringify(parsed.frontmatter)+';const components={'+[...modules].sort().join(',')+([...modules].length?',':'')+'a:HistoricalReferenceLink};\n---\n'
  +'<ContentLayout id={fm.id} collection="blog" title={fm.title} description={fm.description} taxonomy={[fm.category,...fm.tags].join(" ")} seo={fm.seo} headings={selectTableOfContents(getHeadings(),'+JSON.stringify(parsed.body)+')} publication={{pubDate:fm.pubDate,updatedDate:fm.updatedDate,draft:fm.draft}}>'
  +'<div slot="metadata" class="article-meta"><time datetime={fm.pubDate}>{fm.pubDate}</time>{fm.updatedDate&&<span>更新 <time datetime={fm.updatedDate}>{fm.updatedDate}</time></span>}</div>'
  +'<Content components={components}/></ContentLayout>\n';
 assertArticleRoute(route,contentId);const slug=articleUrlId(contentId);
 await mkdir(join(root,"src/pages/articles"),{recursive:true,mode:0o700});await writeFile(join(root,"src/pages/articles",slug+".astro"),page,{mode:0o600});
 const astroRoot=dirname(siteRequire.resolve("astro/package.json")),astroPackage=JSON.parse(await readFile(join(astroRoot,"package.json"),"utf8"));
 const env={PATH:dirname(process.execPath),HOME:join(root,"home"),LANG:"C.UTF-8",LC_ALL:"C.UTF-8",TZ:"UTC",
  TMPDIR:root,TEMP:root,TMP:root,ASTRO_TELEMETRY_DISABLED:"1",WRANGLER_SEND_METRICS:"false",
  XPOTATO_ARTICLE_CANDIDATE_INPUT:overlayPath,XPOTATO_ARTICLE_CANDIDATE_INPUT_SHA:sha256(overlayText)};
 try{
  const result=await run(process.execPath,[join(astroRoot,astroPackage.bin.astro),"build","--root",root],{cwd:repositoryRoot,env,timeout:300000,maxBuffer:4*1024*1024});
  await writeFile(join(root,"build.log"),result.stdout+"\n"+result.stderr,{mode:0o600});
 }catch(error){
  const result=error as {stdout?:string;stderr?:string};await writeFile(join(root,"build.log"),(result.stdout??"")+"\n"+(result.stderr??""),{mode:0o600});
  fail("CANDIDATE_ASTRO_BUILD_FAILED:"+join(root,"build.log"),4);
 }
 if(sha256(await safeRead(overlayPath))!==sha256(overlayText)||sha256(await safeRead(target))!==sha256(mdx))fail("CANDIDATE_INPUT_CHANGED_DURING_BUILD",3);
 const html=await safeRead(join(output,"articles",slug,"index.html"));
 await immutableBytes(join(output,".private-draft-preview"),Buffer.from("xpotato-private-draft-preview-v1\ncandidate;productionEligible=false\n"));
 const files=await localFileManifest(output);
 return {root,output,html,files,outputTreeSha256:fingerprint(files),buildConfigSha256:candidateAstroConfigurationSha256(repositoryRoot,input.plannedSeo.canonical),overlay};
}
