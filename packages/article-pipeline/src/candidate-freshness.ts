import {lstat} from "node:fs/promises";
import {join} from "node:path";
import {localFileManifest} from "./candidate-astro.js";
import {candidateBuildFingerprint} from "./candidate-material.js";
import {candidatePublicationDateBlockers} from "./candidate-policy.js";
import {fingerprint,sha256} from "./canonical.js";
import {fail,noLinks,safeRead} from "./private-files.js";

// This is a same-byte proof for an already fully validated server instance, never a validator.
export async function candidatePreviewSnapshot(directory:string,repositoryRoot:string,attemptId:string,folder:string){
 if(!/^attempt-[a-f0-9-]{36}$/u.test(attemptId))fail("ATTEMPT_ID_INVALID");
 const optional=async(path:string,tree=false)=>{
  await noLinks(path);
  try{const info=await lstat(path);if(tree&&!info.isDirectory())fail("CANDIDATE_PREVIEW_TREE_INVALID",3);
   return tree?await localFileManifest(path):sha256(await safeRead(path));
  }catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return null;throw error;}
 };
 const working:Record<string,unknown>={};
 for(const name of ["working.md","working-sources.json","working-evidence.json","working-audit.json","working-visual.json","working-visual-audit.json"])
  working[name]=await optional(join(directory,name));
 return fingerprint({job:sha256(await safeRead(join(directory,"job.json"))),working,
  base:await localFileManifest(join(directory,"base")),
  attempt:await localFileManifest(join(directory,"attempts",attemptId)),
  sourceMedia:await optional(join(directory,"source-media"),true),
  candidate:await localFileManifest(folder),build:await candidateBuildFingerprint(repositoryRoot)});
}
export function previewClockGuard(pubDate:string,start:number,end:number,records:unknown[]){
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<start)fail("CANDIDATE_CLOCK_INVALID",3);
 let floor=Math.max(start,end);
 const scan=(value:unknown):void=>{
  if(!value||typeof value!=="object")return;
  for(const [key,item] of Object.entries(value)){
   if(["reviewedAt","finishedAt","confirmedAt"].includes(key)&&typeof item==="string"){
    const time=Date.parse(item);if(!Number.isFinite(time)||time>end)fail("CANDIDATE_CLOCK_INVALID",3);floor=Math.max(floor,time);
   }else scan(item);
  }
 };
 for(const record of records)scan(record);
 const blockers=fingerprint(candidatePublicationDateBlockers(pubDate,new Date(end)));
 if(fingerprint(candidatePublicationDateBlockers(pubDate,new Date(start)))!==blockers)fail("CANDIDATE_PREVIEW_CLOCK_STALE",3);
 return (now=Date.now())=>{
  if(!Number.isFinite(now)||now<floor||fingerprint(candidatePublicationDateBlockers(pubDate,new Date(now)))!==blockers)
   fail("CANDIDATE_PREVIEW_CLOCK_STALE",3);
 };
}
