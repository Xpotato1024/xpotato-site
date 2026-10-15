import {mkdir,rename,readFile} from "node:fs/promises";
import {join,dirname} from "node:path";
import {randomUUID} from "node:crypto";
import {articleCandidateArtifactSchema,candidatePreviewReceiptSchema,humanReviewBundleSchema,type ArticleCandidateArtifact} from "@xpotato/content-contracts";
import {renderRegistryPicture} from "@xpotato/portable-content/media-picture";
import {canonicalJson,fingerprint,sha256} from "./canonical.js";
import {locked,noLinks,immutable,immutableBytes,safeReadBytes,fail} from "./private-files.js";
import {visualContext,commitVisual} from "./visual-review.js";
import {candidateMaterials,type CandidateSnapshot} from "./candidate-material.js";
import {buildPrivateCandidateAstro,localFileManifest,removeOwnedCandidateTemp} from "./candidate-astro.js";
import {inspectCandidateHtml} from "./candidate-static.js";
import type {DraftRepository} from "./draft-job.js";
const escape=(s:string)=>s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
export const candidateDirectory=(directory:string,target:string)=>{
 if(!/^[a-f0-9]{64}$/u.test(target))fail("CANDIDATE_TARGET_SHA_REQUIRED");return join(directory,"candidates",target);
};
export function candidateReviewBundle(m:Awaited<ReturnType<typeof candidateMaterials>>,s:CandidateSnapshot){
 return humanReviewBundleSchema.parse({candidateSha256:m.candidate.candidateSha256,contentId:m.frontmatter.id,
  renderedPreviewRefs:["output"+m.route+"index.html"],title:m.frontmatter.title,description:m.frontmatter.description,route:m.route,
  taxonomySummary:[m.frontmatter.category,...m.frontmatter.tags],
  materialClaims:m.analysis.materialClaims.map((claim:{claimId:string})=>({claimId:claim.claimId,summary:m.analysis.bundle.claims.find((item:{claimId:string})=>item.claimId===claim.claimId)!.text})),
  citationSummary:canonicalJson(m.analysis.citationManifest),technicalExampleSummary:canonicalJson(m.analysis.examples.map((item:{record:{exampleId:string};result:{class:string;status:string};label:string})=>({exampleId:item.record.exampleId,...item.result,label:item.label}))),
  unresolvedLimitations:[...m.blockers,"取得済みローカル根拠の照合です。外部URLや実ストレージへ接続していません。","アクセシビリティの実端末・支援技術確認と実測性能は本人reviewの対象です。"],
  contentAuditSummary:canonicalJson({scope:m.contentAudit.scope,conclusion:m.contentAudit.conclusion,findings:m.contentAudit.findings}),
  visualSummary:canonicalJson({scope:s.audit.scope,conclusion:s.audit.conclusion,findings:s.audit.findings,assets:s.media.registry.assets.map(asset=>({assetId:asset.assetId,origin:asset.origin,decorative:asset.decorative,rightsRef:asset.rightsRef}))}),
  mediaDeliverySummary:canonicalJson({registrySha256:fingerprint(s.media.registry),mediaSha256:s.media.mediaSha256,objects:s.media.localObjects.length}),
  plannedPrivateCanonicalSources:m.storagePlan.sourceObjects.map(item=>item.storageClass+":"+item.objectKey),
  plannedPublicMedia:[...new Set(m.storagePlan.publicObjects.map(item=>item.url))],
  ...(m.updateDiff?{updateDiffRef:"update-diff.json"}:{}),isApproval:false});
}
export function renderCandidateReview(m:Awaited<ReturnType<typeof candidateMaterials>>,s:CandidateSnapshot,urls:Record<string,string>,bundle:ReturnType<typeof candidateReviewBundle>){
 const image=(assetId:string)=>renderRegistryPicture({registry:s.media.registry,assetId,urlFor:object=>urls[object.sha256]!,priority:false});
 const images=s.media.registry.assets.map(asset=>'<section><h3>'+escape(asset.role+" / "+asset.assetId)+'</h3>'+image(asset.assetId)
  +'<p>'+escape(asset.decorative?"装飾画像・技術的観測の証拠ではありません。":asset.defaultAlt??"")+'</p><p>rights: '+escape(asset.rightsRef)+'</p></section>').join("");
 const status=m.reference?"参考preview（承認不可）":"本人review用候補（承認前）";
 const style=':root{font:17px/1.8 system-ui,sans-serif;color:#262330;background:#f6f3ec}body{max-width:1050px;margin:auto;padding:24px}header,section{background:#fff;padding:24px;border:1px solid #d8d4dc;border-radius:12px;margin:20px 0}h1{line-height:1.4}h2{margin-top:2em}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:.8rem;background:#f3f0f6;padding:16px}img{display:block;max-width:100%;height:auto}a{color:#5b4177}code{overflow-wrap:anywhere}@media(max-width:600px){body{padding:10px}header,section{padding:16px}}';
 return '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="xpotato-private-draft-preview-v1" content="candidate-review;productionEligible=false"><title>非公開の記事review</title><style>'+style+'</style></head><body><header><p>'+escape(status)+(s.plan.scope==="synthetic_fixture"?" / 合成fixture":"")+'</p><h1>'+escape(bundle.title)+'</h1><p>'+escape(bundle.description)+'</p><p><a href="'+escape(m.route)+'">本文・画像・脚注を候補レイアウトで表示</a></p><p>対象hash: <code>'+m.candidate.candidateSha256+'</code></p><p>承認前・保存前・公開前の非公開資料です。</p></header>'
  +'<main><h2>画像の実物</h2>'+images+'<section><h2>内容・SEO・根拠・監査</h2><pre>'+escape(canonicalJson({route:m.route,pubDate:m.frontmatter.pubDate,updatedDate:m.frontmatter.updatedDate??null,
   taxonomy:bundle.taxonomySummary,plannedSeo:m.plannedSeo,claims:bundle.materialClaims,citations:m.analysis.sourceRefs,examples:bundle.technicalExampleSummary,
   contentAudit:bundle.contentAuditSummary,visualAudit:bundle.visualSummary,limitations:bundle.unresolvedLimitations}))+'</pre></section>'
  +'<section><h2>権利と保存計画</h2><p>public object は保存後、記事の deploy 前にも URL から閲覧可能になります。ここでは未保存です。</p><pre>'+escape(canonicalJson({rights:s.plan.rights,storagePlan:m.storagePlan}))+'</pre></section>'
  +(m.updateDiff?'<section><h2>更新差分・前後の全文</h2><details><summary>変更前</summary><pre>'+escape(m.updateDiff.before)+'</pre></details><details><summary>変更後</summary><pre>'+escape(m.updateDiff.after)+'</pre></details></section>':"")+'</main></body></html>\n';
}
export const buildArticleCandidate=(directory:string,repo:DraftRepository,repositoryRoot:string,reference=false)=>locked(directory,async()=>{
 const v=await visualContext(directory,repo,repositoryRoot);
 if(!v.plan||!v.masters||!v.audit||!v.media||v.head.rejection||!["MEDIA_READY","HUMAN_REVIEW_READY"].includes(v.state))fail("CANDIDATE_MEDIA_PREREQUISITES_MISSING",3);
 const snapshot={directory,repositoryRoot,c:v.c,plan:v.plan,masters:v.masters,audit:v.audit,media:v.media},m=await candidateMaterials(snapshot,reference);
 const target=m.candidate.candidateSha256,destination=candidateDirectory(directory,target);
 const {inspectCandidateArtifact}=await import("./candidate-integrity.js");
 let exists=false;
 try{await readFile(join(destination,"artifact.json"));exists=true;}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;}
 if(exists){
  const prior=await inspectCandidateArtifact(snapshot,target);
  if(prior.reference!==reference)fail("CANDIDATE_MODE_MISMATCH",3);
  if(!reference&&v.state==="MEDIA_READY")await commitVisual(v,{outputs:{candidate:prior.candidate,preview:prior.preview,review:prior.review},stages:["candidate","preview","review"]});
  return {...v.c.binding,state:reference?v.state:"HUMAN_REVIEW_READY",targetSha256:target,candidateSha256:prior.candidateSha256,approvalEligible:prior.approvalEligible,productionEligible:false,reference,reused:true,output:destination};
 }
 if(v.state!=="MEDIA_READY")fail("CANDIDATE_CHANGED_REVISE_REQUIRED",3);
 const built=await buildPrivateCandidateAstro({repositoryRoot,contentId:m.frontmatter.id,route:m.route,mdx:m.mdx,candidateInputSha256:m.candidateInputSha256,
  scope:v.plan.scope,reference,planConfirmed:!m.storagePlan.confirmed?false:true,plannedSeo:m.plannedSeo,mediaFolder:v.folder,media:v.media});
 await inspectCandidateHtml(built.html,m,v.media,built.overlay);
 const previewBase={schemaVersion:1 as const,protocol:"xpotato-private-candidate-preview-v1" as const,candidateInputSha256:m.candidateInputSha256,contentId:m.frontmatter.id,
  route:m.route,outputTreeSha256:built.outputTreeSha256,htmlSha256:sha256(built.html),buildConfigSha256:built.buildConfigSha256,
  localMediaSha256s:v.media.localObjects.map(item=>item.sha256).sort(),plannedSeoSha256:fingerprint(m.plannedSeo),
  validation:{schema:"pass",citations:"pass",examples:"pass",media:"pass",build:"pass",seo:"pass",hydration:"pass",accessibility:"manual_required",performance:"not_run"}};
 const preview=candidatePreviewReceiptSchema.parse({...previewBase,previewSha256:fingerprint(previewBase)}),review=candidateReviewBundle(m,snapshot);
 await noLinks(join(directory,"candidates"));await mkdir(join(directory,"candidates"),{recursive:true,mode:0o700});
 const staging=join(directory,"candidates",".staging-"+randomUUID());await mkdir(staging,{mode:0o700});
 for(const file of built.files){
  await mkdir(dirname(join(staging,"output",file.path)),{recursive:true,mode:0o700});
  await immutableBytes(join(staging,"output",file.path),await safeReadBytes(join(built.output,file.path)));
 }
 const json=(name:string,value:unknown)=>immutable(join(staging,name),canonicalJson(value)+"\n");
 await immutable(join(staging,"candidate.mdx"),m.mdx);await json("registry.json",v.media.registry);await json("rights.json",v.plan.rights);
 await json("media-plan.json",m.storagePlan);await json("provenance-proposal.json",m.provenanceProposal);await json("input.json",m.projection);
 if(m.updateDiff)await json("update-diff.json",m.updateDiff);
 await immutable(join(staging,"index.html"),renderCandidateReview(m,snapshot,built.overlay.localMediaUrls,review));
 await immutable(join(staging,".private-draft-preview"),"xpotato-private-draft-preview-v1\n");
 const files=await localFileManifest(staging);
 const unsigned={schemaVersion:1,protocol:"xpotato-private-complete-candidate-v1",scope:v.plan.scope,reference,
  jobId:v.c.binding.jobId,attemptId:v.c.binding.attemptId,inputSha256:v.c.binding.inputSha256,
  targetSha256:target,candidateSha256:m.eligible?target:null,approvalEligible:m.eligible,productionEligible:false,isApproval:false,
  candidate:m.candidate,preview,review,candidateInputSha256:m.candidateInputSha256,mediaSha256:v.media.mediaSha256,
  visualPlanSha256:v.plan.planSha256,reviewHeadSha256:fingerprint(v.c.journal.head),files,blockers:m.blockers};
 const artifact=articleCandidateArtifactSchema.parse({...unsigned,artifactSha256:fingerprint(unsigned)});
 await json("artifact.json",artifact);
 await v.fresh();
 const checked=await visualContext(directory,repo,repositoryRoot,false);
 if(!checked.plan||!checked.masters||!checked.audit||!checked.media||fingerprint(checked.head)!==fingerprint(v.head))fail("CANDIDATE_BUILD_INPUTS_CHANGED",3);
 const current=await candidateMaterials({...snapshot,c:checked.c,plan:checked.plan,masters:checked.masters,audit:checked.audit,media:checked.media},reference);
 if(current.candidateInputSha256!==m.candidateInputSha256)fail("CANDIDATE_BUILD_INPUTS_CHANGED",3);
 await rename(staging,destination);
 await inspectCandidateArtifact(snapshot,target);
 if(!reference)await commitVisual(v,{outputs:{candidate:m.candidate,preview,review},stages:["candidate","preview","review"]});
 await removeOwnedCandidateTemp(built.root,repositoryRoot);
 return {...v.c.binding,state:reference?v.state:"HUMAN_REVIEW_READY",targetSha256:target,candidateSha256:artifact.candidateSha256,
  approvalEligible:artifact.approvalEligible,productionEligible:false,reference,output:destination,blockers:artifact.blockers};
});
