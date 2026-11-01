import {describe,it,expect} from 'vitest';
import {prepareExistingPublicationMetadata} from './existing-publication-metadata.js';
import {splitDraft} from './draft-job.js';
const original='---\nid: 00000000-0000-4000-8000-000000000001\ntitle: 受領した記事\ndescription: そのままの説明\npubDate: 2026-10-28\nupdatedDate: 2026-10-29\ncategory: software\ntags: []\ndraft: true\n---\n\n## 本文\n\n引用も本文も変えない。\n';
describe('existing AI first-publication metadata derivation',()=>{
 it('keeps received body, identity and editorial fields while setting current JST day and omitting fixture updatedDate',()=>{
  const r=prepareExistingPublicationMetadata(original,'2026-11-02',new Date('2026-11-01T16:00:00Z'));
  const before=splitDraft(original),after=splitDraft(r.manuscript);
  expect(after.body).toBe(before.body);expect(after.frontmatter).toEqual({...before.frontmatter,pubDate:'2026-11-02',updatedDate:undefined});
  expect(after.frontmatter.draft).toBe(true);expect(r.lineage.humanApproval).toBe(false);expect(r.lineage.humanAuthorship).toBe(false);
  expect(r.lineage.originalMdxSha256).not.toBe(r.lineage.mdxSha256);
 });
 it('refuses a past fixture day or a future day, using JST rather than UTC',()=>{
  for(const date of ['2026-10-28','2026-11-01','2026-11-03'])expect(()=>prepareExistingPublicationMetadata(original,date,new Date('2026-11-01T16:00:00Z'))).toThrow('CURRENT_JST_PUBLICATION_DAY_REQUIRED');
 });
});
