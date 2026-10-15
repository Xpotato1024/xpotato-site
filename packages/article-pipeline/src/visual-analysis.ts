import {articleMediaTargets,articleMediaTargetsSha256} from "@xpotato/content-contracts/article-media-targets";
import {candidateMediaPlanConfirmationSchema,localVisualAuditSchema,
 visualAuditRecordSchema,type LocalVisualAuditRequest,type ArticleVisualMedia,type ArticleVisualMasters} from "@xpotato/content-contracts";
import {fingerprint} from "./canonical.js";
import {containsHardDenyMaterial} from "./disclosure.js";
import {fail} from "./private-files.js";

export function validateCandidateMediaPlan(input:unknown,scope:"human_local"|"synthetic_fixture"){
 if(input===null||input===undefined)return {plan:null,confirmed:false,blockers:["public-origin-unconfirmed","object-key-profile-unconfirmed","storage-plan-unconfirmed"]};
 const record=candidateMediaPlanConfirmationSchema.parse(input);
 if(record.scope!==scope||record.profileSha256!==articleMediaTargetsSha256
  ||record.confirmation.confirmedProfileSha256!==record.profileSha256
  ||record.confirmation.principalId==="deterministic-visual-executor"
  ||Date.parse(record.confirmation.confirmedAt)>Date.now())fail("VISUAL_MEDIA_PLAN_BINDING_INVALID");
 return {plan:{profile:articleMediaTargets,confirmation:record},confirmed:true,blockers:[] as string[]};
}
export function makeVisualAuditRequest(plan:{scope:"human_local"|"synthetic_fixture";jobId:string;attemptId:string;inputSha256:string;
 planSha256:string;authorPrincipalId:string;producerPrincipalId:string},masters:ArticleVisualMasters):LocalVisualAuditRequest{
 const unsigned={schemaVersion:1 as const,protocol:"xpotato-private-visual-audit-request-v1" as const,
  scope:plan.scope,jobId:plan.jobId,attemptId:plan.attemptId,inputSha256:plan.inputSha256,planSha256:plan.planSha256,
  mastersSha256:masters.mastersSha256,authorPrincipalId:plan.authorPrincipalId,producerPrincipalId:plan.producerPrincipalId,
  targetAssets:masters.assets.map(item=>({assetId:item.assetId,sha256:item.ingest.canonicalMaster.sha256,path:item.ingest.canonicalMaster.privateRelativePath}))};
 return {...unsigned,requestSha256:fingerprint(unsigned)};
}
export function validateLocalVisualAudit(input:unknown,request:LocalVisualAuditRequest){
 const audit=localVisualAuditSchema.parse(input);
 if(containsHardDenyMaterial(Buffer.from(JSON.stringify(audit))))fail("VISUAL_AUDIT_SECRET_DENIED");
 if(audit.scope!==request.scope||audit.requestSha256!==request.requestSha256
  ||[request.authorPrincipalId,request.producerPrincipalId].includes(audit.reviewer.principalId)
  ||Date.parse(audit.reviewedAt)>Date.now())fail("VISUAL_AUDIT_BINDING_OR_INDEPENDENCE_INVALID");
 const ids=audit.records.map(record=>record.visualId);
 if(new Set(ids).size!==ids.length||fingerprint([...ids].sort())!==fingerprint(request.targetAssets.map(item=>item.assetId).sort()))fail("VISUAL_AUDIT_EXACT_SET_REQUIRED");
 if(new Set(audit.findings.map(item=>item.findingId)).size!==audit.findings.length||audit.findings.some(item=>!ids.includes(item.assetId)))fail("VISUAL_AUDIT_FINDING_SET_INVALID");
 let allPassed=true;
 for(const raw of audit.records){
  const record=visualAuditRecordSchema.parse(raw),{auditSha256,...unsigned}=record;
  const target=request.targetAssets.find(item=>item.assetId===record.visualId)!;
  if(fingerprint(unsigned)!==auditSha256||record.candidateArtifactSha256!==target.sha256)fail("VISUAL_AUDIT_TARGET_MISMATCH");
  const findings=audit.findings.filter(item=>item.assetId===record.visualId);
  if(fingerprint([...record.findings].sort())!==fingerprint(findings.map(item=>item.findingId).sort()))fail("VISUAL_AUDIT_FINDING_SET_INVALID");
  const passed=!findings.some(item=>item.severity==="P0"||item.severity==="P1")&&record.outcome==="approved"&&record.checks.factualAlignment!=="fail"
   &&record.checks.forbiddenImplications==="pass"&&record.checks.rights==="pass"
   &&record.checks.accessibility==="pass"&&record.checks.quality==="pass";
  if(record.outcome==="approved"&&!passed)fail("VISUAL_AUDIT_FALSE_PASS");
  allPassed&&=passed;
 }
 if((audit.conclusion==="pass")!==allPassed)fail("VISUAL_AUDIT_CONCLUSION_MISMATCH");
 return audit;
}
export function validateCandidateRegistry(media:ArticleVisualMedia,masters:ArticleVisualMasters,audit:ReturnType<typeof validateLocalVisualAudit>){
 if(media.mastersSha256!==masters.mastersSha256||media.auditSha256!==fingerprint(audit))fail("VISUAL_MEDIA_BINDING_INVALID");
 const registry=media.registry,ids=registry.assets.map(asset=>asset.assetId);
 if(fingerprint([...ids].sort())!==fingerprint(masters.assets.map(item=>item.assetId).sort()))fail("VISUAL_MEDIA_ASSET_SET_INVALID");
 for(const role of ["hero","social_card"] as const)if(registry.assets.filter(item=>item.role===role&&item.status==="active").length!==1)fail("VISUAL_REQUIRED_ROLE_MISSING");
 const objects=new Map(media.localObjects.map(item=>[item.sha256,item]));
 if(objects.size!==media.localObjects.length)fail("VISUAL_LOCAL_OBJECT_DUPLICATE");
 const required=new Set<string>();
 for(const asset of registry.assets){
  const master=masters.assets.find(item=>item.assetId===asset.assetId)!,record=audit.records.find(item=>item.visualId===asset.assetId)!;
  const variants=media.variants.filter(item=>item.assetId===asset.assetId);
  if(asset.status!=="active"||asset.role!==master.role||asset.origin!==master.origin||asset.rightsRef!==master.rightsRef
   ||asset.defaultAlt!==master.alt||asset.decorative!==master.decorative||asset.visualAuditRef!=="audit-"+record.auditSha256
   ||asset.canonicalSource?.sha256!==master.ingest.canonicalMaster.sha256||variants.length!==1)fail("VISUAL_REGISTRY_RECORD_INVALID");
  const variant=variants[0]!,{manifestSha256,...unsigned}=variant;
  if(fingerprint(unsigned)!==manifestSha256||variant.contentId!==registry.contentId||variant.masterSha256!==asset.canonicalSource.sha256
   ||variant.profileId!==asset.delivery.profileId||variant.profileSha256!==asset.delivery.profileSha256)fail("VISUAL_VARIANTS_BINDING_INVALID");
  const publicObjects=[asset.delivery.master,...asset.delivery.variants];
  for(const object of publicObjects){required.add(object.sha256);if(!objects.has(object.sha256))fail("VISUAL_LOCAL_BYTES_MISSING");}
  if(asset.role==="social_card"&&(asset.delivery.master.width!==1200||asset.delivery.master.height!==630
    ||asset.delivery.master.format!=="png"||asset.delivery.mode!=="fixed"||asset.delivery.variants.length||variant.status!=="not_required"))fail("VISUAL_SOCIAL_PROFILE_INVALID");
  if(asset.role!=="social_card"&&(asset.delivery.mode!=="responsive"||variant.status!=="generated"
   ||fingerprint(asset.delivery.variants.map(item=>item.sha256).sort())!==fingerprint(variant.variants.map(item=>item.sha256).sort())))fail("VISUAL_RESPONSIVE_SET_INVALID");
 }
 if(fingerprint([...required].sort())!==fingerprint([...objects.keys()].sort()))fail("VISUAL_PUBLIC_OBJECT_EXACT_SET_INVALID");
}
