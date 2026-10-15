import {articleMediaTargets,articleMediaTargetsSha256} from "@xpotato/content-contracts/article-media-targets";
import {type LocalVisualAuditRequest,type LocalVisualAudit,type ArticleVisualInput} from "@xpotato/content-contracts";
import {fingerprint} from "./canonical.js";
export const fixtureVisualInput=():ArticleVisualInput=>({schemaVersion:1,hero:{kind:"deterministic_cover"},inline:[],
 mediaPlan:{schemaVersion:1,scope:"synthetic_fixture",profileId:"article-media-targets-v1",profileSha256:articleMediaTargetsSha256,
  confirmation:{kind:"human",principalId:"fixture-plan-operator",confirmedProfileSha256:articleMediaTargetsSha256,
   confirmedAt:new Date().toISOString(),purpose:"candidate_planning_only"}}});
export function fixtureVisualAudit(request:LocalVisualAuditRequest,pass=true):LocalVisualAudit{
 if(request.scope!=="synthetic_fixture")throw Error("SYNTHETIC_VISUAL_FIXTURE_ONLY");
 const records=request.targetAssets.map(asset=>{
  const unsigned={schemaVersion:1 as const,visualId:asset.assetId,candidateArtifactSha256:asset.sha256,independentContext:true as const,
   checks:{factualAlignment:"not_applicable" as const,forbiddenImplications:"pass" as const,rights:"pass" as const,
    accessibility:"pass" as const,quality:pass?"pass" as const:"fail" as const},findings:[],
   outcome:pass?"approved" as const:"revision_required" as const};
  return {...unsigned,auditSha256:fingerprint(unsigned)};
 });
 return {schemaVersion:1,protocol:"xpotato-private-visual-audit-v1",scope:"synthetic_fixture",requestSha256:request.requestSha256,
  reviewer:{kind:"human",principalId:"fixture-visual-auditor"},
  publicationSafetyReviewed:true,independence:{separateReview:true,identitiesConfirmed:true,basis:"合成fixtureのprincipal/hash検査。実在する人の画像監査実績ではありません。"},
  findings:[],records,conclusion:pass?"pass":"revision_required",reviewedAt:new Date().toISOString()};
}
