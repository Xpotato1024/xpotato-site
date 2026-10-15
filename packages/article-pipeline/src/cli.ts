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
      output({command,url:served.url,output:served.output,...served.manifest});
      const stop=()=>served.server.close();process.once("SIGINT",stop);process.once("SIGTERM",stop);
      await new Promise<void>(resolve=>served.server.once("close",resolve));
      process.off("SIGINT",stop);process.off("SIGTERM",stop);return 0;
    }
    fail("STAGE_NOT_IMPLEMENTED",3);
  } catch(error) {
    const known=error instanceof DraftError;
    output({command,error:{code:known?error.code:"INPUT_OR_ENVIRONMENT_INVALID",
      remediation:"guideで状態を確認し、入力・job lock・権限を見直してください。公開候補の後続工程は未実装です。"},productionEligible:false});
    return known?error.exitCode:(error instanceof Error && (error.name==="ZodError" || error.message==="DRAFT_MARKDOWN_INVALID" || "code" in error && String(error.code).startsWith("ERR_PARSE_ARGS"))?2:4);
  }
};
