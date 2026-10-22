import {parseArgs} from "node:util";
import {createBrowserToolSource,checkBrowserToolArtifact} from "../packages/site-validators/src/browser-tool-authoring.js";
const {values,positionals}=parseArgs({allowPositionals:true,options:{directory:{type:"string"},id:{type:"string"},title:{type:"string"},
 license:{type:"string"},"license-file":{type:"string"},"notice-file":{type:"string"},artifact:{type:"string"}}});
const required=(key:keyof typeof values)=>{const value=values[key];if(!value)throw Error("--"+key+" required");return value;};
try{
 if(positionals.length!==1)throw Error("One command required: create | check");
 if(positionals[0]==="create"){
  await createBrowserToolSource({directory:required("directory"),toolId:required("id"),title:required("title"),license:required("license"),licenseFile:required("license-file"),noticeFile:required("notice-file")});
  console.log("Created source only. Review supplied license/notice, generate and review lock, then test/build/check. No Git/network/publication operation was performed.");
 }else if(positionals[0]==="check")console.log(JSON.stringify(await checkBrowserToolArtifact(required("artifact")),null,2));
 else throw Error("Unknown command");
}catch(error){console.error(error instanceof Error?error.message:"Authoring failed");process.exitCode=1;}
