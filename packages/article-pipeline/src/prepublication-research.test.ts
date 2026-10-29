import {it,expect} from 'vitest';import {readFile} from 'node:fs/promises';
import {checkPrepublicationResearch} from './prepublication-research.js';import {fingerprint} from './canonical.js';
const mdx=await readFile(new URL('../../../tests/fixtures/article-concrete/article.mdx',import.meta.url),'utf8');
const record=JSON.parse(await readFile(new URL('../../../docs/acceptance/articles/3d-print-strength-research.json',import.meta.url),'utf8'));
const resign=(p:any)=>{delete p.packetSha256;p.packetSha256=fingerprint(p);return p;};
it('validates real preparation records and compiles fixed citations without granting publication',()=>{
 const r=checkPrepublicationResearch(record,mdx);expect(r).toMatchObject({status:'RESEARCH_RECORDS_VERIFIED_PUBLICATION_BLOCKED',productionEligible:false,formalJobVerified:false,sourceCount:22,evidenceCount:23,claimCount:51,snapshotsVerified:false});
 expect(r.citationProposal).toContain('[^cite-1]');expect(r.citationProposal).not.toContain('[@');expect(r.citationProposal).toContain('79df7ae309be398ed30c9f397c13c9911c2edc57');
 expect(r.citationProposal).toMatch(/上面そのものを曲がりにくくする変更に当たります。 \[\^cite-\d+\]/u);
});
it('rejects re-signed unknown supplemental, rights and ambiguity references',()=>{
 for(const change of [(p:any)=>p.mechanicsCitationProposal.sourceId='unknown',(p:any)=>p.mechanicsCitationProposal.claimIds=['unknown'],(p:any)=>p.rights.icons[0].licenseSourceId='unknown',(p:any)=>p.rights.icons[0].sourceId='unknown',(p:any)=>p.evidence[0].ambiguityIds=['unknown'],(p:any)=>p.evidence[0].ambiguityIds=['a-hero']]){const p=structuredClone(record);change(p);expect(()=>checkPrepublicationResearch(resign(p),mdx)).toThrow();}
});
it('rejects draft drift and re-signed broken claim/source/citation bindings',()=>{
 expect(()=>checkPrepublicationResearch(record,mdx.replace('近道とは限りません','必ず近道です'))).toThrow('RESEARCH_DRAFT_STALE');
 for(const change of [(p:any)=>p.claims[0].draftSpan.start++,(p:any)=>p.evidence[0].sourceRefs[0].sourceRecordSha256='a'.repeat(64),(p:any)=>p.citationGroups['1']=['unknown']]){const p=structuredClone(record);change(p);expect(()=>checkPrepublicationResearch(resign(p),mdx)).toThrow();}
});
it('rejects private source bytes with a changed hash or incomplete set and cannot promote rights or approval',()=>{
 expect(()=>checkPrepublicationResearch(record,mdx,new Map())).toThrow('RESEARCH_SNAPSHOT_CHANGED');
 for(const change of [(p:any)=>p.productionEligible=true,(p:any)=>p.rights.icons[0].status='approved',(p:any)=>p.author.kind='human',(p:any)=>p.humanApproval={}]){const p=structuredClone(record);change(p);expect(()=>checkPrepublicationResearch(resign(p),mdx)).toThrow();}
});
