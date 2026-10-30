import {parseArgs} from "node:util";
import {readFile,lstat} from "node:fs/promises";
import {resolve} from "node:path";
import {noToolLinks} from "../packages/site-validators/src/browser-tool-adoption.js";
import {checkBrowserToolInstallations,installBrowserTool,migrateManualPrime,updatePublishedPrimeRelease} from "../packages/site-validators/src/browser-tool-installation.js";
const {values,positionals}=parseArgs({allowPositionals:true,options:{source:{type:"string"},artifact:{type:"string"},review:{type:"string"},release:{type:"string"},placement:{type:"string"},"replace-artifact":{type:"string"},"migrate-manual-prime":{type:"boolean"},"update-published-prime":{type:"boolean"},"from-head":{type:"string"}}});
const required=(k:Exclude<keyof typeof values,"migrate-manual-prime"|"update-published-prime">)=>{if(!values[k])throw Error("--"+k+" required");return values[k]!;};
async function load(path:string){await noToolLinks(path);const info=await lstat(path);if(!info.isFile()||info.size>100000)throw Error("Bounded JSON file required");return JSON.parse(await readFile(path,"utf8"));}
try{
 if(positionals.length!==1)throw Error("One command required: plan | apply | check | rollback-manual-prime");
 const siteRoot=process.cwd(),pkg=JSON.parse(await readFile(resolve(siteRoot,"package.json"),"utf8"));
 if(pkg.name!=="xpotato-site-vnext")throw Error("Run at the site workspace root");
 if(values["update-published-prime"]){
  if(!['plan','apply'].includes(positionals[0]!)||values.placement||values['migrate-manual-prime']||values['from-head'])throw Error('Published Prime update requires plan/apply and preserves its exact placement');
  console.log(JSON.stringify(await updatePublishedPrimeRelease({siteRoot,sourceRoot:resolve(required('source')),artifactRoot:resolve(required('artifact')),review:await load(resolve(required('review'))),
   releaseId:required('release'),replaceArtifact:required('replace-artifact'),apply:positionals[0]==='apply'}),null,2));
 }
 else if(values["migrate-manual-prime"]||positionals[0]==="rollback-manual-prime"){
  if(!["plan","apply","rollback-manual-prime"].includes(positionals[0]!))throw Error("Migration requires plan, apply or rollback-manual-prime");
  if(values.source||values.artifact||values.review||values.release||values.placement||values["replace-artifact"])throw Error("Manual transfer reuses the exact adopted release; adoption arguments are forbidden");
  console.log(JSON.stringify(await migrateManualPrime({siteRoot,fromHead:required("from-head"),apply:positionals[0]==="apply",rollback:positionals[0]==="rollback-manual-prime"}),null,2));
 }
 else if(values["from-head"])throw Error("--from-head requires explicit manual migration");
 else if(positionals[0]==="check"){await checkBrowserToolInstallations(siteRoot);console.log("Generated installation records are current.");}
 else if(["plan","apply"].includes(positionals[0]!))console.log(JSON.stringify(await installBrowserTool({
  siteRoot,sourceRoot:resolve(required("source")),artifactRoot:resolve(required("artifact")),review:await load(resolve(required("review"))),
  releaseId:required("release"),placement:await load(resolve(required("placement"))),apply:positionals[0]==="apply",replaceArtifact:values["replace-artifact"]}),null,2));
 else throw Error("Unknown command");
}catch(e){console.error(e instanceof Error?e.message:"Installation failed");process.exitCode=1;}
