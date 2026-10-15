import {isoDateSchema} from "@xpotato/content-contracts";
import {fail} from "./private-files.js";
/** UTC publication readiness; callers cannot supply a Job-controlled clock. */
export function candidatePublicationDateBlockers(pubDate:string,now=new Date()){
 isoDateSchema.parse(pubDate);
 if(!Number.isFinite(now.getTime()))fail("CANDIDATE_CLOCK_INVALID",4);
 return pubDate>now.toISOString().slice(0,10)?["future-publication-date"]:[];
}
