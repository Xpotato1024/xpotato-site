import {z} from 'zod';import {createHash} from 'node:crypto';
import {sourceRecordSchema,evidenceRecordSchema,articleClaimRecordSchema,externalAiDisclosureRecordSchema} from '@xpotato/content-contracts';
import {compileArticleCitations,inspectExamples} from '@xpotato/portable-content/review';
import {currentExternalAiPolicyBinding,containsHardDenyMaterial} from './disclosure.js';
import {fingerprint,sha256} from './canonical.js';import {splitDraft} from './draft-job.js';
const hash=z.string().regex(/^[a-f0-9]{64}$/u),id=z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
const packetSchema=z.object({protocol:z.literal('xpotato-prepublication-research-v1'),scope:z.literal('agent-research-preparation'),
 author:z.object({kind:z.literal('agent'),principalId:id}).strict(),productionEligible:z.literal(false),humanApproval:z.null(),formalArticleJob:z.null(),
 baseCommit:z.string().regex(/^[a-f0-9]{40}$/u),content:z.object({id:z.string().uuid(),mdxPath:z.literal('tests/fixtures/article-concrete/article.mdx'),mdxSha256:hash,bodySha256:hash,title:z.string()}).strict(),
 sources:z.array(z.object({record:sourceRecordSchema,recordSha256:hash,disclosure:externalAiDisclosureRecordSchema,snapshot:z.object({sha256:hash,sizeBytes:z.number().int().positive().max(4194304),gitBlobSha:z.string().regex(/^[a-f0-9]{40}$/u).nullable(),retention:z.literal('private-acquisition-only')}).strict()}).strict()).min(1).max(100),
 evidence:z.array(evidenceRecordSchema).min(1).max(500),claims:z.array(articleClaimRecordSchema).min(1).max(500),
 claimNotes:z.array(z.object({claimId:id,text:z.string()}).strict()),limitations:z.array(z.object({evidenceId:id,text:z.string()}).strict()),citationGroups:z.record(z.string().regex(/^\d+$/u),z.array(id).min(1)),
 mechanicsCitationProposal:z.object({sourceId:id,claimIds:z.array(id),selected:z.literal(false)}).strict(),
 examples:z.object({parser:z.literal('portable-content-inspect-examples'),count:z.number().int().nonnegative(),status:z.literal('no-fenced-examples-detected'),formalVerificationReceipt:z.null()}).strict(),
 rights:z.object({icons:z.array(z.object({assetId:id,sourceId:id,licenseSourceId:id,status:z.literal('unconfirmed')}).strict()),operatorMediaApproval:z.null()}).strict(),
 ambiguities:z.array(z.object({id,status:z.enum(['bounded','unresolved']),text:z.string()}).strict()),packetSha256:hash,
}).strict();
export function checkPrepublicationResearch(input:unknown,mdx:string,snapshots?:ReadonlyMap<string,Uint8Array>){
 const p=packetSchema.parse(input),{packetSha256,...unsigned}=p;if(fingerprint(unsigned)!==packetSha256)throw Error('RESEARCH_PACKET_HASH_CHANGED');
 if(containsHardDenyMaterial(Buffer.from(JSON.stringify(p))))throw Error('RESEARCH_SECRET_DENIED');
 const {frontmatter,body}=splitDraft(mdx);if(p.content.id!==frontmatter.id||p.content.title!==frontmatter.title||p.content.mdxSha256!==sha256(mdx)||p.content.bodySha256!==sha256(body))throw Error('RESEARCH_DRAFT_STALE');
 const unique=(values:string[])=>{if(new Set(values).size!==values.length)throw Error('RESEARCH_DUPLICATE_ID');};
 unique(p.sources.map(s=>s.record.sourceId));unique(p.evidence.map(e=>e.evidenceId));unique(p.claims.map(c=>c.claimId));unique(p.ambiguities.map(a=>a.id));
 const sources=new Map(p.sources.map(s=>[s.record.sourceId,s])),evidence=new Map(p.evidence.map(e=>[e.evidenceId,e]));
 for(const s of p.sources){
  const d=s.disclosure,r=s.record;if(s.recordSha256!==fingerprint(r)||r.snapshotSha256!==s.snapshot.sha256||r.externalAiDisclosureRef!==fingerprint(d)||d.subject.kind!=='artifact'||d.subject.id!==r.sourceId||d.subject.sha256!==s.snapshot.sha256||d.mode!=='deny'||d.policyId!==currentExternalAiPolicyBinding.policyId||d.policySha256!==currentExternalAiPolicyBinding.policySha256)throw Error('RESEARCH_SOURCE_BINDING_CHANGED');
  if(r.citation.eligible&&(!r.publicSafe||!r.citation.canonicalUrl))throw Error('RESEARCH_CITATION_NOT_PUBLIC');
  const url=r.citation.canonicalUrl;
  const expected=r.locator.kind==='web'?r.locator.canonicalUrl:r.locator.kind==='github'?'https://github.com/'+r.locator.repository+'/blob/'+r.locator.commitSha+'/'+r.locator.path:undefined;
  if(url&&url!==expected)throw Error('RESEARCH_CITATION_IDENTITY_CHANGED');
  if(snapshots){const b=snapshots.get(r.sourceId);if(!b||b.byteLength!==s.snapshot.sizeBytes||sha256(b)!==s.snapshot.sha256)throw Error('RESEARCH_SNAPSHOT_CHANGED');
   if(s.snapshot.gitBlobSha&&createHash('sha1').update('blob '+b.byteLength+'\0').update(b).digest('hex')!==s.snapshot.gitBlobSha)throw Error('RESEARCH_GIT_BLOB_CHANGED');}
 }
 if(snapshots&&snapshots.size!==sources.size)throw Error('RESEARCH_SNAPSHOT_SET_CHANGED');
 for(const e of p.evidence){if(e.interpretation==='unknown'||e.confidence==='not_available')throw Error('RESEARCH_EVIDENCE_UNRESOLVED');unique(e.sourceRefs.map(r=>r.sourceId));if(e.ambiguityIds.some(id=>!p.ambiguities.some(a=>a.id===id&&a.status==='bounded')))throw Error('RESEARCH_AMBIGUITY_UNRESOLVED');for(const ref of e.sourceRefs){const s=sources.get(ref.sourceId);if(!s||ref.sourceRecordSha256!==s.recordSha256||s.record.freshness==='time_sensitive'&&!e.freshnessChecked)throw Error('RESEARCH_EVIDENCE_SOURCE_CHANGED');}}
 for(const c of p.claims){if(c.draftSpan.text!==c.text||body.slice(c.draftSpan.start,c.draftSpan.end)!==c.text||!c.evidenceIds.length||c.evidenceIds.some(id=>!evidence.has(id)))throw Error('RESEARCH_CLAIM_CHANGED');}
 for(const n of p.claimNotes)if(!p.claims.some(c=>c.claimId===n.claimId))throw Error('RESEARCH_NOTE_UNKNOWN_CLAIM');
 for(const n of p.limitations)if(!evidence.has(n.evidenceId))throw Error('RESEARCH_NOTE_UNKNOWN_EVIDENCE');
 for(const ids of Object.values(p.citationGroups)){unique(ids);if(ids.some(id=>!sources.get(id)?.record.citation.eligible))throw Error('RESEARCH_CITATION_SOURCE_UNKNOWN');}
 const proposal=p.mechanicsCitationProposal;unique(proposal.claimIds);
 if(!sources.get(proposal.sourceId)?.record.citation.eligible||proposal.claimIds.some(id=>!p.claims.some(c=>c.claimId===id&&c.evidenceIds.some(e=>evidence.get(e)!.sourceRefs.some(s=>s.sourceId===proposal.sourceId)))))throw Error('RESEARCH_PROPOSAL_REFERENCE_CHANGED');
 for(const icon of p.rights.icons)if(!sources.has(icon.sourceId)||!sources.has(icon.licenseSourceId))throw Error('RESEARCH_RIGHTS_REFERENCE_CHANGED');
 // A separate citation-only proposal. The adopted fixture and its span binding
 // remain unchanged; neither this proposal nor the research packet is a job.
 const end=body.indexOf('## 出典と図について');if(end<0)throw Error('RESEARCH_CITATION_SECTION_MISSING');
 let citationDraft=body.slice(0,end);
 for(const claimId of proposal.claimIds){const text=p.claims.find(c=>c.claimId===claimId)!.text;if(citationDraft.split(text).length!==2)throw Error('RESEARCH_PROPOSAL_SPAN_AMBIGUOUS');citationDraft=citationDraft.replace(text,text+' [@'+proposal.sourceId+']');}
 citationDraft=citationDraft.replace(/\[(\d+)\]/gu,(_all,key:string)=>{const ids=p.citationGroups[key];if(!ids)throw Error('RESEARCH_CITATION_GROUP_UNKNOWN');return '[@'+ids.join(' @')+']';});
 const citation=compileArticleCitations(citationDraft,p.sources.map(s=>s.record));
 if(inspectExamples(body).length!==p.examples.count||p.examples.count!==0)throw Error('RESEARCH_EXAMPLES_CHANGED');
 return {status:'RESEARCH_RECORDS_VERIFIED_PUBLICATION_BLOCKED' as const,productionEligible:false as const,formalJobVerified:false as const,
  packetSha256,sourceCount:p.sources.length,evidenceCount:p.evidence.length,claimCount:p.claims.length,snapshotsVerified:Boolean(snapshots),
  citationCompilationSha256:citation.compilationSha256,citationManifest:citation.manifest,citationProposal: citation.compiled};
}
