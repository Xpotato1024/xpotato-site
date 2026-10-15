import {join} from "node:path";
import {articleCandidateArtifactSchema,candidatePreviewReceiptSchema,type ArticleCandidateArtifact} from "@xpotato/content-contracts";
import {candidateMaterials,type CandidateSnapshot} from "./candidate-material.js";
import {candidateDirectory,candidateReviewBundle,renderCandidateReview} from "./candidate-review.js";
import {localFileManifest,candidateAstroConfigurationSha256} from "./candidate-astro.js";
import {inspectCandidateHtml} from "./candidate-static.js";
import {safeRead,fail} from "./private-files.js";
import {fingerprint,sha256} from "./canonical.js";
const json=async(path:string)=>JSON.parse(await safeRead(path));
export async function inspectCandidateArtifact(s:CandidateSnapshot,target:string):Promise<ArticleCandidateArtifact>{
 const folder=candidateDirectory(s.directory,target),artifact=articleCandidateArtifactSchema.parse(await json(join(folder,"artifact.json")));
 const {artifactSha256,...unsigned}=artifact;
 if(fingerprint(unsigned)!==artifactSha256||artifact.targetSha256!==target
  ||artifact.jobId!==s.c.binding.jobId||artifact.attemptId!==s.c.binding.attemptId||artifact.inputSha256!==s.c.binding.inputSha256
  ||artifact.scope!==s.plan.scope)fail("CANDIDATE_ARTIFACT_BINDING_INVALID",3);
 const m=await candidateMaterials(s,artifact.reference);
 if(target!==m.candidate.candidateSha256||fingerprint(artifact.candidate)!==fingerprint(m.candidate)
  ||artifact.approvalEligible!==m.eligible||artifact.candidateSha256!==(m.eligible?target:null)
  ||artifact.candidateInputSha256!==m.candidateInputSha256||artifact.mediaSha256!==s.media.mediaSha256
  ||artifact.visualPlanSha256!==s.plan.planSha256||artifact.reviewHeadSha256!==fingerprint(s.c.journal.head)
  ||fingerprint(artifact.blockers)!==fingerprint(m.blockers))fail("CANDIDATE_INPUTS_STALE",3);
 const files=(await localFileManifest(folder)).filter(item=>item.path!=="artifact.json");
 if(fingerprint(files)!==fingerprint(artifact.files))fail("CANDIDATE_OUTPUT_FILE_SET_CHANGED",3);
 const required=["candidate.mdx","registry.json","rights.json","media-plan.json","provenance-proposal.json","input.json","index.html",".private-draft-preview",
  ...(m.updateDiff?["update-diff.json"]:[])];
 const rootFiles=files.filter(item=>!item.path.startsWith("output/")).map(item=>item.path).sort();
 if(fingerprint(rootFiles)!==fingerprint(required.sort()))fail("CANDIDATE_ARTIFACT_REQUIRED_SET_INVALID",3);
 const urls:Record<string,string>={};
 for(const object of s.media.registry.assets.flatMap(asset=>[asset.delivery.master,...asset.delivery.variants])){
  urls[object.sha256]="/__candidate_media/"+object.sha256+"."+(object.format==="jpeg"?"jpg":object.format);
 }
 const output=files.filter(item=>item.path.startsWith("output/")).map(item=>({...item,path:item.path.slice(7)}));
 const objectFiles=output.filter(item=>item.path.startsWith("__candidate_media/"));
 if(fingerprint(objectFiles.map(item=>({sha256:item.sha256,sizeBytes:item.sizeBytes})).sort((a,b)=>a.sha256.localeCompare(b.sha256)))!==fingerprint(s.media.localObjects.map(({sha256})=>({sha256,sizeBytes:s.media.registry.assets.flatMap(asset=>[asset.delivery.master,...asset.delivery.variants]).find(item=>item.sha256===sha256)!.sizeBytes})).sort((a,b)=>a.sha256.localeCompare(b.sha256))))fail("CANDIDATE_MEDIA_FILE_SET_MISMATCH",3);
 if(await safeRead(join(folder,".private-draft-preview"))!=="xpotato-private-draft-preview-v1\n"||await safeRead(join(folder,"output/.private-draft-preview"))!=="xpotato-private-draft-preview-v1\ncandidate;productionEligible=false\n")fail("CANDIDATE_PRIVATE_MARKER_MISSING",3);
 const publicFiles=await localFileManifest(join(s.repositoryRoot,"apps/site/public")),knownPublic=new Map(publicFiles.map(item=>[item.path,item]));
 for(const item of output){
  const publicSource=knownPublic.get(item.path);
  if(publicSource){if(publicSource.sha256!==item.sha256)fail("CANDIDATE_SHARED_ASSET_CHANGED",3);continue;}
  if(item.path===m.route.slice(1)+"index.html"||item.path===".private-draft-preview")continue;
  if(/^_astro\/[a-zA-Z0-9_.-]+\.(?:css|js|woff2|svg)$/u.test(item.path))continue;
  const sha=/^__candidate_media\/([a-f0-9]{64})\.(?:jpg|png|webp|avif)$/u.exec(item.path)?.[1];
  if(!sha||urls[sha]!=="/"+item.path||sha!==item.sha256)fail("CANDIDATE_UNEXPECTED_OUTPUT_FILE",3);
 }
 if(await safeRead(join(folder,"candidate.mdx"))!==m.mdx
  ||fingerprint(await json(join(folder,"registry.json")))!==fingerprint(s.media.registry)
  ||fingerprint(await json(join(folder,"rights.json")))!==fingerprint(s.plan.rights)
  ||fingerprint(await json(join(folder,"media-plan.json")))!==fingerprint(m.storagePlan)
  ||fingerprint(await json(join(folder,"provenance-proposal.json")))!==fingerprint(m.provenanceProposal)
  ||fingerprint(await json(join(folder,"input.json")))!==fingerprint(m.projection)
  ||m.updateDiff&&fingerprint(await json(join(folder,"update-diff.json")))!==fingerprint(m.updateDiff))fail("CANDIDATE_PROPOSAL_SEMANTIC_MISMATCH",3);
 const review=candidateReviewBundle(m,s);
 if(fingerprint(review)!==fingerprint(artifact.review)||await safeRead(join(folder,"index.html"))!==renderCandidateReview(m,s,urls,review))fail("CANDIDATE_REVIEW_BUNDLE_MISMATCH",3);
 const preview=candidatePreviewReceiptSchema.parse(artifact.preview),{previewSha256,...base}=preview;
 if(fingerprint(base)!==previewSha256||preview.candidateInputSha256!==m.candidateInputSha256
  ||preview.contentId!==m.frontmatter.id||preview.route!==m.route||preview.outputTreeSha256!==fingerprint(output)
  ||preview.plannedSeoSha256!==fingerprint(m.plannedSeo)
  ||preview.buildConfigSha256!==candidateAstroConfigurationSha256(s.repositoryRoot,m.plannedSeo.canonical)
  ||fingerprint(preview.localMediaSha256s)!==fingerprint(s.media.localObjects.map(item=>item.sha256).sort()))fail("CANDIDATE_PREVIEW_RECEIPT_MISMATCH",3);
 const html=await safeRead(join(folder,"output",m.route.slice(1),"index.html"));
 if(sha256(html)!==preview.htmlSha256)fail("CANDIDATE_HTML_HASH_MISMATCH",3);
 await inspectCandidateHtml(html,m,s.media,{localMediaUrls:urls});
 return artifact;
}
export async function verifyCandidateOutputs(input:CandidateSnapshot&{head:{outputs:Record<string,string>};folder:string}){
 const candidate=await json(join(input.folder,"artifacts",input.head.outputs.candidate!+".json"));
 const artifact=await inspectCandidateArtifact(input,candidate.candidateSha256);
 if(artifact.reference||!artifact.approvalEligible||fingerprint(artifact.candidate)!==input.head.outputs.candidate
  ||fingerprint(artifact.preview)!==input.head.outputs.preview||fingerprint(artifact.review)!==input.head.outputs.review)fail("CANDIDATE_STAGE_OUTPUTS_INVALID",3);
}
