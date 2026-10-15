import {
 localSourceBundleSchema,localEvidenceBundleSchema,contentAuditRecordSchema,
 compactSourceRefSchema,compactMaterialClaimBindingSchema,technicalExampleRecordSchema,
 technicalExampleVerificationResultSchema,type LocalSourceBundle,type LocalEvidenceBundle,
 type ContentAuditRecord,type ArticleClaimRecord,
} from "@xpotato/content-contracts";
import {compileArticleCitations,inspectExamples,walkReview} from "@xpotato/portable-content/review";
import {assessReviewExamples,type ExampleReviewBinding} from "./review-examples.js";
import {fingerprint,sha256} from "./canonical.js";
import {containsHardDenyMaterial,currentExternalAiPolicyBinding} from "./disclosure.js";
import {fail} from "./private-files.js";
const unique=(ids:readonly string[],code:string)=>{if(new Set(ids).size!==ids.length)fail(code);};
const safeUrl=(text:string)=>{
 const url=new URL(text);
 if(url.protocol!=="https:"||url.username||url.password||containsHardDenyMaterial(Buffer.from(text))
   ||[...url.searchParams.keys()].some(key=>/token|secret|signature|api.?key|credential/iu.test(key)))fail("SOURCE_URL_UNSAFE");
 return url.href;
};
export const validateLocalSources=(input:unknown):LocalSourceBundle=>{
 const bundle=localSourceBundleSchema.parse(input);unique(bundle.sources.map(entry=>entry.record.sourceId),"SOURCE_ID_DUPLICATE");
 if(containsHardDenyMaterial(Buffer.from(JSON.stringify(bundle))))fail("SOURCE_SECRET_DENIED");
 for(const {record,snapshot,disclosure} of bundle.sources){
  if(record.kind==="local_image")fail("SOURCE_BINARY_SNAPSHOT_NOT_SUPPORTED");
  const hash=sha256(snapshot);
  if(record.snapshotSha256!==hash)fail("SOURCE_SNAPSHOT_HASH_MISMATCH");
  if(record.externalAiDisclosureRef!==fingerprint(disclosure)||disclosure.subject.kind!=="artifact"
    ||disclosure.subject.id!==record.sourceId||disclosure.subject.sha256!==hash||disclosure.mode!=="deny"
    ||disclosure.policyId!==currentExternalAiPolicyBinding.policyId||disclosure.policySha256!==currentExternalAiPolicyBinding.policySha256)fail("SOURCE_DISCLOSURE_BINDING_INVALID");
  if(record.locator.kind==="artifact"&&record.locator.artifactSha256!==hash
    ||(record.locator.kind==="repository"||record.locator.kind==="github")&&record.locator.blobSha256&&record.locator.blobSha256!==hash)fail("SOURCE_LOCATOR_HASH_MISMATCH");
  if(record.freshness==="time_sensitive"&&!record.retrievedAt)fail("SOURCE_RETRIEVAL_TIME_MISSING");
  if(record.citation.title&&record.title&&record.citation.title!==record.title
    ||record.citation.publisher&&record.publisher&&record.citation.publisher!==record.publisher
    ||record.citation.retrievedAt&&record.retrievedAt&&record.citation.retrievedAt!==record.retrievedAt)fail("SOURCE_CITATION_METADATA_MISMATCH");
  let publicUrl:string|undefined;
  if(record.locator.kind==="web"){
   publicUrl=safeUrl(record.locator.canonicalUrl);if(!record.retrievedAt)fail("SOURCE_RETRIEVAL_TIME_MISSING");
  }else if(record.locator.kind==="github"){
   if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(record.locator.repository))fail("SOURCE_REPOSITORY_INVALID");
   publicUrl="https://github.com/"+record.locator.repository+(record.locator.path?"/blob/"+record.locator.commitSha+"/"+record.locator.path.split("/").map(encodeURIComponent).join("/"):"/commit/"+record.locator.commitSha);
   if(record.citation.repository&&record.citation.repository!==record.locator.repository
     ||record.citation.commitSha&&record.citation.commitSha!==record.locator.commitSha
     ||record.citation.path&&record.citation.path!==record.locator.path)fail("SOURCE_CITATION_METADATA_MISMATCH");
  }else if(record.locator.kind==="doi")publicUrl="https://doi.org/"+record.locator.doi;
  if(record.citation.canonicalUrl&&(!publicUrl||safeUrl(record.citation.canonicalUrl)!==safeUrl(publicUrl)))fail("CITATION_URL_NOT_FROM_SOURCE_IDENTITY");
  if(record.citation.eligible&&(!record.publicSafe||!record.citation.title
    ||(!record.citation.canonicalUrl&&!(record.locator.kind==="artifact"&&record.locator.publicDescription))))fail("SOURCE_CITATION_INCOMPLETE");
 }
 return bundle;
};
const compactSources=(bundle:LocalSourceBundle)=>bundle.sources.map(({record})=>{
 const common={sourceId:record.sourceId,sourceRecordSha256:fingerprint(record)};
 const locator=record.locator;
 if(!record.publicSafe)return compactSourceRefSchema.parse({...common,kind:"user_supplied",
   publicDescription:"非公開の手元資料（本文・locatorは非公開）",artifactSha256:record.snapshotSha256});
 if(locator.kind==="web")return compactSourceRefSchema.parse({...common,kind:"url",canonicalUrl:locator.canonicalUrl,
   retrievedAt:record.retrievedAt,snapshotSha256:record.snapshotSha256,...(record.publisher?{publisher:record.publisher}:{})});
 if(locator.kind==="github")return compactSourceRefSchema.parse({...common,...locator,blobSha256:record.snapshotSha256});
 if(locator.kind==="repository")return compactSourceRefSchema.parse({...common,...locator,kind:"repository_doc"});
 if(locator.kind==="doi")return compactSourceRefSchema.parse({...common,...locator});
 return compactSourceRefSchema.parse({...common,kind:"user_supplied",publicDescription:locator.publicDescription??"手元の資料",artifactSha256:locator.artifactSha256});
});
export const analyzeLocalEvidence=(body:string,sourceInput:unknown,evidenceInput:unknown,binding?:ExampleReviewBinding)=>{
 const sources=validateLocalSources(sourceInput),bundle=localEvidenceBundleSchema.parse(evidenceInput);
 if(containsHardDenyMaterial(Buffer.from(JSON.stringify(bundle))))fail("EVIDENCE_SECRET_DENIED");
 if(bundle.bodySha256!==sha256(body)||bundle.sourceBundleSha256!==fingerprint(sources))fail("EVIDENCE_TARGET_STALE",3);
 unique(bundle.evidence.map(e=>e.evidenceId),"EVIDENCE_ID_DUPLICATE");unique(bundle.claims.map(c=>c.claimId),"CLAIM_ID_DUPLICATE");
 unique(bundle.ambiguities.map(a=>a.ambiguityId),"AMBIGUITY_ID_DUPLICATE");
 const sourceMap=new Map(sources.sources.map(entry=>[entry.record.sourceId,entry])),evidenceMap=new Map(bundle.evidence.map(e=>[e.evidenceId,e]));
 const ambiguities=new Map(bundle.ambiguities.map(a=>[a.ambiguityId,a]));
 for(const ambiguity of bundle.ambiguities)if(ambiguity.resolution==="resolved"&&!evidenceMap.has(ambiguity.resolvedByEvidenceId!))fail("AMBIGUITY_EVIDENCE_UNKNOWN");
 for(const extract of bundle.extracts){
  const source=sourceMap.get(extract.sourceId),evidence=evidenceMap.get(extract.evidenceId);
  if(!source||!evidence||!evidence.sourceRefs.some(ref=>ref.sourceId===extract.sourceId)||extract.end<=extract.start
    ||extract.end>source.snapshot.length||sha256(source.snapshot.slice(extract.start,extract.end))!==extract.textSha256)fail("EVIDENCE_EXTRACT_INVALID");
 }
 for(const evidence of bundle.evidence){
  unique(evidence.sourceRefs.map(ref=>ref.sourceId),"EVIDENCE_SOURCE_DUPLICATE");
  if(evidence.interpretation==="unknown"||evidence.confidence==="not_available")fail("EVIDENCE_UNRESOLVED");
  for(const ref of evidence.sourceRefs){
   const source=sourceMap.get(ref.sourceId);
   if(!source||fingerprint(source.record)!==ref.sourceRecordSha256)fail("EVIDENCE_SOURCE_STALE");
   if(!bundle.extracts.some(extract=>extract.sourceId===ref.sourceId&&extract.evidenceId===evidence.evidenceId))fail("EVIDENCE_EXTRACT_MISSING");
   if(source.record.freshness==="time_sensitive"&&!evidence.freshnessChecked)fail("EVIDENCE_FRESHNESS_UNCHECKED");
  }
  if(evidence.ambiguityIds.some(id=>!ambiguities.has(id)||ambiguities.get(id)!.resolution==="unresolved"))fail("EVIDENCE_AMBIGUITY_UNRESOLVED");
 }
 const citation=compileArticleCitations(body,sources.sources.map(entry=>entry.record)),examples=inspectExamples(body);
 for(const claim of bundle.claims){
  if(claim.draftSpan.end>body.length||claim.draftSpan.text!==body.slice(claim.draftSpan.start,claim.draftSpan.end)
   ||claim.text!==claim.draftSpan.text||claim.evidenceIds.some(id=>!evidenceMap.has(id)))fail("CLAIM_SPAN_OR_EVIDENCE_INVALID");
 }
 const compactClaims=bundle.claims.filter(claim=>claim.claimType!=="transition").map(claim=>{
  const span=claim.draftSpan;
  if(span.end>body.length||span.text!==body.slice(span.start,span.end)||claim.text!==span.text)fail("CLAIM_SPAN_STALE");
  if(citation.patches.some(patch=>span.start<patch.end&&span.end>patch.start)
   ||examples.some(example=>span.start<example.sourceSpan.end&&span.end>example.sourceSpan.start))fail("CLAIM_SPAN_LITERAL_OR_CITATION");
  if(["source_fact","user_experience","inference","recommendation"].includes(claim.claimType)&&!claim.evidenceIds.length)fail("MATERIAL_CLAIM_EVIDENCE_MISSING");
  unique(claim.evidenceIds,"CLAIM_EVIDENCE_DUPLICATE");
  const support=claim.evidenceIds.map(id=>{
   const evidence=evidenceMap.get(id);if(!evidence)fail("CLAIM_EVIDENCE_UNKNOWN");
   const expected:Partial<Record<ArticleClaimRecord["claimType"],readonly string[]>>={
    source_fact:["explicit","direct_observation"],user_experience:["user_experience","direct_observation"],
    inference:["reasonable_inference"],recommendation:["recommendation_basis","explicit","direct_observation"]};
   if(expected[claim.claimType]&&!expected[claim.claimType]!.includes(evidence.interpretation))fail("CLAIM_INTERPRETATION_MISMATCH");
   return {evidenceId:id,propositionSummary:claim.text,propositionSha256:sha256(evidence.proposition),
    interpretation:evidence.interpretation,sourceIds:evidence.sourceRefs.map(ref=>ref.sourceId),freshnessChecked:evidence.freshnessChecked};
  });
  const blockIndex=(citation.tree.children??[]).findIndex(node=>span.start>=(node.position?.start.offset??-1)&&span.end<=(node.position?.end.offset??-1));
  if(blockIndex<0)fail("CLAIM_BLOCK_LOCATOR_INVALID");
  return compactMaterialClaimBindingSchema.parse({claimId:claim.claimId,statementSha256:sha256(claim.text),locator:{blockIndex},claimType:claim.claimType,evidence:support});
 });
 const assessment=assessReviewExamples(body,sources,bundle,binding);
 return {sources,bundle,compiled: citation.compiled,citationManifest:citation.manifest,citationCompilationSha256:citation.compilationSha256,
  sourceRefs:compactSources(sources),materialClaims:compactClaims,...assessment,
  bodySha256:sha256(body),sourceBundleSha256:fingerprint(sources),evidenceBundleSha256:fingerprint(bundle)};
};
export type EvidenceAnalysis=ReturnType<typeof analyzeLocalEvidence>;
export const makeContentAuditRequest=(binding:{jobId:string;attemptId:string;jobFingerprint:string;inputSha256:string},analysis:EvidenceAnalysis)=>{
 const request={schemaVersion:1,profile:"human-content-audit-v1",...binding,scope:analysis.sources.scope,
  authorPrincipalId:analysis.sources.authorPrincipalId,bodySha256:analysis.bodySha256,
  sourceBundleSha256:analysis.sourceBundleSha256,evidenceBundleSha256:analysis.evidenceBundleSha256,
  citationCompilationSha256:analysis.citationCompilationSha256,examplesSha256:fingerprint(analysis.examples),
  compactSupportSha256:fingerprint({sourceRefs:analysis.sourceRefs,materialClaims:analysis.materialClaims}),
  requiredClaimIds:analysis.materialClaims.map(claim=>claim.claimId)};
 return {...request,requestSha256:fingerprint(request)};
};
export const validateContentAudit=(input:unknown,request:ReturnType<typeof makeContentAuditRequest>):ContentAuditRecord=>{
 const audit=contentAuditRecordSchema.parse(input);
 if(containsHardDenyMaterial(Buffer.from(JSON.stringify(audit))))fail("CONTENT_AUDIT_SECRET_DENIED");
 if(audit.requestSha256!==request.requestSha256||audit.scope!==request.scope)fail("CONTENT_AUDIT_STALE",3);
 if(audit.reviewer.principalId===request.authorPrincipalId)fail("CONTENT_AUDIT_NOT_INDEPENDENT");
 unique(audit.coveredClaimIds,"AUDIT_CLAIM_DUPLICATE");
 if(JSON.stringify([...audit.coveredClaimIds].sort())!==JSON.stringify([...request.requiredClaimIds].sort()))fail("AUDIT_CLAIM_COVERAGE_MISMATCH");
 if(audit.findings.some(finding=>finding.claimIds.some(id=>!request.requiredClaimIds.includes(id))))fail("AUDIT_FINDING_CLAIM_UNKNOWN");
 if(audit.conclusion==="pass"&&(audit.materialCoverage!=="complete"||audit.findings.some(f=>f.severity==="P0"||f.severity==="P1")))fail("CONTENT_AUDIT_BLOCKING_FINDINGS");
 return audit;
};
