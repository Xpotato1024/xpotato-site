import {it,expect} from "vitest";
import {mkdtemp,mkdir,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,dirname} from "node:path";
import {verifyMockExport,exactExportPatch,type ExportChange} from "./publication-export.js";
import {fingerprint,sha256} from "./canonical.js";
import {articleRoute} from '@xpotato/content-contracts';
it("verifies all changes including deletions against the candidate-bound prior route",async()=>{
 const root=await mkdtemp(join(tmpdir(),"mock-export-verify-"));
 try{
  const id="f8a847d4-8f5d-4bb0-a387-750f096479f2",slug="current";
  const paths=["apps/site/src/content/blog/"+slug+".mdx",...["media","media-rights","provenance"].flatMap(name=>["apps/site/src/content-registry/"+name+"/blog/"+id+".json","apps/site/src/content-registry/"+name+"/index.ts"])];
  const changes:ExportChange[]=paths.map(path=>({path,before:null,after:"fixture\n"}));
  async function bundle(extra:ExportChange[],previous:unknown=null,overrides:Record<string,unknown>={}){
   const all=[...changes,...extra],patch=exactExportPatch(all);
   const files=all.filter(item=>item.after!==null).map(item=>({path:item.path,sha256:sha256(item.after!),sizeBytes:Buffer.byteLength(item.after!)}));
   const unsigned={protocol:"xpotato-private-mock-export-v1",productionEligible:false,contentId:id,route:"/blog/current/",previous,files,changes:all,patchSha256:sha256(patch),...overrides};
   const hash=fingerprint(unsigned),folder=join(root,hash);await mkdir(folder);
   for(const item of all)if(item.after!==null){const path=join(folder,"files",item.path);await mkdir(dirname(path),{recursive:true});await writeFile(path,item.after);}
   await writeFile(join(folder,"manifest.json"),JSON.stringify({...unsigned,exportSha256:hash}));
   await writeFile(join(folder,"changes.patch"),patch);await writeFile(join(folder,".private-draft-preview"),"private fixture");
   return {folder,hash};
  }
  const valid=await bundle([]);await expect(verifyMockExport(valid.folder,valid.hash)).resolves.toBeDefined();
  const modern=await bundle([],null,{fileSlug:slug,route:articleRoute(id)});await expect(verifyMockExport(modern.folder,modern.hash)).resolves.toBeDefined();
  for(const route of ['/notes/current/','https://elsewhere.example/','/articles/77arj41r5z8amrn46pdx71mknr/']){
   const altered=await bundle([],null,{fileSlug:slug,route});await expect(verifyMockExport(altered.folder,altered.hash)).rejects.toThrow('EXPORT_MANIFEST_SHAPE_INVALID');
  }
  const unrelated=await bundle([{path:"apps/site/src/content/blog/unrelated.mdx",before:"unrelated\n",after:null}]);
  await expect(verifyMockExport(unrelated.folder,unrelated.hash)).rejects.toThrow("EXPORT_EXACT_PATH_SET_REQUIRED");
  const escape=await bundle([{path:"../../outside",before:"unrelated\n",after:null}]);
  await expect(verifyMockExport(escape.folder,escape.hash)).rejects.toThrow("EXPORT_PATH_INVALID");
  const redirects=[{path:"apps/site/src/content-registry/article-redirects/"+id+".json",before:null,after:"fixture\n"},{path:"apps/site/src/content-registry/redirects.ts",before:"old\n",after:"fixture\n"}];
  const deletion={path:"apps/site/src/content/blog/old.mdx",before:"old source\n",after:null};
  const rename=await bundle([...redirects,deletion],{route:"/blog/old/",mdxSha256:sha256("old source\n")});
  await expect(verifyMockExport(rename.folder,rename.hash)).resolves.toBeDefined();
  const wrong=await bundle([...redirects,{...deletion,before:"different source"}],{route:"/blog/old/",mdxSha256:sha256("old source\n")});
  await expect(verifyMockExport(wrong.folder,wrong.hash)).rejects.toThrow("EXPORT_DELETE_BINDING_INVALID");
  const traversal=await bundle([...redirects,{path:'apps/site/src/content/blog/../../../../outside.mdx',before:'old source\n',after:null}],{route:'/blog/old/',fileSlug:'../../../../outside',mdxSha256:sha256('old source\n')},{fileSlug:slug,route:articleRoute(id)});
  await expect(verifyMockExport(traversal.folder,traversal.hash)).rejects.toThrow('EXPORT_PATH_INVALID');
 }finally{await rm(root,{recursive:true,force:true});}
});
