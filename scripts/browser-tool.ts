import {readFile,lstat} from "node:fs/promises";
import {resolve} from "node:path";
import {parseArgs} from "node:util";
import {browserToolReviewSchema,browserToolPinSchema} from "@xpotato/content-contracts";
import {adoptToolRelease,noToolLinks,verifyToolCandidate,selectToolRelease} from "../packages/site-validators/src/browser-tool-adoption.js";
const {values,positionals}=parseArgs({allowPositionals:true,options:{
 source:{type:"string"},artifact:{type:"string"},review:{type:"string"},vendor:{type:"string"},
 release:{type:"string"},pins:{type:"string"},tool:{type:"string"} }});
const required=(key:keyof typeof values)=>{const value=values[key];if(!value)throw Error("--"+key+" required");return value;};
async function load(path:string):Promise<unknown>{await noToolLinks(path);const info=await lstat(path);if(!info.isFile()||info.size>1_000_000)throw Error("Invalid metadata file");return JSON.parse(await readFile(path,"utf8"));}
try{
 let result:unknown;
 if(positionals.length!==1)throw Error("One command required: verify | adopt | select");
 if(positionals[0]==="select"){
  const input=await load(resolve(required("pins")));
  if(!Array.isArray(input))throw Error("Pins must be an array");
  result=await selectToolRelease(resolve(required("vendor")),input.map(pin=>browserToolPinSchema.parse(pin)),required("tool"),required("release"));
 }else if(positionals[0]==="verify"||positionals[0]==="adopt"){
  const review=browserToolReviewSchema.parse(await load(resolve(required("review"))));
  if(review.source.kind!=="github")throw Error("Public adoption CLI requires reviewed GitHub source; fixture harness is separate");
  const input={sourceRoot:resolve(required("source")),artifactRoot:resolve(required("artifact")),review};
  if(positionals[0]==="verify")result=(await verifyToolCandidate(input)).pinFields;
  else result=await adoptToolRelease({...input,vendorRoot:resolve(required("vendor")),releaseId:required("release")});
 }else throw Error("Unknown command");
 console.log(JSON.stringify(result,null,2));
}catch(error){console.error(error instanceof Error?error.message:"Tool adoption failed");process.exitCode=1;}
