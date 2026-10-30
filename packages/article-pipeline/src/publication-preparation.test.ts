import {it,expect} from 'vitest';import {readFile} from 'node:fs/promises';
import {inspectPublicationPreparation} from './publication-preparation.js';
import {sha256} from './canonical.js';
const mdx=await readFile(new URL('../../../tests/fixtures/article-concrete/article.mdx',import.meta.url),'utf8');
const base={mdx,route:'/blog/fdm-strength-settings/',categories:[{id:'3d-printing',label:'3Dプリンタ',status:'active'}],tags:['fdm','design','troubleshooting'].map(id=>({id,status:'active'})),canonicalContentPresent:false};
it('extracts the real fixture and refuses to turn draft:false or a preview into publication approval',()=>{
 const r=inspectPublicationPreparation(base);
 expect(r).toMatchObject({status:'BLOCKED_PUBLICATION',productionEligible:false,content:{contentId:'e7562440-e0bf-42a9-8a90-d66f4e1a4eb8',mdxSha256:sha256(mdx),fixtureDraftValue:false},examples:{count:0}});
 expect(r.media.semanticReferences).toHaveLength(9);
 for(const id of ['formal-article-job','source-claim-lineage','published-media-registry','server-storage-session'])expect(r.checks.find(c=>c.id===id)?.status).toBe('blocked');
 expect(r.checks.find(c=>c.id==='editorial-metadata')?.status).toBe('decision');
});
it('rejects stale preview bindings and routes, and reports inactive taxonomy explicitly',()=>{
 const registry={schemaVersion:1 as const,contentId:'e7562440-e0bf-42a9-8a90-d66f4e1a4eb8',assets:[]};
 expect(()=>inspectPublicationPreparation({...base,preview:{mdxSha256:'a'.repeat(64),heroState:'provided-hero',socialProfileId:'xpotato-blog-social-c-v1',registry,objectsVerified:true}})).toThrow('PREPARATION_PREVIEW_STALE');
 expect(()=>inspectPublicationPreparation({...base,route:'/blog/../public/'})).toThrow('PREPARATION_ROUTE_INVALID');
 expect(inspectPublicationPreparation({...base,categories:[]}).checks.find(c=>c.id==='taxonomy')?.status).toBe('blocked');
});
it('recognizes an existing canonical identity as an update requiring its existing publication path',()=>{
 expect(inspectPublicationPreparation({...base,canonicalContentPresent:true}).checks.find(c=>c.id==='canonical-content-boundary')?.status).toBe('blocked');
});
it('accepts only the selected metadata plan while retaining date, candidate and publication gates',async()=>{
 const plan=JSON.parse(await readFile(new URL('../../../docs/acceptance/articles/3d-print-publication-plan.json',import.meta.url),'utf8'));
 const r=inspectPublicationPreparation({...base,metadataPlan:plan});
 expect(r.checks.find(c=>c.id==='editorial-metadata')?.status).toBe('pass');expect(r.checks.find(c=>c.id==='publication-date')?.status).toBe('decision');expect(r.productionEligible).toBe(false);
 expect(()=>inspectPublicationPreparation({...base,metadataPlan:{...plan,slug:'different'}})).toThrow('PREPARATION_METADATA_PLAN_MISMATCH');
 expect(()=>inspectPublicationPreparation({...base,metadataPlan:{...plan,publicationDate:'2026-10-30'}})).toThrow();
});
