import {readReviewJournal} from "./review-journal.js";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { stringify, parseDocument } from "yaml";
import {
  articleRoute, articleUrlId, articleJobSpecSchema, articleJobStateSchema, blogFrontmatterSchema, contentIdSchema,
  humanDraftArtifactSchema, sha256Schema, stableIdSchema, type BlogFrontmatter,
} from "@xpotato/content-contracts";
import { renderDraftMarkdown } from "@xpotato/portable-content/draft";
import { normalizeArticleJobSpec } from "./job.js";
import { currentExternalAiPolicyBinding, containsHardDenyMaterial } from "./disclosure.js";
import { canonicalJson, fingerprint, sha256 } from "./canonical.js";
import { fail, immutable, atomic, locked, noLinks, safeRead } from "./private-files.js";

export interface DraftRepository {
  readonly commit: string;
  readonly fingerprint: string;
  readonly categories: readonly { id:string; label:string; status:string }[];
  readonly tags: readonly { id:string; label:string; status:string }[];
  readonly records: readonly { contentId:string; collection:string; slug:string; route:string;
    source:string; sourceSha256:string; registrySha256:string }[];
  readonly occupiedRoutes: readonly string[];
  readonly registrySnapshot: Readonly<Record<string,string>>;
}
const supersessionSchema = z.object({from:stableIdSchema,to:stableIdSchema,reason:z.string().min(1)}).strict();
const storeSchema = z.object({
  schemaVersion:z.literal(1), jobId:stableIdSchema, spec:articleJobSpecSchema, jobFingerprint:sha256Schema,
  repositoryFingerprint:sha256Schema, registrySnapshotSha256:sha256Schema, baseCommit:z.string().regex(/^[a-f0-9]{40}$/),
  original:z.object({sourceSha256:sha256Schema,route:z.string(),registrySha256:sha256Schema}).strict().optional(),
  activeAttemptId:stableIdSchema, supersessions:z.array(supersessionSchema),
}).strict();
export const draftAttemptSchema = z.object({
  schemaVersion:z.literal(1), attemptId:stableIdSchema, jobId:stableIdSchema, jobFingerprint:sha256Schema,
  inputSha256:sha256Schema, state:articleJobStateSchema,
  candidateSha256:sha256Schema.optional(), approvalSha256:sha256Schema.optional(),
}).strict();
export type DraftStore = z.infer<typeof storeSchema>;
const encode = (value:unknown) => canonicalJson(value) + "\n";
export const jobDirectory = (root:string,id:string) => {
  if (!/^job-[a-f0-9-]{36}$/u.test(id)) fail("JOB_ID_INVALID");
  return join(root,id);
};
const attemptDirectory = (directory:string,id:string) => {
  if (!/^attempt-[a-f0-9-]{36}$/u.test(id)) fail("ATTEMPT_ID_INVALID");
  return join(directory,"attempts",id);
};
export const readDraftStore = async (directory:string) => {
  const store = storeSchema.parse(JSON.parse(await safeRead(join(directory,"job.json"))));
  if (store.jobFingerprint !== fingerprint(store.spec) || store.jobId !== store.spec.jobId
    || store.spec.externalAiDisclosure.policy.policySha256 !== currentExternalAiPolicyBinding.policySha256
    || store.spec.externalAiDisclosure.policy.policyId !== currentExternalAiPolicyBinding.policyId) fail("JOB_SPEC_STALE",3);
  const base=JSON.parse(await safeRead(join(directory,"base","repository.json")));
  const registry=JSON.parse(await safeRead(join(directory,"base","registries.json")));
  if(base.commit!==store.baseCommit || base.repositoryFingerprint!==store.repositoryFingerprint
    || fingerprint(registry)!==store.registrySnapshotSha256
    || !store.spec.inputs.repositoryRefs.some(ref=>ref.inputId==="site-base" && ref.commitSha===store.baseCommit))fail("BASE_SNAPSHOT_INVALID",3);
  if(store.original && (sha256(await safeRead(join(directory,"base","original.md")))!==store.original.sourceSha256
    || store.original.registrySha256!==store.registrySnapshotSha256))fail("UPDATE_BASE_INVALID",3);
  return store;
};
export const normalizeWorking = (text:string) => text.replace(/^\uFEFF/u,"").replace(/\r\n?/gu,"\n");
export const splitDraft = (text:string) => {
  const normalized=normalizeWorking(text), match=/^---\n([\s\S]+?)\n---(?:\n|$)/u.exec(normalized);
  if (!match) fail("FRONTMATTER_REQUIRED");
  const doc=parseDocument(match[1]!,{uniqueKeys:true});
  if (doc.errors.length) fail("FRONTMATTER_INVALID");
  return {frontmatter:blogFrontmatterSchema.parse(doc.toJS()),body:normalized.slice(match[0].length)};
};
const workingDocument=(frontmatter:BlogFrontmatter,body:string) => "---\n"+stringify(frontmatter,{lineWidth:0}).trimEnd()+"\n---\n"+body;
export const validateDraft = async (text:string,store:DraftStore,repo:DraftRepository) => {
  const {frontmatter,body}=splitDraft(text);
  if (frontmatter.id !== store.spec.target.contentId || frontmatter.draft !== true) fail("DRAFT_ID_OR_PUBLICATION_CHANGED");
  if (!repo.categories.some(item=>item.id===frontmatter.category && item.status==="active")
    || frontmatter.tags.some(id=>!repo.tags.some(item=>item.id===id && item.status==="active"))) fail("TAXONOMY_INVALID");
  if (containsHardDenyMaterial(Buffer.from(text)) || /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,})/u.test(text)) fail("SECRET_MATERIAL_DENIED");
  const rendered=await renderDraftMarkdown(body);
  return {frontmatter,body,html:rendered.html,warnings:[
    "非公開の作業稿です。正式候補・公開承認・独立監査ではありません。",
    "根拠・引用・コード例検証・hero/social画像・公開予定設定・監査・保存/exportは未実装または未準備です。",
    "リンク先は取得・検証していません。公開サイトのlayout/SEO適合性は未検証です。",
    ...rendered.warnings,
  ]};
};
export const attemptStatus = async (directory:string,store:DraftStore,repo:DraftRepository) => {
  const input=normalizeWorking(await safeRead(join(directory,"working.md")));
  const attempt=draftAttemptSchema.parse(JSON.parse(await safeRead(join(attemptDirectory(directory,store.activeAttemptId),"attempt.json"))));
  if (attempt.jobId!==store.jobId || attempt.attemptId!==store.activeAttemptId || attempt.jobFingerprint!==store.jobFingerprint) fail("ATTEMPT_BINDING_INVALID",3);
  const folder=attemptDirectory(directory,store.activeAttemptId);
  const snapshot=await safeRead(join(folder,"input.md")), body=await safeRead(join(folder,"body.md"));
  const artifact=humanDraftArtifactSchema.parse(JSON.parse(await safeRead(join(folder,"human-draft.json"))));
  if(sha256(snapshot)!==attempt.inputSha256 || sha256(body)!==artifact.bodyArtifactSha256
    || body!==splitDraft(snapshot).body || artifact.contentId!==store.spec.target.contentId
    || artifact.producer.input.jobId!==store.jobId || artifact.producer.input.attemptId!==attempt.attemptId
    || fingerprint(artifact.frontmatter)!==fingerprint(splitDraft(snapshot).frontmatter))fail("DRAFT_ARTIFACT_BINDING_INVALID",3);
  const current=attempt.inputSha256===sha256(input) && repo.fingerprint===store.repositoryFingerprint;
  return {input,attempt,current,inputSha256:sha256(input)};
};
export const assertCurrentDraft = async (directory:string,store:DraftStore,repo:DraftRepository) => {
  const status=await attemptStatus(directory,store,repo);
  if (!status.current) fail("DRAFT_CHANGED_OLD_ARTIFACTS_STALE",3);
  return status;
};
const permissions = (intent:"review"|"publish",network:boolean,localMediaProcessing=false) => ({
  networkAccess:network,externalTextAI:false,externalImageAI:false,localMediaProcessing:intent==="publish"||localMediaProcessing,
  privateCanonicalMediaStorage:intent==="publish", publicMediaUpload:intent==="publish",
  protectedMediaOperation:intent==="publish",repositoryExport:intent==="publish",
});
const makeAttempt = async (directory:string,store:DraftStore,text:string,sourceHash:string) => {
  const attemptId="attempt-"+randomUUID(), folder=attemptDirectory(directory,attemptId);
  await noLinks(folder); await mkdir(folder,{recursive:true,mode:0o700});
  const parsed=splitDraft(text);
  const input={schemaVersion:1 as const,jobId:store.jobId,attemptId,contentId:store.spec.target.contentId,
    sourceArtifactSha256:sourceHash,producer:"human" as const,importedAt:new Date().toISOString()};
  const artifact=humanDraftArtifactSchema.parse({schemaVersion:1,draftId:"draft-"+randomUUID(),
    contentId:store.spec.target.contentId,bodyArtifactSha256:sha256(parsed.body),frontmatter:parsed.frontmatter,
    producer:{kind:"human",input}});
  const attempt=draftAttemptSchema.parse({schemaVersion:1,attemptId,jobId:store.jobId,
    jobFingerprint:store.jobFingerprint,inputSha256:sha256(text),state:"CREATED"});
  await immutable(join(folder,"input.md"),text); await immutable(join(folder,"body.md"),parsed.body);
  await immutable(join(folder,"human-draft.json"),encode(artifact));
  await immutable(join(folder,"attempt.json"),encode(attempt));
  return attemptId;
};
export interface InitDraftOptions {
  title?:string; description?:string; slug?:string; category?:string; tags?:string[]; pubDate?:string;
  readerOutcome?:string; contentId?:string; updateKind?:string;
  intent:"review"|"publish"; network:boolean; allowRouteChange?:boolean; fromJob?:string; localMediaProcessing?:boolean;
}
export const initDraft = async (root:string,repo:DraftRepository,options:InitDraftOptions) => locked(root,async()=>{
  const jobId="job-"+randomUUID(); let id:string=randomUUID(), text:string;
  let original:DraftStore["original"]; let sourceSpec:DraftStore["spec"]|undefined;
  if (options.fromJob) {
    const sourceDirectory=jobDirectory(root,options.fromJob);
    return locked(sourceDirectory,async()=>{
      const source=await readDraftStore(sourceDirectory);
      const status=await assertCurrentDraft(sourceDirectory,source,repo);
      if(status.attempt.state!=="CREATED")fail("ADVANCED_FROM_JOB_NOT_IMPLEMENTED",3);
      await validateDraft(status.input,source,repo);
      return create(source.spec.target.contentId,status.input,source.original,source.spec);
    });
  }
  if (options.contentId) {
    contentIdSchema.parse(options.contentId);
    const matches=repo.records.filter(item=>item.contentId===options.contentId);
    if (matches.length!==1 || matches[0]!.collection!=="blog") fail("UPDATE_TARGET_NOT_UNIQUE_BLOG");
    const record=matches[0]!;
    if (options.slug && options.slug!==record.slug) {
      if(!options.allowRouteChange)fail("ROUTE_CHANGE_REQUIRES_EXPLICIT_PERMISSION",3);
      if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(options.slug)||options.slug.length>80
       ||["category","categories","tag","tags","page","feed","rss","search","index"].includes(options.slug)||repo.occupiedRoutes.includes("/blog/"+options.slug+"/"))fail("SLUG_OR_ROUTE_CONFLICT",3);
    }
    id=record.contentId; const parsed=splitDraft(record.source);
    text=workingDocument({...parsed.frontmatter,draft:true},parsed.body);
    original={sourceSha256:record.sourceSha256,route:record.route,registrySha256:record.registrySha256};
    return create(id,text,original);
  }
  if (!options.title || !options.description || !options.category || !options.pubDate || !options.readerOutcome) fail("INIT_FIELDS_REQUIRED");
  if (options.slug && (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(options.slug) || options.slug.length>80
    || ["category","categories","tag","tags","page","feed","rss","search","index"].includes(options.slug)
    || repo.occupiedRoutes.some(route=>route.replace(/\/$/u,"")==="/blog/"+options.slug))) fail("SLUG_OR_ROUTE_CONFLICT");
  if (repo.occupiedRoutes.includes(articleRoute(id)) || repo.records.some(record=>record.contentId===id)) fail("CONTENT_ID_COLLISION");
  if(repo.records.some(record=>record.collection==='blog'&&record.slug===articleUrlId(id)))fail('ARTICLE_SOURCE_PATH_COLLISION',3);
  text=workingDocument(blogFrontmatterSchema.parse({id,title:options.title,description:options.description,
    pubDate:options.pubDate,category:options.category,tags:options.tags??[],draft:true}),"\n## はじめに\n\nここから本文を書いてください。\n");
  return create(id,text);
  async function create(contentId:string,input:string,origin?:DraftStore["original"],fromSpec?:DraftStore["spec"]) {
    sourceSpec=fromSpec;
    const parsed=splitDraft(input), target=sourceSpec?.target??{collection:"blog",contentId,
      workingTitle:parsed.frontmatter.title,slugHint:articleUrlId(contentId),
      articleMode:"explanation",...(options.contentId?{existingContentId:contentId,updateKind:options.updateKind??"correction",allowRouteChange:options.allowRouteChange===true}:{})};
    const normalized=normalizeArticleJobSpec({schemaVersion:1,jobId,operation:sourceSpec?.operation??(options.contentId?"update":"create"),target,
      reader:sourceSpec?.reader??{outcome:options.readerOutcome??"既存記事を修正して確認する",assumedKnowledge:[],language:"ja"},
      inputs:{userNotes:[],repositoryRefs:[{inputId:"site-base",repository:"Xpotato1024/xpotato-site",commitSha:repo.commit,visibility:"public"}],localSourceRefs:[],seedUrls:[],sourceDiscoveryQueries:[]},
      externalAiDisclosure:{policy:currentExternalAiPolicyBinding,explicitAuthorizations:[]},
      constraints:sourceSpec?.constraints??{requiredClaims:[],forbiddenClaims:[],requiredSections:[],forbiddenPublicationPatterns:[]},
      taxonomyHints:{categoryId:parsed.frontmatter.category,tagIds:parsed.frontmatter.tags},
      media:{suppliedMediaRefs:[],heroPreference:"deterministic_cover",requiredInlineVisuals:[]},
      permissions:permissions(options.intent,options.network,options.localMediaProcessing)});
    const directory=jobDirectory(root,jobId);
    const store=storeSchema.parse({schemaVersion:1,jobId,spec:normalized.spec,jobFingerprint:normalized.jobFingerprint,
      repositoryFingerprint:repo.fingerprint,registrySnapshotSha256:fingerprint(repo.registrySnapshot),baseCommit:repo.commit,...(origin?{original:origin}:{}),
      activeAttemptId:"pending",supersessions:[]});
    // Existing update bodies can require portable cleanup; init never evaluates them.
    if (!options.contentId && !fromSpec) await validateDraft(input,store,repo);
    await mkdir(directory,{mode:0o700}); await mkdir(join(directory,"attempts"),{mode:0o700});
    await mkdir(join(directory,"base"),{mode:0o700});
    await immutable(join(directory,"base","registries.json"),encode(repo.registrySnapshot));
    await immutable(join(directory,"base","repository.json"),encode({commit:repo.commit,repositoryFingerprint:repo.fingerprint}));
    if(origin){
      const before=repo.records.find(item=>item.contentId===contentId);
      if(!before || before.sourceSha256!==origin.sourceSha256)fail("UPDATE_BASE_CHANGED",3);
      await immutable(join(directory,"base","original.md"),before.source);
    }
    const activeAttemptId=await makeAttempt(directory,store,input,sha256(input));
    await atomic(join(directory,"working.md"),input);
    await atomic(join(directory,"job.json"),encode({...store,activeAttemptId}));
    return {jobId,contentId,route:articleRoute(contentId),directory,state:"CREATED",productionEligible:false,workingPath:join(directory,"working.md")};
  }
});
export const reviseDraft = async (directory:string,repo:DraftRepository,reason:string,imported?:string) => locked(directory,async()=>{
  const store=await readDraftStore(directory), status=await attemptStatus(directory,store,repo);
  if (["EXPORTED","BLOCKED","FAILED","CANCELLED"].includes(status.attempt.state)) fail("TERMINAL_JOB_NEW_JOB_REQUIRED",3);
  if (repo.fingerprint!==store.repositoryFingerprint) fail("REPOSITORY_SNAPSHOT_CHANGED_NEW_JOB_REQUIRED",3);
  let text=imported===undefined?status.input:normalizeWorking(imported);
  if (imported!==undefined && !/^---\n/u.test(text)) text=workingDocument(splitDraft(status.input).frontmatter,text);
  await validateDraft(text,store,repo);
  if (imported!==undefined && status.current && sha256(text)===status.inputSha256) return {jobId:store.jobId,attemptId:store.activeAttemptId,reused:true,state:status.attempt.state,productionEligible:false};
  const next=await makeAttempt(directory,store,text,sha256(imported??text));
  // Editors do not participate in the CLI lock. Recheck at the commit boundary.
  if(sha256(normalizeWorking(await safeRead(join(directory,"working.md"))))!==status.inputSha256)fail("WORKING_CHANGED_DURING_REVISION",3);
  // Revise snapshots external edits without rewriting the editor-owned working file.
  if(imported!==undefined)await atomic(join(directory,"working.md"),text);
  if(sha256(normalizeWorking(await safeRead(join(directory,"working.md"))))!==sha256(text))fail("WORKING_CHANGED_DURING_REVISION",3);
  await atomic(join(directory,"job.json"),encode({...store,activeAttemptId:next,
    supersessions:[...store.supersessions,{from:store.activeAttemptId,to:next,reason}]}));
  return {jobId:store.jobId,attemptId:next,supersededAttemptId:store.activeAttemptId,state:"CREATED",oldArtifactsStale:true,productionEligible:false};
});
export const guideDraft = async (directory:string,repo:DraftRepository,repositoryRoot=process.cwd()) => locked(directory,async()=>{
  const store=await readDraftStore(directory),status=await attemptStatus(directory,store,repo);
  let valid=true; try {await validateDraft(status.input,store,repo);} catch {valid=false;}
  let reviewState=status.attempt.state,reviewStale=false,hasReview=false;
  try{
    const binding={jobId:store.jobId,attemptId:store.activeAttemptId,jobFingerprint:store.jobFingerprint,inputSha256:status.attempt.inputSha256};
    const journal=await readReviewJournal(directory,binding,false);hasReview=journal.head.receipts.length>0;
    if(hasReview){reviewState=journal.state;await readReviewJournal(directory,binding);}
  }catch{reviewStale=true;}
  let visualStale=false,candidateHash:string|null=null,hasVisual=false;
  try{
    await safeRead(join(directory,"attempts",store.activeAttemptId,"visual/head.json"));hasVisual=true;
    const {visualContext}=await import("./visual-review.js"),visual=await visualContext(directory,repo,repositoryRoot,false);
    reviewState=visual.state;
    if(visual.state==="HUMAN_REVIEW_READY"){
      const {visualPayload}=await import("./visual-review.js");candidateHash=(await visualPayload(visual,"candidate")).candidateSha256;
    }
  }catch(error){if(hasVisual)visualStale=true;else if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;}
  const publication=await (await import("./publication-diagnostics.js")).publicationDiagnostics(directory,repo,repositoryRoot);
  const human=publication.find(item=>item.mode==="human");
  if(human&&!human.stale&&human.currentState)reviewState=articleJobStateSchema.parse(human.currentState);
  reviewStale=reviewStale||visualStale||Boolean(human?.stale);
  return {jobId:store.jobId,contentId:store.spec.target.contentId,attemptId:store.activeAttemptId,
    currentState:status.current&&valid&&!reviewStale?reviewState:null,historicalState:reviewState,
    stale:!status.current||reviewStale,validDraft:valid,productionEligible:false,candidateHash,
    publication,
    blockers:["LIVE_MEDIA_GATE_CLOSED: 実resource・操作認可・provider未受入れ。mockは本人承認・実保存・本番exportではありません。",
      ...(visualStale?["VISUAL_INPUT_CHANGED: 画像・監査・候補・build設定の変更により旧候補は失効しました。reviseしてください。"]:[]),
      ...(reviewStale?["REVIEW_INPUT_CHANGED: source/evidence/auditまたはreceiptが変更され、旧監査・bundleは失効しました。reviseしてください。"]:[]),
      ...(!status.current?["INPUT_CHANGED: 旧preview・candidate・approvalは現在稿に使えません。reviseを実行してください。"]:[]),
      ...(repo.fingerprint!==store.repositoryFingerprint?["REPOSITORY_CHANGED: 新jobを作成して作業稿を再取込みしてください。"]:[]),
      ...(!valid?["VALIDATION_FAILED: working.mdのfrontmatter・portable Markdown・taxonomyを修正してください。"]:[])],
    next:repo.fingerprint!==store.repositoryFingerprint?["init then draft import"]:status.current&&valid&&!reviewStale?["draft import","validate --level draft","preview --draft",...(hasVisual?["visual-audit prepare","media prepare","candidate build --reference"]:hasReview?["review prepare","visual plan"]:["sources import"])]:["revise","draft import"]};
});
