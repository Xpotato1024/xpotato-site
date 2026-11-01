import {isoDateSchema} from "@xpotato/content-contracts";
import {fail} from "./private-files.js";
/** The application supplies its trusted SiteConfig timezone, never a Job field. */
export function candidatePublicationDateBlockers(pubDate:string,timeZone:string,now=new Date()){
 isoDateSchema.parse(pubDate);
 if(!Number.isFinite(now.getTime()))fail("CANDIDATE_CLOCK_INVALID",4);
 const calendar=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'});
 const parts=calendar.formatToParts(now),part=(kind:string)=>parts.find(item=>item.type===kind)!.value;
 const today=part('year')+'-'+part('month')+'-'+part('day');
 return pubDate>today?["future-publication-date"]:[];
}
