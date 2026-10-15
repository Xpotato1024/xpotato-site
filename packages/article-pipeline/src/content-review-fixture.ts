import {currentExternalAiPolicyBinding} from "./disclosure.js";
import {fingerprint,sha256} from "./canonical.js";
import type {LocalSourceBundle,LocalEvidenceBundle,ContentAuditRecord} from "@xpotato/content-contracts";
export const fixtureReviewBody="# 合成fixture記事\n\n合成仕様の入力上限は4文字です。 [@S0001]\n\nこの資料は人工の検証用で、実在製品の仕様ではありません。\n";
export function fixtureReviewInputs(body=fixtureReviewBody){
 const snapshot="合成fixture仕様\n入力上限は4文字です。\n実在製品を説明する資料ではありません。\n",snapshotSha256=sha256(snapshot);
 const disclosure={schemaVersion:1 as const,subject:{kind:"artifact" as const,id:"s0001",sha256:snapshotSha256},
  mode:"deny" as const,basis:"repository_policy" as const,...currentExternalAiPolicyBinding,notes:["合成fixture。外部送信なし。"]};
 const record={sourceId:"s0001",kind:"user_note" as const,locator:{kind:"artifact" as const,artifactSha256:snapshotSha256,
  publicDescription:"テスト専用の合成仕様。実在製品ではありません。"},title:"合成fixture仕様",trustClass:"user_supplied" as const,
  freshness:"stable" as const,publicSafe:true,citation:{eligible:true,title:"合成fixture仕様"},snapshotSha256,externalAiDisclosureRef:fingerprint(disclosure)};
 const sources:LocalSourceBundle={schemaVersion:1,scope:"synthetic_fixture",authorPrincipalId:"fixture-writer",sources:[{record,snapshot,disclosure}]};
 const statement="合成仕様の入力上限は4文字です。",start=body.indexOf(statement),extract="入力上限は4文字です。",excerptStart=snapshot.indexOf(extract);
 const evidence:LocalEvidenceBundle={schemaVersion:1,bodySha256:sha256(body),sourceBundleSha256:fingerprint(sources),
  evidence:[{evidenceId:"e0001",proposition:"合成資料に入力上限4文字と記載されている。",sourceRefs:[{sourceId:"s0001",sourceRecordSha256:fingerprint(record)}],
   interpretation:"explicit",confidence:"high",freshnessChecked:false,ambiguityIds:[]}],
  claims:[{claimId:"c0001",draftSpan:{start,end:start+statement.length,text:statement},text:statement,claimType:"source_fact",evidenceIds:["e0001"],confidence:"high"}],
  ambiguities:[],extracts:[{evidenceId:"e0001",sourceId:"s0001",start:excerptStart,end:excerptStart+extract.length,textSha256:sha256(extract)}],examples:[]};
 return {sources,evidence};
}
export const fixtureContentAudit=(requestSha256:string):ContentAuditRecord=>({
 schemaVersion:1,scope:"synthetic_fixture",requestSha256,reviewer:{kind:"human",principalId:"fixture-auditor"},
 independence:{separateReview:true,authorIdentityConfirmed:true,basis:"合成fixture上の独立principal検査。実在する人の監査実績ではありません。"},
 coveredClaimIds:["c0001"],materialCoverage:"complete",findings:[],conclusion:"pass",reviewedAt:new Date().toISOString(),
});
