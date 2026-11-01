import {articleVisualInputSchema,articleVisualPlanSchema,visualPlanSetSchema,type ArticleVisualInput,type ArticleVisualPlan} from "@xpotato/content-contracts";
import {articleMediaReferences} from "@xpotato/portable-content/media";
import {fingerprint,sha256} from "./canonical.js";
import {containsHardDenyMaterial} from "./disclosure.js";
import {fail} from "./private-files.js";
import {validateCandidateMediaPlan} from "./visual-analysis.js";
import {splitDraft} from "./draft-job.js";
import {blogSocialCardAlt} from '@xpotato/media-ingest';
import type {contentReviewContext} from "./content-review.js";
import type {LocalSourceBundle} from "@xpotato/content-contracts";
import {loadReviewPayload} from './review-journal.js';
type Context=Awaited<ReturnType<typeof contentReviewContext>>;
export const defaultVisualInput:ArticleVisualInput={schemaVersion:1,hero:{kind:"deterministic_cover"},inline:[],mediaPlan:null};
export async function assembleVisualPlan(c:Context,sources:LocalSourceBundle,input:unknown,generatorBindingSha256:string,confirmedAt:string):Promise<ArticleVisualPlan>{
 const visualInput=articleVisualInputSchema.parse(input);
 if(containsHardDenyMaterial(Buffer.from(JSON.stringify(visualInput))))fail("VISUAL_SECRET_INPUT_DENIED");
 validateCandidateMediaPlan(visualInput.mediaPlan,sources.scope);
 const sourceAssets=[...(visualInput.hero.kind==="local_raster"?[visualInput.hero]:[]),...visualInput.inline];
 const evidence=await loadReviewPayload(c.journal,'evidence') as {evidence:{evidenceId:string;proposition:string}[];claims:{claimId:string;text:string}[]};
 for(const item of sourceAssets){
  if(item.origin==='ai_generated'&&(sources.scope!=='existing_ai'||item!==visualInput.hero||!item.decorative
    ||!('receivedLineage' in item&&item.receivedLineage)||item.rights.basis!=='ai_generated_authorized'))fail('VISUAL_RECEIVED_AI_HERO_BINDING_REQUIRED');
  if(item.origin!=='ai_generated'&&'receivedLineage' in item&&item.receivedLineage)fail('VISUAL_UNEXPECTED_AI_LINEAGE');
  const facts:string[]=[];
  for(const ref of item.sourceRefs??[]){
   if(ref.kind==='evidence'){const e=evidence.evidence.find(e=>e.evidenceId===ref.evidenceId);if(!e||fingerprint(e)!==ref.evidenceRecordSha256)fail('VISUAL_EVIDENCE_BINDING_INVALID');facts.push(e.proposition);}
   else if(ref.kind==='claim'){const claim=evidence.claims.find(e=>e.claimId===ref.claimId);if(!claim||fingerprint(claim)!==ref.claimRecordSha256)fail('VISUAL_CLAIM_BINDING_INVALID');facts.push(claim.text);}
   else if(!sources.sources.some(s=>s.record.sourceId===ref.sourceId&&s.record.snapshotSha256===ref.artifactSha256))fail('VISUAL_SOURCE_BINDING_INVALID');
  }
  if(!item.decorative&&(item.origin!=='diagram'||!facts.length||!item.requiredFacts?.length
   ||item.requiredFacts.some(f=>!facts.includes(f))))fail('VISUAL_FACTUAL_SUPPORT_REQUIRED');
 }
 if(sourceAssets.some(item=>!item.rights.publicationAuthorized||item.rights.basis==="unknown"||item.rights.confirmedBy!=="user"))fail("VISUAL_SOURCE_RIGHTS_REQUIRED");
 const heroId=visualInput.hero.kind==="local_raster"?visualInput.hero.assetId:"article-hero";
 const ids=[heroId,"article-social",...visualInput.inline.map(item=>item.assetId)];
 if(new Set(ids).size!==ids.length)fail("VISUAL_ASSET_ID_DUPLICATE");
 const inlineRefs=articleMediaReferences(c.body).filter(id=>id!==heroId);
 if(inlineRefs.includes("article-social")||fingerprint([...inlineRefs].sort())!==fingerprint(visualInput.inline.map(item=>item.assetId).sort()))fail("VISUAL_INLINE_REFERENCE_EXACT_SET_REQUIRED");
 const coverRights={schemaVersion:1 as const,rightsId:"generated-cover-rights",basis:"self_created" as const,publicationAuthorized:true,
  ownerOrSource:"Xpotato site-owned logo and authored vector composition; bundled SIL OFL fonts",licenseId:"OFL-1.1 (fonts)",
  confirmedBy:"system_policy" as const,confirmedAt,notes:["既存サイト内の表紙用途。外部サービス不使用。技術的観測の証拠ではありません。"]};
 const rights=[coverRights,...sourceAssets.map(item=>item.rights)];
 if(new Set(rights.map(item=>item.rightsId)).size!==rights.length)fail("VISUAL_RIGHTS_ID_DUPLICATE");
 const entries=[{assetId:heroId,role:"hero" as const,source:visualInput.hero.kind==="local_raster"?visualInput.hero:null},
  {assetId:"article-social",role:"social_card" as const,source:null},
  ...visualInput.inline.map(source=>({assetId:source.assetId,role:"inline" as const,source}))];
 const frontmatter=splitDraft(c.status.input).frontmatter;
 const unsignedPlan={schemaVersion:1 as const,contentId:c.store.spec.target.contentId,articleSha256:sha256(c.body),
  plans:entries.map(item=>({visualId:item.assetId,role:item.role,origin:item.source?.origin==='ai_generated'?'ai_generated':item.source?.origin==='diagram'?'diagram':item.source?"source_media":"deterministic_cover",
   purpose:item.role==="social_card"?"記事タイトルとサイト識別のsocial card":item.source&&!item.source.decorative?'固定根拠に対応する説明図':"記事に付随する概念的な表紙",
   sourceRefs:item.source?.sourceRefs??[],requiredFacts:item.source?.requiredFacts??[],forbiddenImplications:["技術的な実測・画面・benchmarkの証拠として扱わない"],
   altIntent:item.source?.alt??(item.role==="social_card"?blogSocialCardAlt(frontmatter.title):"記事の装飾表紙"),decorative:item.source?.decorative??item.role!=="social_card",rightsRequired:true}))};
 const visualPlan=visualPlanSetSchema.parse({...unsignedPlan,planSetSha256:fingerprint(unsignedPlan)});
 const payload={schemaVersion:1 as const,protocol:"xpotato-private-visual-plan-v1" as const,
  jobId:c.binding.jobId,attemptId:c.binding.attemptId,inputSha256:c.binding.inputSha256,reviewHeadSha256:fingerprint(c.journal.head),
  scope:sources.scope,authorPrincipalId:sources.authorPrincipalId,producerPrincipalId:"deterministic-visual-executor",
  visualInput,visualPlan,frontmatterSha256:fingerprint(splitDraft(c.status.input).frontmatter),
  generatorBindingSha256,rights};
 return articleVisualPlanSchema.parse({...payload,planSha256:fingerprint(payload)});
}
