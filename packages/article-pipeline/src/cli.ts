import {prepareExampleVerification,importReviewSources,importReviewEvidence,prepareContentAudit,importContentAudit,inspectDraftExamples,buildContentReviewBundle,serveContentReviewBundle} from "./content-review.js";
import { parseArgs } from "node:util";
import { extname } from "node:path";
import { DraftError, fail, privateRoot, safeRead, locked } from "./private-files.js";
import { guideDraft, initDraft, jobDirectory, readDraftStore, assertCurrentDraft, reviseDraft, validateDraft, type DraftRepository } from "./draft-job.js";
import { buildDraftPreview, serveDraftPreview } from "./draft-preview.js";

const options={
  mock:{type:"boolean"},"allow-route-change":{type:"boolean"},"local-media-processing":{type:"boolean"},json:{type:"boolean"},root:{type:"string"},job:{type:"string"},collection:{type:"string"},
  title:{type:"string"},description:{type:"string"},slug:{type:"string"},category:{type:"string"},
  tags:{type:"string"},"pub-date":{type:"string"},"reader-outcome":{type:"string"},
  "content-id":{type:"string"},"update-kind":{type:"string"},"from-job":{type:"string"},authoring:{type:"string"},
  intent:{type:"string"},network:{type:"string"},from:{type:"string"},reason:{type:"string"},
  level:{type:"string"},draft:{type:"boolean"},port:{type:"string"},"build-only":{type:"boolean"},candidate:{type:"string"},reference:{type:"boolean"},
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
      const init={allowRouteChange:v["allow-route-change"]===true,intent:v.intent==="publish"?"publish" as const:"review" as const,network:v.network==="enabled",localMediaProcessing:v["local-media-processing"]===true,
        ...(v.title?{title:v.title}:{}),...(v.description?{description:v.description}:{}),...(v.slug?{slug:v.slug}:{}),
        ...(v.category?{category:v.category}:{}),...(v.tags?{tags:v.tags.split(",")}:{}),...(v["pub-date"]?{pubDate:v["pub-date"]}:{}),
        ...(v["reader-outcome"]?{readerOutcome:v["reader-outcome"]}:{}),...(v["content-id"]?{contentId:v["content-id"]}:{}),
        ...(v["update-kind"]?{updateKind:v["update-kind"]}:{}),...(v["from-job"]?{fromJob:v["from-job"]}:{})};
      output({command,...await initDraft(root,repo,init)});return 0;
    }
    if(!v.job)fail("JOB_REQUIRED");
    const directory=jobDirectory(root,v.job);
    const importedJson=async()=>{
      if(!v.from||extname(v.from).toLowerCase()!==".json"||v.from.split(/[\\/]/u).some(part=>/^(?:\.\.|\.git|\.ssh|\.aws|\.codex|\.env.*|node_modules|credentials(?:\..*)?|secrets?(?:\..*)?)$/iu.test(part)))fail("IMPORT_PATH_DENIED");
      return JSON.parse(await safeRead(v.from));
    };
    if(action==="approve"&&!subaction){
      if(!v.candidate)fail("CANDIDATE_TARGET_SHA_REQUIRED");
      const lane=await import("./publication-approval.js");
      output({command,...await (v.mock?lane.approveMockCandidate:lane.approveHumanCandidate)(directory,repo,repository,v.candidate)});return 0;
    }
    if(action==="media"&&["source-store","publish","protect","plan"].includes(subaction??"")||action==="export"&&!subaction||action==="publication"&&subaction==="validate"){
      if(!v.candidate)fail("CANDIDATE_TARGET_SHA_REQUIRED");
      if(subaction==="plan"){
        const checked=await (await import("./candidate-preview.js")).validateArticleCandidate(directory,repo,repository,v.candidate);
        output({command,simulation:false,storagePlan:checked.materials.storagePlan,liveReady:false,productionEligible:false,
          blockers:["LIVE_MEDIA_RESOURCES_AND_OPERATION_AUTHORIZATION_NOT_ESTABLISHED"]});return 0;
      }
      if(!v.mock)(await import("./publication-approval.js")).requireLivePublicationResources();
      const {DirectoryMockPublicationPort}=await import("./publication-mock-port.js");
      const port=new DirectoryMockPublicationPort(root+"/.mock-media-provider");
      if(action==="export"){
        output({command,...await (await import("./publication-export.js")).exportMockCandidate(directory,repo,repository,v.candidate,port)});return 0;
      }
      const persistence=await import("./publication-persistence.js");
      if(action==="publication"){
        const approval=await import("./publication-approval.js"),c=await approval.publicationCandidate(directory,repo,repository,v.candidate,"mock"),head=await approval.readPublicationHead(c);
        await persistence.validateMockReceipts(c,head);await persistence.verifyMockStoredObjects(c,head,port);
        output({command,state:"MOCK_"+head.state,candidateSha256:v.candidate,isHumanApproval:false,productionEligible:false});return 0;
      }
      const plane=subaction==="source-store"?"source":subaction==="publish"?"public":"protected";
      output({command,...await persistence.persistMockMedia(directory,repo,repository,v.candidate,plane,port)});return 0;
    }
    if(action==="visual"&&subaction==="plan"){output({command,...await (await import("./visual-review.js")).planArticleVisuals(directory,repo,repository,v.from?await importedJson():undefined)});return 0;}
    if(action==="visual"&&subaction==="materialize"){output({command,...await (await import("./visual-review.js")).materializeArticleVisuals(directory,repo,repository)});return 0;}
    if(action==="visual-audit"&&subaction==="prepare"){output({command,...await (await import("./visual-review.js")).prepareVisualAudit(directory,repo,repository)});return 0;}
    if(action==="visual-audit"&&subaction==="import"){output({command,...await (await import("./visual-review.js")).importVisualAudit(directory,repo,repository,await importedJson())});return 0;}
    if(action==="media"&&subaction==="prepare"){output({command,...await (await import("./visual-review.js")).prepareArticleMedia(directory,repo,repository)});return 0;}
    if(action==="candidate"&&subaction==="build"){output({command,...await (await import("./candidate-review.js")).buildArticleCandidate(directory,repo,repository,v.reference===true)});return 0;}
    if(action==="candidate"&&subaction==="preview"){
      if(!v.candidate)fail("CANDIDATE_TARGET_SHA_REQUIRED");
      const served=await (await import("./candidate-preview.js")).serveArticleCandidate(directory,repo,repository,v.candidate,v.port===undefined?0:Number(v.port),loadRepository);
      output({command,...served.manifest,url:served.url,articleUrl:served.articleUrl,output:served.output});
      const stop=()=>{served.server.close();served.server.closeAllConnections();};process.once("SIGINT",stop);process.once("SIGTERM",stop);
      await new Promise<void>(resolve=>served.server.once("close",resolve));process.off("SIGINT",stop);process.off("SIGTERM",stop);return 0;
    }
    if(v.candidate&&(action==="validate"&&v.level==="candidate"||action==="review"&&subaction==="prepare")){
      const checked=await locked(directory,async()=>(await import("./candidate-preview.js")).validateArticleCandidate(directory,repo,repository,v.candidate!));
      output({command,targetSha256:checked.artifact.targetSha256,candidateSha256:checked.artifact.candidateSha256,
        approvalEligible:checked.artifact.approvalEligible,reference:checked.artifact.reference,productionEligible:false,
        ...(action==="review"?{review:checked.artifact.review}:{validation:checked.artifact.preview.validation})});return 0;
    }
    if((action==="sources"||action==="evidence"||action==="audit")&&subaction==="import"||action==="examples"&&subaction==="prepare"){
      if(!v.from||extname(v.from).toLowerCase()!==".json"
        ||v.from.split(/[\\/]/u).some(part=>/^(?:\.\.|\.git|\.ssh|\.aws|\.codex|\.env.*|node_modules|credentials(?:\..*)?|secrets?(?:\..*)?)$/iu.test(part)))fail("IMPORT_PATH_DENIED");
      const data=JSON.parse(await safeRead(v.from));
      const imported=action==="examples"?await prepareExampleVerification(directory,repo,data):action==="sources"?await importReviewSources(directory,repo,data):action==="evidence"?await importReviewEvidence(directory,repo,data):await importContentAudit(directory,repo,data);
      output({command,...imported});
      if(action==="evidence"&&"examplesReady" in imported&&imported.examplesReady===false){
        const blockers="blockers" in imported?imported.blockers:[];
        return blockers.some(item=>item.category==="environment_unavailable")?4:2;
      }
      return 0;
    }
    if(action==="audit"&&subaction==="prepare"){output({command,...await prepareContentAudit(directory,repo)});return 0;}
    if(action==="examples"&&subaction==="inspect"){output({command,...await inspectDraftExamples(directory,repo)});return 0;}
    if(action==="review"&&subaction==="preview"){
      const port=v.port===undefined?0:Number(v.port);
      const served=await serveContentReviewBundle(directory,repo,port,loadRepository);
      output({command,...served.manifest,url:served.url,output:served.output});
      const stop=()=>{served.server.close();served.server.closeAllConnections();};process.once("SIGINT",stop);process.once("SIGTERM",stop);
      await new Promise<void>(resolve=>served.server.once("close",resolve));process.off("SIGINT",stop);process.off("SIGTERM",stop);return 0;
    }
    if(action==="review"&&subaction==="prepare"){
      const {html,headers,...bundle}=await buildContentReviewBundle(directory,repo);output({command,...bundle});return 0;
    }
    if(action==="guide"&&!subaction){output({command,...await guideDraft(directory,repo,repository)});return 0;}
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
      const stop=()=>{served.server.close();served.server.closeAllConnections();};process.once("SIGINT",stop);process.once("SIGTERM",stop);
      await new Promise<void>(resolve=>served.server.once("close",resolve));
      process.off("SIGINT",stop);process.off("SIGTERM",stop);return 0;
    }
    fail("STAGE_NOT_IMPLEMENTED",3);
  } catch(error) {
    const known=error instanceof DraftError;
    const inputError=error instanceof Error && (error instanceof SyntaxError || error.name==="ZodError" || error.message==="DRAFT_MARKDOWN_INVALID"
      || /^(?:CITATION_|FOOTNOTE_|REVIEW_MARKDOWN_|EXAMPLE_POSITION_|EXAMPLE_VERIFICATION_)/u.test(error.message)
      || "code" in error && String(error.code).startsWith("ERR_PARSE_ARGS"));
    output({command,error:{code:known?error.code:inputError?"INPUT_VALIDATION_FAILED":"ENVIRONMENT_OR_PROCESSING_FAILED",
      remediation:"guideで状態を確認し、入力・job lock・権限を見直してください。編集後はreviseで新attemptを作成してください。候補は現在のhashで再検証し、承認・保存/exportは後続工程です。"},productionEligible:false});
    return known?error.exitCode:inputError?2:4;
  }
};
