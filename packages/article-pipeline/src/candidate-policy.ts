import {isoDateSchema} from "@xpotato/content-contracts";
import {fail} from "./private-files.js";
import {siteConfig} from '../../../apps/site/src/lib/site-config.js';
const calendar=new Intl.DateTimeFormat('en-CA',{timeZone:siteConfig.site.timezone,year:'numeric',month:'2-digit',day:'2-digit'});
/** Site calendar readiness; callers cannot supply a Job-controlled timezone. */
export function candidatePublicationDateBlockers(pubDate:string,now=new Date()){
 isoDateSchema.parse(pubDate);
 if(!Number.isFinite(now.getTime()))fail("CANDIDATE_CLOCK_INVALID",4);
 const parts=calendar.formatToParts(now),part=(kind:string)=>parts.find(item=>item.type===kind)!.value;
 const today=part('year')+'-'+part('month')+'-'+part('day');
 return pubDate>today?["future-publication-date"]:[];
}
