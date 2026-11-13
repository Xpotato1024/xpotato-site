import {afterEach,describe,expect,it,vi} from "vitest";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {articleRoute} from "@xpotato/content-contracts";
import {mediaRegistries} from "../../content-registry/media/index.js";
import {creditRegistry,creditRights} from "./media-credits.test-fixtures.js";
import {resolveMediaCredits} from "./media-credits.js";

let directory:string|undefined;
afterEach(async()=>{
  vi.unstubAllEnvs();vi.resetModules();
  if(directory)await rm(directory,{recursive:true,force:true});
});
async function overlay(rights:unknown,reference=true){
  directory=await mkdtemp(join(tmpdir(),"xpotato-rights-overlay-"));
  // Deliberately collide with a published ContentId, to prove no catalog fallback.
  const contentId=mediaRegistries[0]!.contentId,sha="a".repeat(64);
  const input={schemaVersion:1,protocol:"xpotato-private-candidate-build-input-v1",
    candidateInputSha256:sha,contentId,route:articleRoute(contentId),buildRoot:directory,contentRoot:directory,
    targetPath:"apps/site/src/content/blog/synthetic.mdx",mdxSha256:sha,
    overlayFiles:[{path:"apps/site/src/content/blog/synthetic.mdx",sha256:sha}],
    registry:{...creditRegistry,contentId},localMediaUrls:{[sha]:"/__candidate_media/"+sha+".webp"},
    plannedSeo:{canonical:"https://example.test"+articleRoute(contentId),image:null},
    scope:"synthetic_fixture",reference,planConfirmed:false,productionEligible:false,
    ...(rights===undefined?{}:{rights})};
  const text=JSON.stringify(input),path=join(directory,"input.json");
  await writeFile(path,text);
  vi.stubEnv("XPOTATO_ARTICLE_CANDIDATE_INPUT",path);
  vi.stubEnv("XPOTATO_ARTICLE_CANDIDATE_INPUT_SHA",createHash("sha256").update(text).digest("hex"));
  vi.resetModules();
  return {contentId,path,text};
}
describe("hash-bound candidate rights context",()=>{
  it("uses the candidate rights instead of published records for the same ContentId",async()=>{
    const {contentId}=await overlay([{...creditRights,attributionText:"合成候補だけの表示"}],false);
    const {contentMediaContext}=await import("./media-context.js");
    const context=contentMediaContext(contentId)!;
    expect(context.candidate).toBe(true);
    expect(context.rights).toEqual([{...creditRights,attributionText:"合成候補だけの表示"}]);
    expect(resolveMediaCredits({contentId,...context,assetId:"diagram"})).toEqual([{text:"合成候補だけの表示"}]);
  });
  it("does not borrow public rights for a legacy reference with no rights field",async()=>{
    const {contentId}=await overlay(undefined);
    const {contentMediaContext}=await import("./media-context.js");
    const context=contentMediaContext(contentId)!;
    expect(context.rights).toBeUndefined();
    expect(context.referenceOnly).toBe(true);
    expect(resolveMediaCredits({contentId,...context,assetId:"diagram"})).toEqual([]);
  });
  it("does not exempt an explicitly empty rights array in a reference",async()=>{
    const {contentId}=await overlay([]);
    const {contentMediaContext}=await import("./media-context.js");
    const context=contentMediaContext(contentId)!;
    expect(()=>resolveMediaCredits({contentId,...context,assetId:"diagram"})).toThrow("RIGHTS_NOT_UNIQUE");
  });
  it("rejects a changed overlay before exposing its credit",async()=>{
    const {contentId,path,text}=await overlay([creditRights]);
    await writeFile(path,text.replace('"publicationAuthorized":true','"publicationAuthorized":false'));
    const {contentMediaContext}=await import("./media-context.js");
    expect(()=>contentMediaContext(contentId)).toThrow("CANDIDATE_BUILD_INPUT_HASH_MISMATCH");
  });
});
