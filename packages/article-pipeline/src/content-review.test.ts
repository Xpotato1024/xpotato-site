import {spawn} from "node:child_process";
import {connect} from "node:net";
import {articleCli} from "./cli.js";
import {watch,writeFileSync} from "node:fs";
import {privateDraftOutputErrors} from "@xpotato/portable-content/private-output";
import {afterEach,describe,it,expect} from "vitest";
import {mkdtemp,readFile,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {initDraft,reviseDraft,readDraftStore,guideDraft,type DraftRepository} from "./draft-job.js";
import {importReviewSources,importReviewEvidence,prepareContentAudit,importContentAudit,buildContentReviewBundle,serveContentReviewBundle} from "./content-review.js";
import {fixtureReviewBody,fixtureReviewInputs,fixtureContentAudit} from "./content-review-fixture.js";
import {validateLocalSources,analyzeLocalEvidence,makeContentAuditRequest,validateContentAudit} from "./review-analysis.js";
import {readReviewJournal} from "./review-journal.js";
import {fingerprint,sha256} from "./canonical.js";
import {compileArticleCitations,inspectExamples} from "@xpotato/portable-content/review";
import {renderDraftMarkdown} from "@xpotato/portable-content/draft";
import {buildDraftPreview} from "./draft-preview.js";
const roots:string[]=[];afterEach(async()=>{await Promise.all(roots.splice(0).map(path=>rm(path,{recursive:true,force:true})));});
const repo:DraftRepository={commit:"a".repeat(40),fingerprint:"b".repeat(64),categories:[{id:"software",label:"ソフトウェア",status:"active"}],
 tags:[],records:[],occupiedRoutes:[],registrySnapshot:{media:"empty"}};
async function setup(body=fixtureReviewBody){
 const root=await mkdtemp(join(tmpdir(),"article-content-review-"));roots.push(root);
 const job=await initDraft(root,repo,{title:"合成記事",description:"試験専用",slug:"synthetic-review",category:"software",
  pubDate:"2026-10-15",readerOutcome:"合成試験を理解する",intent:"review",network:false});
 await reviseDraft(job.directory,repo,"fixture import",body);
 const inputs=fixtureReviewInputs(body);return {...inputs,root,job,directory:job.directory};
}
async function contentReady(){
 const f=await setup();await importReviewSources(f.directory,repo,f.sources);await importReviewEvidence(f.directory,repo,f.evidence);
 const prepared=await prepareContentAudit(f.directory,repo);await importContentAudit(f.directory,repo,fixtureContentAudit(prepared.request.requestSha256));return f;
}
describe("local Article Job content review",()=>{
 it("denies protected JSON import paths before opening files",async()=>{
  const f=await setup();
  for(const area of ["sources","evidence","audit","examples"]){
   for(const from of ["/tmp/.env.json","/tmp/.git/input.json","/tmp/../input.json","C:\\tmp\\.aws\\input.json","/tmp/credentials.json"]){
    const output:unknown[]=[];
    expect(await articleCli(["article",area,area==="examples"?"prepare":"import","--job",f.job.jobId,"--from",from,"--root",f.root],process.cwd(),async()=>repo,value=>output.push(value))).toBe(2);
    expect(output.at(-1)).toMatchObject({error:{code:"IMPORT_PATH_DENIED"}});
   }
  }
 });
 it("replays legal stages to CONTENT_READY, resumes and emits a nonapproval bundle with all A4 blockers",async()=>{
  const f=await contentReady(),store=await readDraftStore(f.directory),guide=await guideDraft(f.directory,repo);
  expect(guide.currentState).toBe("CONTENT_READY");expect(guide.productionEligible).toBe(false);
  const journal=await readReviewJournal(f.directory,{jobId:store.jobId,attemptId:store.activeAttemptId,jobFingerprint:store.jobFingerprint,
   inputSha256:sha256(await readFile(join(f.directory,"working.md"),"utf8"))});
  expect(journal.state).toBe("CONTENT_READY");expect(journal.head.receipts).toHaveLength(6);
  expect((await importReviewSources(f.directory,repo,f.sources)).reused).toBe(true);
  const bundle=await buildContentReviewBundle(f.directory,repo);
  expect(bundle.approvalEligible).toBe(false);expect(bundle.candidateSha256).toBeNull();
  for(const code of ["hero-master-missing","social-card-missing","public-origin-unconfirmed","object-key-profile-unconfirmed","storage-plan-unconfirmed","candidate-preview-unimplemented"])
   expect(bundle.blockers.some(blocker=>blocker.code===code)).toBe(true);
  expect(bundle.html).toContain("HUMAN_REVIEW_READY未成立");expect(bundle.html).toContain("cite-1");
  const repeat=await buildContentReviewBundle(f.directory,repo);expect(repeat.output).toBe(bundle.output);
 });
 it("invalidates evidence edits, preserves history, and rebuilds a new attempt without old audit authority",async()=>{
  const f=await contentReady(),old=await readDraftStore(f.directory),oldHead=await readFile(join(f.directory,"attempts",old.activeAttemptId,"review/head.json"),"utf8");
  await writeFile(join(f.directory,"working-evidence.json"),JSON.stringify({...f.evidence,claims:[]}));
  const guide=await guideDraft(f.directory,repo);expect(guide.currentState).toBeNull();expect(guide.historicalState).toBe("CONTENT_READY");expect(guide.stale).toBe(true);
  await expect(buildContentReviewBundle(f.directory,repo)).rejects.toThrow("STALE");
  expect((await buildDraftPreview(f.directory,repo)).manifest.mode).toBe("draft");
  await reviseDraft(f.directory,repo,"new evidence attempt");
  expect((await guideDraft(f.directory,repo)).currentState).toBe("CREATED");
  await importReviewSources(f.directory,repo,f.sources);await importReviewEvidence(f.directory,repo,f.evidence);
  const request=await prepareContentAudit(f.directory,repo);
  const oldAudit=JSON.parse(await readFile(join(f.directory,"working-audit.json"),"utf8"));
  await expect(importContentAudit(f.directory,repo,oldAudit)).rejects.toThrow("STALE");
  await importContentAudit(f.directory,repo,fixtureContentAudit(request.request.requestSha256));
  expect((await guideDraft(f.directory,repo)).currentState).toBe("CONTENT_READY");
  expect(await readFile(join(f.directory,"attempts",old.activeAttemptId,"review/head.json"),"utf8")).toBe(oldHead);
 });
 it("invalidates working body/title edits",async()=>{
  const f=await contentReady();await writeFile(join(f.directory,"working.md"),(await readFile(join(f.directory,"working.md"),"utf8"))+"\n変更\n");
  expect((await guideDraft(f.directory,repo)).currentState).toBeNull();await expect(buildContentReviewBundle(f.directory,repo)).rejects.toThrow("STALE");
 });
 it.each(["sources","audit"] as const)("invalidates %s edits without changing working Markdown",async(role)=>{
  const f=await contentReady(),path=join(f.directory,"working-"+role+".json"),data=JSON.parse(await readFile(path,"utf8"));
  if(role==="sources")data.sources[0].snapshot+="変更";else data.independence.basis+="変更";
  await writeFile(path,JSON.stringify(data));expect((await guideDraft(f.directory,repo)).currentState).toBeNull();
  await expect(buildContentReviewBundle(f.directory,repo)).rejects.toThrow("STALE");
 });
 it("serves only loopback HTML, refuses JSON/POST, and expires an active review on source edit",async()=>{
  const f=await contentReady(),served=await serveContentReviewBundle(f.directory,repo);
  try{
   const response=await fetch(served.url);expect(response.status).toBe(200);
   expect(response.headers.get("content-security-policy")).toContain("connect-src 'none'");
   expect(response.headers.get("cache-control")).toBe("no-store");expect((await response.text())).toContain("HUMAN_REVIEW_READY未成立");
   expect((await fetch(served.url+"review.json")).status).toBe(404);
   expect((await fetch(served.url,{method:"POST"})).status).toBe(405);
   expect((await fetch(served.url,{headers:{Origin:"https://outside.invalid"}})).status).toBe(403);
   await writeFile(join(f.directory,"working-sources.json"),JSON.stringify({...f.sources,authorPrincipalId:"changed-author"}));
   expect((await fetch(served.url)).status).toBe(410);
  }finally{await new Promise<void>(resolve=>served.server.close(()=>resolve()));}
 });
 it.each(["draft","review"] as const)("stops the %s CLI even with a raw speculative TCP connection",async(mode)=>{
  const f=await contentReady(),commands=mode==="draft"?["preview","--draft"]:["review","preview"];
  const args=["article",...commands,"--job",f.job.jobId,"--root",f.root,"--json"];
  const source="import {articleCli} from "+JSON.stringify(new URL("./cli.ts",import.meta.url).href)+"; process.exitCode=await articleCli("+JSON.stringify(args)+",process.cwd(),async()=>("+JSON.stringify(repo)+"));";
  const child=spawn(process.execPath,["--import","tsx","--input-type=module","--eval",source],{cwd:process.cwd(),stdio:["ignore","pipe","pipe"]});
  const exited=new Promise<{code:number|null;signal:NodeJS.Signals|null}>((resolve,reject)=>{
   child.once("error",reject);child.once("exit",(code,signal)=>resolve({code,signal}));
  });
  let socket:ReturnType<typeof connect>|undefined;
  try{
   const url=await new Promise<string>((resolve,reject)=>{
    let text="";const timer=setTimeout(()=>reject(Error("CLI startup timeout")),8000);
    const earlyExit=()=>{clearTimeout(timer);reject(Error("CLI exited before preview startup"));};child.once("exit",earlyExit);
    child.stdout.on("data",bytes=>{text+=bytes.toString();for(const line of text.split("\n"))try{
     const value=JSON.parse(line);if(value.url){clearTimeout(timer);child.off("exit",earlyExit);resolve(value.url);}if(value.error){clearTimeout(timer);reject(Error("CLI startup rejected"));}
    }catch{}});
    child.stderr.resume();
   });
   expect((await fetch(url)).status).toBe(200);
   const address=new URL(url);socket=connect({host:address.hostname,port:Number(address.port)});
   socket.on("error",()=>{});await new Promise<void>(resolve=>socket!.once("connect",resolve));
   child.kill("SIGTERM");
   let timer:ReturnType<typeof setTimeout>|undefined;
   try{
    const outcome=await Promise.race([exited,new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>reject(Error("CLI did not stop with an open TCP socket")),3000);})]);
    expect(outcome).toEqual({code:0,signal:null});
   }finally{if(timer)clearTimeout(timer);}
  }finally{
   socket?.destroy();if(child.exitCode===null&&child.signalCode===null)child.kill("SIGKILL");await exited;
  }
 },15000);
 it("preserves an external metadata editor write while first import is preparing",async()=>{
  const f=await setup(),store=await readDraftStore(f.directory),target=join(f.directory,"working-sources.json");
  const external=JSON.stringify({...f.sources,authorPrincipalId:"editor-writer"});let edited=false;
  const watcher=watch(join(f.directory,"attempts",store.activeAttemptId),(_event,name)=>{
   if(!edited&&String(name)==="review"){edited=true;writeFileSync(target,external);}
  });
  try{
   await expect(importReviewSources(f.directory,repo,f.sources)).rejects.toThrow("WORKING_INPUT_CHANGED");
   expect(edited).toBe(true);expect(await readFile(target,"utf8")).toBe(external);
   expect((await guideDraft(f.directory,repo)).currentState).toBe("CREATED");
  }finally{watcher.close();}
 });
 it.each(["empty","revision","analysis","request","result"] as const)("rejects self-consistent persisted %s corruption before adopting review state",async(mode)=>{
  const f=await contentReady(),store=await readDraftStore(f.directory),folder=join(f.directory,"attempts",store.activeAttemptId,"review");
  const head=JSON.parse(await readFile(join(folder,"head.json"),"utf8"));
  const receipts=await Promise.all(head.receipts.map(async(hash:string)=>JSON.parse(await readFile(join(folder,"receipts",hash+".json"),"utf8"))));
  if(mode==="empty"){head.bindings={};head.outputs={};}
  if(mode==="revision"){
   const audit=JSON.parse(await readFile(join(folder,"artifacts",head.bindings.audit+".json"),"utf8"));
   audit.conclusion="revision_required";audit.findings=[{severity:"P1",message:"must revise",claimIds:["c0001"]}];
   const hash=fingerprint(audit);await writeFile(join(folder,"artifacts",hash+".json"),JSON.stringify(audit));
   await writeFile(join(f.directory,"working-audit.json"),JSON.stringify(audit));head.bindings.audit=hash;
  }
  if(mode==="analysis"||mode==="request"){
   const key=mode==="analysis"?"analysis":"auditRequest";
   const value=JSON.parse(await readFile(join(folder,"artifacts",head.outputs[key]+".json"),"utf8"));
   value.bodySha256="0".repeat(64);const hash=fingerprint(value);
   await writeFile(join(folder,"artifacts",hash+".json"),JSON.stringify(value));head.outputs[key]=hash;
  }
  let previous:string|null=null;head.receipts=[];
  for(const receipt of receipts){
   const {receiptSha256:ignored,...unsigned}=receipt;
   unsigned.previousReceiptSha256=previous;
   if(mode==="empty"){unsigned.inputs={};unsigned.outputs={};}
   if(mode==="revision"&&"audit" in unsigned.inputs)unsigned.inputs.audit=head.bindings.audit;
   for(const key of Object.keys(unsigned.outputs))unsigned.outputs[key]=head.outputs[key];
   if(mode==="result"&&unsigned.stage==="evidence")unsigned.result="blocked_env";
   const hash=fingerprint(unsigned);await writeFile(join(folder,"receipts",hash+".json"),JSON.stringify({...unsigned,receiptSha256:hash}));
   head.receipts.push(hash);previous=hash;
  }
  await writeFile(join(folder,"head.json"),JSON.stringify(head));
  expect((await guideDraft(f.directory,repo)).currentState).toBeNull();
  await expect(buildContentReviewBundle(f.directory,repo)).rejects.toThrow(/REVIEW_/u);
 });
 it("rejects tampered receipt state and output artifacts",async()=>{
  const f=await contentReady(),store=await readDraftStore(f.directory),folder=join(f.directory,"attempts",store.activeAttemptId,"review");
  const head=JSON.parse(await readFile(join(folder,"head.json"),"utf8")),last=head.receipts.at(-1);
  const path=join(folder,"receipts",last+".json"),receipt=JSON.parse(await readFile(path,"utf8"));
  await writeFile(path,JSON.stringify({...receipt,to:"HUMAN_REVIEW_READY"}));
  expect((await guideDraft(f.directory,repo)).currentState).toBeNull();
  await expect(buildContentReviewBundle(f.directory,repo)).rejects.toThrow("RECEIPT");
 });
 it("blocks private source/evidence/audit/journal shapes in production output",async()=>{
  const f=await contentReady();
  for(const name of ["sources","evidence","audit"]){
   const text=await readFile(join(f.directory,"working-"+name+".json"),"utf8");
   expect(privateDraftOutputErrors("public.json",text)).not.toHaveLength(0);
  }
  const bundle=await buildContentReviewBundle(f.directory,repo);
  expect(privateDraftOutputErrors("preview.html",bundle.html)).not.toHaveLength(0);
  expect(privateDraftOutputErrors("manifest.json",JSON.stringify(bundle))).not.toHaveLength(0);
 });
 it("keeps P1/revision outcomes and requires a new attempt",async()=>{
  const f=await setup();await importReviewSources(f.directory,repo,f.sources);await importReviewEvidence(f.directory,repo,f.evidence);
  const request=await prepareContentAudit(f.directory,repo),audit=fixtureContentAudit(request.request.requestSha256);
  audit.conclusion="revision_required";audit.findings=[{severity:"P1",message:"合成修正要求",claimIds:["c0001"]}];
  expect((await importContentAudit(f.directory,repo,audit)).state).toBe("REVISION_REQUIRED");
  await expect(importContentAudit(f.directory,repo,{...audit,conclusion:"pass",findings:[]})).rejects.toThrow("REVISE_REQUIRED");
  await reviseDraft(f.directory,repo,"human requested correction");expect((await guideDraft(f.directory,repo)).currentState).toBe("CREATED");
 });
 it("never executes examples or promotes classification to execution evidence",async()=>{
  const fence=String.fromCharCode(96).repeat(3),body=fixtureReviewBody+"\n"+fence+"javascript\nthrow Error('must never run');\n"+fence+"\n";
  const f=await setup(body),example=inspectExamples(body)[0]!;
  f.evidence.examples=[{exampleId:example.exampleId,intendedPurpose:"合成の説明用",requestedVerification:"illustrative",verificationRequired:false,materialClaimIds:[]}];
  await importReviewSources(f.directory,repo,f.sources);
  const imported=await importReviewEvidence(f.directory,repo,f.evidence);expect(imported.state).toBe("EXAMPLES_ASSESSED");
  expect(imported.examples?.[0]).toMatchObject({label:"未実行",status:"not_run"});
  await reviseDraft(f.directory,repo,"require actual execution");await importReviewSources(f.directory,repo,f.sources);
  f.evidence.examples[0]!.requestedVerification="sandbox_executed";f.evidence.examples[0]!.verificationRequired=true;
  f.evidence.examples[0]!.materialClaimIds=["c0001"];
  const blocked=await importReviewEvidence(f.directory,repo,f.evidence);expect(blocked.state).toBe("DRAFTED");expect(blocked.examplesReady).toBe(false);
  await expect(prepareContentAudit(f.directory,repo)).rejects.toThrow("PREREQUISITES");
 });
});
describe("evidence and audit contract failures",()=>{
 it.each(["snapshot","disclosure","citation","metadata"] as const)("rejects source %s inconsistencies",kind=>{
  const {sources}=fixtureReviewInputs();const first=sources.sources[0]!;
  if(kind==="snapshot")first.snapshot+="変更";if(kind==="disclosure")first.record.externalAiDisclosureRef="0".repeat(64);
  if(kind==="citation")first.record.citation.canonicalUrl="https://invented.invalid/";
  if(kind==="metadata")first.record.citation.title="別の資料名";
  expect(()=>validateLocalSources(sources)).toThrow();
 });
 it.each(["unknown-source","hash","span","extract","interpretation","coverage"] as const)("rejects %s bindings",kind=>{
  const {sources,evidence}=fixtureReviewInputs();
  if(kind==="unknown-source")evidence.evidence[0]!.sourceRefs[0]!.sourceId="unknown";
  if(kind==="hash")evidence.evidence[0]!.sourceRefs[0]!.sourceRecordSha256="0".repeat(64);
  if(kind==="span")evidence.claims[0]!.draftSpan.start++;
  if(kind==="extract")evidence.extracts[0]!.textSha256="0".repeat(64);
  if(kind==="interpretation")evidence.evidence[0]!.interpretation="reasonable_inference";
  if(kind==="coverage")evidence.claims[0]!.evidenceIds=[];
  expect(()=>analyzeLocalEvidence(fixtureReviewBody,sources,evidence)).toThrow();
 });
 it("rejects self audit, stale target, missing claim coverage and pass with P0/P1",()=>{
  const {sources,evidence}=fixtureReviewInputs(),analysis=analyzeLocalEvidence(fixtureReviewBody,sources,evidence);
  const request=makeContentAuditRequest({jobId:"job-fixture",attemptId:"attempt-fixture",jobFingerprint:"a".repeat(64),inputSha256:"b".repeat(64)},analysis);
  const audit=fixtureContentAudit(request.requestSha256);
  expect(()=>validateContentAudit({...audit,reviewer:{kind:"human",principalId:"fixture-writer"}},request)).toThrow("INDEPENDENT");
  expect(()=>validateContentAudit({...audit,requestSha256:"0".repeat(64)},request)).toThrow("STALE");
  expect(()=>validateContentAudit({...audit,coveredClaimIds:[]},request)).toThrow("COVERAGE");
  expect(()=>validateContentAudit({...audit,findings:[{severity:"P0",message:"block",claimIds:[]}]},request)).toThrow("BLOCKING");
 });
});
describe("AST citation compiler",()=>{
 it("renders public HTTPS citations as portable MDX, including parentheses and query strings",async()=>{
  const {sources}=fixtureReviewInputs(),record=sources.sources[0]!.record;
  record.citation.canonicalUrl='https://example.invalid/source_(v1)?a=1&b=2#part';
  const compiled=compileArticleCitations('Claim [@S0001].\n',[record]).compiled;
  expect(compiled).not.toContain('<https:');expect(compiled).toContain('source_\\(v1\\)?a=1&b=2#part');
  const rendered=await renderDraftMarkdown(compiled);
  const href=/href="(https:[^"]+)"/u.exec(rendered.html)?.[1]?.replaceAll('&#x26;','&').replaceAll('&amp;','&');
  expect(href).toBe(record.citation.canonicalUrl);
  expect(rendered.html).toContain('cite-1');
 });
 it("uses first-use footnotes, deduplicates sources and preserves code/literals",()=>{
  const {sources}=fixtureReviewInputs(),records=sources.sources.map(entry=>entry.record),tick=String.fromCharCode(96);
  const body="根拠 [@S0001] と再引用 [@s0001]。\n\n"+tick+"[@S0001]"+tick+"\n\n"+tick.repeat(3)+"text\n[@S0001]\n"+tick.repeat(3)+"\n\n\\[@S0001]\n";
  const result=compileArticleCitations(body,records);
  expect(result.manifest.bindings).toHaveLength(1);expect(result.compiled.match(/\[\^cite-1\]/gu)).toHaveLength(3);
  expect(result.compiled).toContain(tick+"[@S0001]"+tick);expect(result.compiled).toContain("\\[@S0001]");
 });
 it.each(["未知 [@missing]","欠落 [^missing]","[^unused]: 孤立","壊れた [@S0001","[リンク内 [@S0001]](https://example.invalid/)"])("rejects invalid citations/footnotes: %s",body=>{
  const {sources}=fixtureReviewInputs();expect(()=>compileArticleCitations(body,sources.sources.map(entry=>entry.record))).toThrow();
 });
 it.each([
  "[@S0001](https://invented.invalid/)",
  "[@S0001][x]\n\n[x]: https://invented.invalid/",
  "[@missing]\n\n[@missing]: https://invented.invalid/",
  "![@S0001](https://invented.invalid/a.png)",
  "[@S0001][]\n\n[@S0001]: https://invented.invalid/",
 ])("rejects logical markers absorbed into Markdown links or definitions: %s",body=>{
  const {sources}=fixtureReviewInputs();
  expect(()=>compileArticleCitations(body,sources.sources.map(entry=>entry.record))).toThrow("CITATION_LOCATION");
 });
 it("escapes citation title, publisher and artifact description as MDX-safe text",async()=>{
  const {sources}=fixtureReviewInputs(),record=sources.sources[0]!.record;
  record.citation.title="Using {JSON} objects";record.citation.publisher="Publisher {literal}";
  if(record.locator.kind!=="artifact")throw Error("fixture source kind");record.locator.publicDescription="Description {literal}";
  const compiled=compileArticleCitations("Claim [@S0001].\n",[record]).compiled;
  const rendered=await renderDraftMarkdown(compiled);
  expect(rendered.html).toContain("Using {JSON} objects");expect(rendered.html).toContain("Publisher {literal}");
  expect(rendered.html).toContain("Description {literal}");
 });
 it("rejects private citations while preserving private source identity in a safe compact ref",()=>{
  const {sources,evidence}=fixtureReviewInputs(),entry=sources.sources[0]!;
  entry.record.publicSafe=false;entry.record.citation={eligible:false};entry.record.title="private title must not escape";
  const body=fixtureReviewBody.replace(" [@S0001]","");evidence.bodySha256=sha256(body);evidence.sourceBundleSha256=fingerprint(sources);
  evidence.evidence[0]!.sourceRefs[0]!.sourceRecordSha256=fingerprint(entry.record);
  expect(()=>compileArticleCitations(fixtureReviewBody,[entry.record])).toThrow("NOT_PUBLIC");
  const analysis=analyzeLocalEvidence(body,sources,evidence);
  expect(JSON.stringify(analysis.sourceRefs)).not.toContain("private title");expect(analysis.sourceRefs[0]!.kind).toBe("user_supplied");
 });
});
