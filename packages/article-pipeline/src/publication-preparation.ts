import {articleRoute,assertArticleRoute,blogFrontmatterSchema,type ContentMediaRegistry,type MediaRightsRecord,type PublicationProvenanceRecord} from '@xpotato/content-contracts';
import {validatePortableMdx} from '@xpotato/portable-content';
import {articleMediaReferences} from '@xpotato/portable-content/media';
import {inspectExamples} from '@xpotato/portable-content/review';
import {assertCompactRegistryMedia} from '@xpotato/portable-content/compact-media';
import {splitDraft} from './draft-job.js';import {sha256,fingerprint} from './canonical.js';
import {z} from 'zod';
export const publicationMetadataPlanSchema=z.object({schemaVersion:z.literal(2),urlPolicy:z.literal('content-id-base32-v1'),scope:z.literal('owner-selected-metadata-only'),selectedOn:z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),contentId:z.string().uuid(),previousSlugProposal:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u).max(80),categoryId:z.string(),tagIds:z.array(z.string()),publicationDate:z.null(),hero:z.null(),candidateApproval:z.null(),productionEligible:z.literal(false)}).strict();

/** Intake diagnostics for a fixture, not an Article Job audit, admission or
 * export preflight. Only canonical registries can satisfy registry checks;
 * private preview data is reported separately and never promoted here.
 */
export function inspectPublicationPreparation(input:{mdx:string;route:string;categories:readonly {id:string;label:string;status:string}[];tags:readonly {id:string;status:string}[];
 canonicalContentPresent:boolean;registry?:ContentMediaRegistry;evidence?:{provenance:PublicationProvenanceRecord;rights:readonly MediaRightsRecord[]};metadataPlan?:z.infer<typeof publicationMetadataPlanSchema>;
 preview?:{mdxSha256:string;heroState:string;socialProfileId:string;registry:ContentMediaRegistry;objectsVerified:boolean}}){
 try{assertArticleRoute(input.route,splitDraft(input.mdx).frontmatter.id);}catch{throw Error('PREPARATION_ROUTE_INVALID');}
 const {frontmatter,body}=splitDraft(input.mdx),fm=blogFrontmatterSchema.parse(frontmatter),mdxSha256=sha256(input.mdx);
 const portableErrors=validatePortableMdx(body),refs=articleMediaReferences(body),examples=inspectExamples(body);
 const category=input.categories.find(c=>c.id===fm.category&&c.status==='active');
 const unknownTags=fm.tags.filter(id=>!input.tags.some(t=>t.id===id&&t.status==='active'));
 const checks:{id:string;status:'pass'|'blocked'|'decision';reason:string}[]=[];
 const add=(id:string,status:'pass'|'blocked'|'decision',reason:string)=>checks.push({id,status,reason});
 add('portable-content',portableErrors.length?'blocked':'pass',portableErrors.length?portableErrors.join('; '):'Approved portable MDX only');
 add('taxonomy',category&&!unknownTags.length?'pass':'blocked',category&&!unknownTags.length?'Existing active IDs resolve':'Unknown/inactive category or tag');
 if(input.metadataPlan){const plan=publicationMetadataPlanSchema.parse(input.metadataPlan);
  if(plan.contentId!==fm.id||input.route!==articleRoute(plan.contentId)||plan.categoryId!==fm.category||fingerprint(plan.tagIds)!==fingerprint(fm.tags))throw Error('PREPARATION_METADATA_PLAN_MISMATCH');
  add('editorial-metadata','pass','Owner-selected immutable ID URL/category/tags match; this is not candidate or publication approval');
 }else add('editorial-metadata','decision','Confirm the primary category and related tags; the route derives from ContentId for this article');
 add('publication-date','decision','No publication date is adopted; the fixture date is not evidence of publication');
 add('formal-article-job','blocked','Fixture draft:false is not a formal Article Job candidate, content audit or human approval');
 add('source-claim-lineage','blocked','Compile fixed sources, evidence, material claims and citations through the Article Job');
 add('technical-examples',examples.length?'decision':'pass',examples.length?'Use the formal example verification lane':'Parser extracted zero fenced technical examples; this report is not a formal job receipt');
 add('canonical-content-boundary',input.canonicalContentPresent?'blocked':'pass',input.canonicalContentPresent?'ContentId already exists; use the reviewed update path':'Fixture ContentId is absent from canonical content; no promotion performed');
 let registryVerified=false;
 if(input.registry&&input.evidence){
  if(input.registry.contentId!==fm.id)throw Error('PREPARATION_REGISTRY_CONTENT_ID_MISMATCH');
  try{const registry=assertCompactRegistryMedia({registry:input.registry,...input.evidence});
   registryVerified=refs.every(id=>registry.assets.some(a=>a.assetId===id&&a.status==='active'))
    &&registry.assets.some(a=>a.role==='hero'&&a.status==='active')
    &&registry.assets.some(a=>a.role==='social_card'&&a.status==='active'&&a.delivery.master.width===1200&&a.delivery.master.height===630&&a.delivery.master.format==='png'&&a.decorative!==true&&Boolean(a.defaultAlt?.trim()));
  }catch{registryVerified=false;}
 }
 add('published-media-registry',registryVerified?'pass':'blocked',registryVerified?'Compact rights/provenance/recovery and required semantic assets validate':'Required canonical media, rights, source/public/protection and compact lineage are incomplete');
 add('publication-ci-setup','blocked','The protected main/manual CI requires reviewed producer admission, initial ABC-only reusable token/configuration acceptance and separately authorized storage; fixture inspection grants none');
 const preview=input.preview;
 if(preview){
  if(preview.mdxSha256!==mdxSha256||preview.registry.contentId!==fm.id)throw Error('PREPARATION_PREVIEW_STALE');
  add('private-preview-bytes',preview.objectsVerified?'pass':'blocked','Private preview byte checks do not admit publication');
  add('hero',preview.heroState==='provided-hero'?'decision':'blocked',preview.heroState==='provided-hero'?'Confirm the supplied hero, source and rights in the formal candidate':'Composition-only hero slot is not a final image');
  add('standard-social',preview.socialProfileId==='xpotato-blog-social-c-v1'?'pass':'blocked','C profile must remain separate from hero and canonical/SEO title');
 }else add('private-preview','blocked','Generate the private composition preview or supply the final local hero');
 const report={protocol:'xpotato-publication-preparation-v1' as const,status:'BLOCKED_PUBLICATION' as const,productionEligible:false as const,
  content:{contentId:fm.id,mdxSha256,bodySha256:sha256(body),title:fm.title,description:fm.description,route:input.route,pubDate:fm.pubDate,category:fm.category,categoryLabel:category?.label??null,tags:fm.tags,fixtureDraftValue:fm.draft,displayLines:fm.cardDisplay?.lines??null},
  media:{semanticReferences:refs,canonicalRegistryVerified:registryVerified,privatePreview:preview?{heroState:preview.heroState,socialProfileId:preview.socialProfileId,assetCount:preview.registry.assets.length,canonicalSourceCount:preview.registry.assets.filter(a=>a.canonicalSource).length}:null},
  examples:{count:examples.length,bodySha256:sha256(body)},checks,
  nextStages:['formal-source-evidence-and-claim-intake','independent-content-and-visual-audit','final-hero-and-rights','human-candidate-approval','separately-authorized-source-public-protected-storage','compact-registry-export','reviewed-merge-and-manual-deploy']};
 return {...report,reportSha256:fingerprint(report)};
}
