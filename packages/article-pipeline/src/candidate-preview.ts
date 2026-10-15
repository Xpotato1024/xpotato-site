import {createServer} from "node:http";
import {join} from "node:path";
import {visualContext} from "./visual-review.js";
import {inspectCandidateArtifactAndMaterials} from "./candidate-integrity.js";
import {candidateDirectory} from "./candidate-review.js";
import {candidatePreviewHeaders} from "./candidate-static.js";
import {safeRead,safeReadBytes,fail,locked} from "./private-files.js";
import {sha256,fingerprint} from "./canonical.js";
import type {DraftRepository} from "./draft-job.js";

export async function validateArticleCandidate(directory:string,repo:DraftRepository,repositoryRoot:string,target:string){
 const v=await visualContext(directory,repo,repositoryRoot,false);
 if(!v.plan||!v.masters||!v.audit||!v.media||v.head.rejection)fail("CANDIDATE_MEDIA_PREREQUISITES_MISSING",3);
 const snapshot={directory,repositoryRoot,c:v.c,plan:v.plan,masters:v.masters,audit:v.audit,media:v.media};
 const checked=await inspectCandidateArtifactAndMaterials(snapshot,target);
 return {v,snapshot,...checked};
}
export async function serveArticleCandidate(directory:string,repo:DraftRepository,repositoryRoot:string,target:string,port=0,refreshRepository?:()=>Promise<DraftRepository>){
 if(!Number.isInteger(port)||port<0||port>65535)fail("PORT_INVALID");
 const initial=await validateArticleCandidate(directory,repo,repositoryRoot,target);
 const folder=candidateDirectory(directory,target),article=initial.materials.route;
 const reviewHtml=await safeRead(join(folder,"index.html")),articleHtml=await safeRead(join(folder,"output",article.slice(1),"index.html"));
 const headers=candidatePreviewHeaders([reviewHtml,articleHtml]);
 const files=new Map<string,{path:string;sha256:string;mime:string}>([
  ["/",{path:"index.html",sha256:sha256(reviewHtml),mime:"text/html; charset=utf-8"}],
  [article,{path:"output"+article+"index.html",sha256:sha256(articleHtml),mime:"text/html; charset=utf-8"}],
 ]);
 const types:Record<string,string>={css:"text/css; charset=utf-8",js:"text/javascript; charset=utf-8",woff2:"font/woff2",svg:"image/svg+xml",png:"image/png",jpg:"image/jpeg",webp:"image/webp",avif:"image/avif",ico:"image/x-icon"};
 for(const file of initial.artifact.files.filter(item=>item.path.startsWith("output/"))){
  const path=file.path.slice(7),extension=path.split(".").at(-1)!;
  const allowed=/^__candidate_media\/[a-f0-9]{64}\.(?:jpg|png|webp|avif)$/u.test(path)
   ||/^_astro\/[a-zA-Z0-9_.-]+\.(?:css|js|woff2|svg)$/u.test(path)
   ||/^fonts\/[a-zA-Z0-9_./-]+\.woff2$/u.test(path)
   ||["xpotato-logo.svg","favicon.svg","favicon.ico","scripts/mobile-menu.js","scripts/code-copy.js"].includes(path);
  if(allowed&&types[extension])files.set("/"+path,{path:file.path,sha256:file.sha256,mime:types[extension]!});
 }
 // Coalesce concurrent browser asset requests; never retain a successful verdict across request batches.
 let pending:Promise<void>|undefined;
 const fresh=()=>{
  if(!pending){pending=(async()=>{
   const current=await validateArticleCandidate(directory,refreshRepository?await refreshRepository():repo,repositoryRoot,target);
   if(current.artifact.artifactSha256!==initial.artifact.artifactSha256||fingerprint(current.v.head)!==fingerprint(initial.v.head))fail("CANDIDATE_PREVIEW_STALE",3);
  })().finally(()=>{pending=undefined;});}
  return pending;
 };
 const server=createServer(async(req,res)=>{
  const address=server.address(),host=typeof address==="object"&&address?"127.0.0.1:"+address.port:"";
  if(req.headers.host!==host||req.headers.origin&&req.headers.origin!=="http://"+host){res.writeHead(403,headers);res.end();return;}
  if(req.method!=="GET"&&req.method!=="HEAD"){res.writeHead(405,{...headers,Allow:"GET, HEAD"});res.end();return;}
  const file=files.get(req.url??"");
  if(!file){res.writeHead(404,headers);res.end();return;}
  try{
   await fresh();const bytes=await safeReadBytes(join(folder,file.path));
   if(sha256(bytes)!==file.sha256)fail("CANDIDATE_PREVIEW_FILE_CHANGED",3);
   res.writeHead(200,{...headers,"Content-Type":file.mime});res.end(req.method==="HEAD"?undefined:bytes);
  }catch{
   res.writeHead(410,{...headers,"Content-Type":"text/plain; charset=utf-8"});
   res.end("入力・監査・画像・候補・build設定が変わったため旧previewは失効しました。guide/reviseから再検証してください。");
  }
 });
 await new Promise<void>((resolve,reject)=>{server.once("error",reject);server.listen(port,"127.0.0.1",resolve);});
 const address=server.address();if(!address||typeof address==="string")fail("PREVIEW_BIND_FAILED",4);
 return {server,url:"http://127.0.0.1:"+address.port+"/",articleUrl:"http://127.0.0.1:"+address.port+article,output:folder,
  manifest:{targetSha256:target,candidateSha256:initial.artifact.candidateSha256,approvalEligible:initial.artifact.approvalEligible,
   reference:initial.artifact.reference,productionEligible:false,isApproval:false}};
}
