import {assertArticleRoute,applicationRedirectRecordSchema} from "@xpotato/content-contracts";
import {fail} from "./private-files.js";
export function candidateRoutePlan(input:{contentId:string;before:string|null;after:string;allow:boolean;
 occupied:readonly string[];redirects:readonly {sourcePath:string;targetPath:string}[]}){
 try{assertArticleRoute(input.after,input.contentId);}catch{fail("CANDIDATE_ROUTE_COLLISION",3);}
 const retained=input.redirects.filter(record=>(record as {contentId?:string}).contentId===input.contentId).map(record=>applicationRedirectRecordSchema.parse(record));
 if(input.before===null||input.before===input.after)return retained;
 if(!input.allow)fail("CANDIDATE_ROUTE_CHANGE_NOT_ADMITTED",3);
 if(["category","categories","tag","tags","page","feed","rss","search","index"].includes(input.after.split("/")[2]??""))fail("CANDIDATE_ROUTE_COLLISION",3);
 if(input.occupied.includes(input.after))
  fail("CANDIDATE_ROUTE_COLLISION",3);
 if(input.redirects.some(record=>record.sourcePath===input.before))fail("CANDIDATE_REDIRECT_SOURCE_CONFLICT",3);
 const graph=new Map(input.redirects.map(record=>[record.sourcePath,record.targetPath]));
 if(graph.size!==input.redirects.length)fail("CANDIDATE_REDIRECT_DUPLICATE",3);
 graph.set(input.before,input.after);
 for(const start of graph.keys()){
  const seen=new Set<string>();let path:string|undefined=start;
  while(path&&graph.has(path)){if(seen.has(path))fail("CANDIDATE_REDIRECT_CYCLE",3);seen.add(path);path=graph.get(path);}
 }
 return [...retained,applicationRedirectRecordSchema.parse({id:"article-route-"+input.contentId+"-"+input.before.split("/")[2],sourcePath:input.before,targetPath:input.after,
  contentId:input.contentId,status:301,statusLifecycle:"active",reason:"content_route_change"})];
}
