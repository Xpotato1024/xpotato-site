import {describe,it,expect} from "vitest";
import {assertPublicPublicationMetadata,assertPublicationRights} from "./publication-public-metadata.js";
import {mockRegistryIndexChanges} from "./publication-export-patch.js";
import {exactExportPatch} from "./publication-export.js";
describe("cleanup-safe public metadata and exact mock registration",()=>{
 it("rejects private locators and capability URLs while preserving fixed public source identities",()=>{
  expect(()=>assertPublicPublicationMetadata({canonicalUrl:"https://example.test/docs/tmp/item",publicDescription:"公開用の合成資料"})).not.toThrow();
  for(const value of [{publicDescription:"資料 C:\\Users\\private\\source.txt"},{publicDescription:"source=/home/alice/private.png"},{notes:"/srv/private/photo.png"},{notes:"file:///opt/private.txt"},{notes:"\\\\server\\share\\private.png"},{sourceUrl:"https://example.test/image?token=capability"},{licenseUrl:"https://user:secret@example.test/license"}])
   expect(()=>assertPublicPublicationMetadata(value)).toThrow();
 });
 it("requires explicit license/source metadata without inventing permission",()=>{
  const base={schemaVersion:1 as const,rightsId:"licensed-fixture",basis:"licensed" as const,publicationAuthorized:true,confirmedBy:"user" as const,confirmedAt:"2026-10-15T00:00:00Z"};
  expect(()=>assertPublicationRights([base])).toThrow("PUBLICATION_LICENSE_METADATA_REQUIRED");
  expect(()=>assertPublicationRights([{...base,ownerOrSource:"合成権利者",licenseId:"fixture-license"}])).not.toThrow();
  expect(()=>assertPublicationRights([{...base,basis:"unknown" as never,publicationAuthorized:false}])).toThrow("PUBLICATION_RIGHTS_UNCONFIRMED");
 });
 it("registers exact media/provenance/rights/301 projections and independently blocks normal build",()=>{
  const id="f8a847d4-8f5d-4bb0-a387-750f096479f2";
  const result=mockRegistryIndexChanges({id,provenanceSha256:"a".repeat(64),
   media:"export const mediaRegistries = Object.freeze([fixtureMediaRegistry]);\n",
   provenance:"export const publicationProvenanceRegistry: readonly ProvenanceRegistryEntry[] = Object.freeze([]);\n",
   rights:null,redirects:"export const applicationRedirects = [existing];\n",routeChanged:true});
  expect(Object.keys(result)).toHaveLength(4);
  for(const source of Object.values(result))expect(source).toMatch(/^throw new Error\("MOCK_EXPORT_NOT_FOR_NORMAL_BUILD"\)/u);
  expect(result["apps/site/src/content-registry/media/index.ts"]).toContain("contentMediaRegistrySchema.parse(articleMedia_");
  expect(result["apps/site/src/content-registry/media/index.ts"]).toContain("fixtureMediaRegistry");
  expect(result["apps/site/src/content-registry/redirects.ts"]).toContain(".record,existing");
  expect(()=>mockRegistryIndexChanges({id,provenanceSha256:"a".repeat(64),media:"unknown loader",provenance:"",rights:null,redirects:null,routeChanged:false})).toThrow("EXPORT_REGISTRY_PROJECTION_CONFLICT");
 });
 it("represents an existing empty text file with zero patch lines",()=>{
  const patch=exactExportPatch([{path:"apps/site/src/content/blog/fixture.mdx",before:"",after:"new\n"}]);
  expect(patch).toContain("@@ -0,0 +1,1 @@\n+new\n");
 });
});

it("replaces an old provenance hash by stable ContentId across repeated projections",()=>{
 const id="f8a847d4-8f5d-4bb0-a387-750f096479f2",path="apps/site/src/content-registry/provenance/index.ts";
 let provenance='export const publicationProvenanceRegistry: readonly ProvenanceRegistryEntry[] = Object.freeze([{contentId:"other",provenanceSha256:"other"}]);\n';
 for(const char of ["a","b","c"]){
  const result=mockRegistryIndexChanges({id,provenanceSha256:char.repeat(64),media:"export const mediaRegistries = Object.freeze([]);",provenance,rights:null,redirects:null,routeChanged:false});
  provenance=result[path]!;
  expect(provenance.split(".record.contentId")).toHaveLength(2);expect(provenance).toContain(char.repeat(64));expect(provenance).toContain('contentId:"other"');
 }
 expect(provenance).not.toContain("a".repeat(64));expect(provenance).not.toContain("b".repeat(64));
});
