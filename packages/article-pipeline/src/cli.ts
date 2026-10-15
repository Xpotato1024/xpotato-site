import {importReviewSources,importReviewEvidence,prepareContentAudit,importContentAudit,inspectDraftExamples,buildContentReviewBundle,serveContentReviewBundle} from "./content-review.js";
import { parseArgs } from "node:util";
import { extname } from "node:path";
import { DraftError, fail, privateRoot, safeRead, locked } from "./private-files.js";
import { guideDraft, initDraft, jobDirectory, readDraftStore, assertCurrentDraft, reviseDraft, validateDraft, type DraftRepository } from "./draft-job.js";
import { buildDraftPreview, serveDraftPreview } from "./draft-preview.js";

const options={
  "local-media-processing":{type:"boolean"},json:{type:"boolean"},root:{type:"string"},job:{type:"string"},collection:{type:"string"},
  title:{type:"string"},description:{type:"string"},slug:{type:"string"},category:{type:"string"},
  tags:{type:"string"},"pub-date":{type:"string"},"reader-outcome":{type:"string"},
  "content-id":{type:"string"},"update-kind":{type:"string"},"from-job":{type:"string"},authoring:{type:"string"},
  intent:{type:"string"},network:{type:"string"},from:{type:"string"},reason:{type:"string"},
  level:{type:"string"},draft:{type:"boolean"},port:{type:"string"},"build-only":{type:"boolean"},
} as const;
export const articleCli = async (argv:string[],repository:string,loadRepository:()=>Promise<DraftRepository>,output=(value:unknown)=>console.log(JSON.stringify(value))) => {
  let command="article";
  try {
    const args=parseArgs({args:argv,options,allowPositionals:true,strict:true});
    const [area,action,subaction,...remaining]=args.positionals; const v=args.values;
    command=args.positionals.join(" ");
    if(area!=="article" || remaining.length)fail("COMMAND_INVALID");
    const repo=await loadRepository();
    if(action==="taxonomy"&&subaction==="list") {
      if(v.collection&&v.collection!=="blog")fail("COLLECTION_NOT_IMPLEMENTED",3);
      output({command,categories:repo.categories.filter(item=>item.status==="active"),tags:repo.tags.filter(item=>item.status==="active")}); return 0;
    }
    const root=await privateRoot(repository,v.root);
    if(action==="init"&&!subaction) {
      if(v.collection&&v.collection!=="blog" || v.authoring&&v.authoring!=="human")fail("AUTHORING_MODE_NOT_IMPLEMENTED",3);
      if(v.intent&&v.intent!=="review"&&v.intent!=="publish" || v.network&&v.network!=="enabled"&&v.network!=="disabled")fail("OPTION_VALUE_INVALID");
      const init={intent:v.intent==="publish"?"publish" as const:"review" as const,network:v.network==="enabled",localMediaProcessing:v["local-media-processing"]===true,
        ...(v.title?{title:v.title}:{}),...(v.description?{description:v.description}:{}),...(v.slug?{slug:v.slug}:{}),
        ...(v.category?{category:v.category}:{}),...(v.tags?{tags:v.tags.split(",")}:{}),...(v["pub-date"]?{pubDate:v["pub-date"]}:{}),
        ...(v["reader-outcome"]?{readerOutcome:v["reader-outcome"]}:{}),...(v["content-id"]?{contentId:v["content-id"]}:{}),
        ...(v["update-kind"]?{updateKind:v["update-kind"]}:{}),...(v["from-job"]?{fromJob:v["from-job"]}:{})};
      output({command,...await initDraft(root,repo,init)});return 0;
    }
    if(!v.job)fail("JOB_REQUIRED");
    const directory=jobDirectory(root,v.job);
    if((action==="sources"||action==="evidence"||action==="audit")&&subaction==="import"){
      if(!v.from||extname(v.from).toLowerCase()!==".json"
        ||v.from.split(/[\\/]/u).some(part=>/^(?:\.\.|\.git|\.ssh|\.aws|\.codex|\.env.*|node_modules|credentials(?:\..*)?|secrets?(?:\..*)?)$/iu.test(part)))fail("IMPORT_PATH_DENIED");
      const data=JSON.parse(await safeRead(v.from));
      const imported=action==="sources"?await importReviewSources(directory,repo,data):action==="evidence"?await importReviewEvidence(directory,repo,data):await importContentAudit(directory,repo,data);
      output({command,...imported});return 0;
    }
    if(action==="audit"&&subaction==="prepare"){output({command,...await prepareContentAudit(directory,repo)});return 0;}
    if(action==="examples"&&subaction==="inspect"){output({command,...await inspectDraftExamples(directory,repo)});return 0;}
    if(action==="review"&&subaction==="preview"){
      const port=v.port===undefined?0:Number(v.port);
      const served=await serveContentReviewBundle(directory,repo,port,loadRepository);
      output({command,...served.manifest,url:served.url,output:served.output});
      const stop=()=>served.server.close();process.once("SIGINT",stop);process.once("SIGTERM",stop);
      await new Promise<void>(resolve=>served.server.once("close",resolve));process.off("SIGINT",stop);process.off("SIGTERM",stop);return 0;
    }
    if(action==="review"&&subaction==="prepare"){
      const {html,headers,...bundle}=await buildContentReviewBundle(directory,repo);output({command,...bundle});return 0;
    }
    if(action==="guide"&&!subaction){output({command,...await guideDraft(directory,repo)});return 0;}
    if(action==="revise"&&!subaction) {
      if(!v.reason)fail("REVISION_REASON_REQUIRED");
      output({command,...await reviseDraft(directory,repo,v.reason)});return 0;
    }
    if(action==="draft"&&subaction==="import") {
      if(!v.from || ![".md",".mdx"].includes(extname(v.from).toLowerCase())
        || v.from.split(/[\\/]/u).some(part=>/^(?:\.\.|\.git|\.ssh|\.aws|\.codex|\.env.*|node_modules|credentials(?:\..*)?|secrets?(?:\..*)?)$/iu.test(part)))fail("IMPORT_PATH_DENIED");
      const text=await safeRead(v.from);
      output({command,...await reviseDraft(directory,repo,"human draft import",text)});return 0;
    }
    if(action==="validate"&&!subaction) {
      if(v.level!=="draft")fail("CANDIDATE_NOT_IMPLEMENTED",3);
      const result=await locked(directory,async()=>{
        const store=await readDraftStore(directory),status=await assertCurrentDraft(directory,store,repo);
        const valid=await validateDraft(status.input,store,repo);
        return {jobId:store.jobId,attemptId:store.activeAttemptId,state:status.attempt.state,productionEligible:false,warnings:valid.warnings};
      });output({command,...result});return 0;
    }
    if(action==="preview"&&!subaction) {
      if(v.draft!==true)fail("CANDIDATE_NOT_IMPLEMENTED",3);
      if(v["build-only"]){const built=await buildDraftPreview(directory,repo);output({command,output:built.output,...built.manifest});return 0;}
      const port=v.port===undefined?0:Number(v.port);
      const served=await serveDraftPreview(directory,repo,port,loadRepository);
      output({command,...served.manifest,url:served.url,output:served.output});
      const stop=()=>served.server.close();process.once("SIGINT",stop);process.once("SIGTERM",stop);
      await new Promise<void>(resolve=>served.server.once("close",resolve));
      process.off("SIGINT",stop);process.off("SIGTERM",stop);return 0;
    }
    fail("STAGE_NOT_IMPLEMENTED",3);
  } catch(error) {
    const known=error instanceof DraftError;
    const inputError=error instanceof Error && (error instanceof SyntaxError || error.name==="ZodError" || error.message==="DRAFT_MARKDOWN_INVALID"
      || /^(?:CITATION_|FOOTNOTE_|REVIEW_MARKDOWN_|EXAMPLE_POSITION_)/u.test(error.message)
      || "code" in error && String(error.code).startsWith("ERR_PARSE_ARGS"));
    output({command,error:{code:known?error.code:inputError?"INPUT_VALIDATION_FAILED":"ENVIRONMENT_OR_PROCESSING_FAILED",
      remediation:"guideで状態を確認し、入力・job lock・権限を見直してください。編集後はreviseで新attemptを作成してください。画像・完全候補以降は後続です。"},productionEligible:false});
    return known?error.exitCode:inputError?2:4;
  }
};
