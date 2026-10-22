import {parseArgs} from "node:util";
import {readFile,lstat} from "node:fs/promises";
import {resolve} from "node:path";
import {noToolLinks} from "../packages/site-validators/src/browser-tool-adoption.js";
import {checkBrowserToolInstallations,installBrowserTool} from "../packages/site-validators/src/browser-tool-installation.js";
const {values,positionals}=parseArgs({allowPositionals:true,options:{source:{type:"string"},artifact:{type:"string"},review:{type:"string"},release:{type:"string"},placement:{type:"string"},"replace-artifact":{type:"string"}}});
const required=(k:keyof typeof values)=>{if(!values[k])throw Error("--"+k+" required");return values[k]!;};
async function load(path:string){await noToolLinks(path);const info=await lstat(path);if(!info.isFile()||info.size>100000)throw Error("Bounded JSON file required");return JSON.parse(await readFile(path,"utf8"));}
try{
 if(positionals.length!==1)throw Error("One command required: plan | apply | check");
 const siteRoot=process.cwd(),pkg=JSON.parse(await readFile(resolve(siteRoot,"package.json"),"utf8"));
 if(pkg.name!=="xpotato-site-vnext")throw Error("Run at the site workspace root");
 if(positionals[0]==="check"){await checkBrowserToolInstallations(siteRoot);console.log("Generated installation records are current.");}
 else if(["plan","apply"].includes(positionals[0]!))console.log(JSON.stringify(await installBrowserTool({
  siteRoot,sourceRoot:resolve(required("source")),artifactRoot:resolve(required("artifact")),review:await load(resolve(required("review"))),
  releaseId:required("release"),placement:await load(resolve(required("placement"))),apply:positionals[0]==="apply",replaceArtifact:values["replace-artifact"]}),null,2));
 else throw Error("Unknown command");
}catch(e){console.error(e instanceof Error?e.message:"Installation failed");process.exitCode=1;}
