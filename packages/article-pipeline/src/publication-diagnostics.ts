import {join} from "node:path";
import type {DraftRepository} from "./draft-job.js";
import {readDraftStore} from "./draft-job.js";
import {safeRead} from "./private-files.js";
import {publicationHeadSchema} from "./publication-contracts.js";
import {publicationFolder,publicationCandidate,readPublicationHead} from "./publication-approval.js";
import {validateMockReceipts,verifyMockStoredObjects} from "./publication-persistence.js";
import {DirectoryMockPublicationPort} from "./publication-mock-port.js";
export async function publicationDiagnostics(directory:string,repo:DraftRepository,root:string){
 const store=await readDraftStore(directory),results=[];
 for(const mode of ["human","mock"] as const){
  let historical:string|null=null;
  try{
   const raw=publicationHeadSchema.parse(JSON.parse(await safeRead(join(publicationFolder(directory,store.activeAttemptId,mode),"head.json"))));
   historical=raw.state;
   const c=await publicationCandidate(directory,repo,root,raw.candidateSha256,mode),head=await readPublicationHead(c);
   if(mode==="mock"){
    await validateMockReceipts(c,head);
    await verifyMockStoredObjects(c,head,new DirectoryMockPublicationPort(join(directory,"..",".mock-media-provider")));
   }
   results.push({mode,currentState:mode==="mock"?"MOCK_"+head.state:head.state,historicalState:historical,stale:false,
    candidateSha256:mode==="human"?head.candidateSha256:null,simulationTargetSha256:mode==="mock"?head.candidateSha256:null,
    isHumanApproval:mode==="human",productionEligible:false});
  }catch(error){
   if((error as NodeJS.ErrnoException).code==="ENOENT"&&historical===null)continue;
   results.push({mode,currentState:null,historicalState:historical,stale:true,candidateSha256:null,
    isHumanApproval:false,productionEligible:false});
  }
 }
 return results;
}
