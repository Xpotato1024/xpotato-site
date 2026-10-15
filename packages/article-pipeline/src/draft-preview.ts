import { createServer } from "node:http";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { draftPreviewManifestSchema } from "@xpotato/content-contracts";
import { canonicalJson, sha256 } from "./canonical.js";
import { fail, immutable, locked, noLinks } from "./private-files.js";
import { assertCurrentDraft, readDraftStore, validateDraft, type DraftRepository } from "./draft-job.js";

export const privateDraftMarker="xpotato-private-draft-preview-v1";
const escape=(text:string)=>text.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const style=":root{font:18px/1.8 system-ui,sans-serif;color:#20242c;background:#f3f6fa}body{max-width:850px;margin:auto;padding:24px}header,main{background:white;border:1px solid #d8e0ea;border-radius:12px;padding:24px;margin:16px 0}h1{line-height:1.4;font-size:2rem}aside{border-left:4px solid #b77709;padding:12px;background:#fff8e9}pre{overflow:auto;background:#162131;color:#f1f5fa;padding:16px;border-radius:8px;font-size:.85rem}blockquote{margin:1rem 0;border-left:4px solid #849bb8;padding:8px 16px}table{display:block;overflow:auto;border-collapse:collapse}td,th{border:1px solid #cbd5e1;padding:6px 12px}img{display:none}code{overflow-wrap:anywhere}a{color:#2355a0}@media(max-width:600px){body{padding:10px}header,main{padding:16px}h1{font-size:1.6rem}}";
const styleHash=createHash("sha256").update(style).digest("base64");
export const draftPreviewHeaders={
  "Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow, noarchive",
  "Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff",
  "Content-Security-Policy":"default-src 'none'; style-src 'sha256-"+styleHash+"'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; connect-src 'none'; object-src 'none'; worker-src 'none'",
};
export const buildDraftPreview = async (directory:string,repo:DraftRepository) => locked(directory,async()=>{
  const store=await readDraftStore(directory), status=await assertCurrentDraft(directory,store,repo);
  const validated=await validateDraft(status.input,store,repo);
  const html='<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="'+privateDraftMarker+'" content="productionEligible=false"><title>非公開作業稿 | '+escape(validated.frontmatter.title)+'</title><style>'+style+'</style></head><body><header><p>非公開・手書きMarkdown下書きpreview</p><h1>'+escape(validated.frontmatter.title)+'</h1><p>'+escape(validated.frontmatter.description)+'</p><aside><strong>正式候補・公開承認ではありません</strong><ul>'+validated.warnings.map(text=>'<li>'+escape(text)+'</li>').join("")+'</ul></aside><p>本文hash: <code>'+status.inputSha256+'</code></p></header><main>'+validated.html+'</main></body></html>\n';
  // Recompare after asynchronous rendering before installing immutable output.
  const latest=await assertCurrentDraft(directory,store,repo);
  if(latest.inputSha256!==status.inputSha256)fail("DRAFT_CHANGED_DURING_RENDER",3);
  const manifest=draftPreviewManifestSchema.parse({schemaVersion:1,mode:"draft",jobId:store.jobId,
    attemptId:store.activeAttemptId,contentId:store.spec.target.contentId,inputSha256:status.inputSha256,
    bodySha256:sha256(validated.body),htmlSha256:sha256(html),profile:"private-markdown-draft-v1",
    displayedImageSha256s:[],warnings:validated.warnings,productionEligible:false});
  const output=join(directory,"previews",store.activeAttemptId,status.inputSha256);
  await noLinks(output); await mkdir(output,{recursive:true,mode:0o700});
  await immutable(join(output,"index.html"),html);
  await immutable(join(output,"manifest.json"),canonicalJson(manifest)+"\n");
  await immutable(join(output,".private-draft-preview"),privateDraftMarker+"\n");
  return {html,manifest,output};
});
export const serveDraftPreview = async (directory:string,repo:DraftRepository,port=0,refreshRepository?:()=>Promise<DraftRepository>) => {
  if(!Number.isInteger(port)||port<0||port>65535)fail("PORT_INVALID");
  const built=await buildDraftPreview(directory,repo);
  const server=createServer(async(req,res)=>{
    const address=server.address(), host=typeof address==="object"&&address?"127.0.0.1:"+address.port:"";
    if(req.headers.host!==host || req.headers.origin && req.headers.origin!=="http://"+host){
      res.writeHead(403,{"Cache-Control":"no-store"});res.end();return;
    }
    if(req.method!=="GET"&&req.method!=="HEAD"){res.writeHead(405,{"Allow":"GET, HEAD","Cache-Control":"no-store"});res.end();return;}
    if(req.url!=="/"){res.writeHead(404,{"Cache-Control":"no-store"});res.end();return;}
    try {
      await locked(directory,async()=>{
        const store=await readDraftStore(directory),status=await assertCurrentDraft(directory,store,refreshRepository?await refreshRepository():repo);
        if(store.activeAttemptId!==built.manifest.attemptId||status.inputSha256!==built.manifest.inputSha256)fail("PREVIEW_STALE",3);
      });
      res.writeHead(200,draftPreviewHeaders);res.end(req.method==="HEAD"?"":built.html);
    } catch {res.writeHead(410,{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store","X-Robots-Tag":"noindex"});
      res.end("作業稿が変更されたかjobが利用できません。旧previewは失効しました。guide/revise後にpreviewを作り直してください。");}
  });
  await new Promise<void>((resolve,reject)=>{server.once("error",reject);server.listen(port,"127.0.0.1",resolve);});
  const address=server.address(); if(!address||typeof address==="string")fail("PREVIEW_BIND_FAILED",4);
  return {server,url:"http://127.0.0.1:"+address.port+"/",manifest:built.manifest,output:built.output};
};
