import {afterEach,it,expect} from "vitest";
import {mkdtemp,mkdir,writeFile,readFile,rm} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {execFileSync} from "node:child_process";
import {exactExportPatch} from "./publication-export.js";
const roots:string[]=[];afterEach(async()=>{for(const root of roots.splice(0))await rm(root,{recursive:true,force:true});});
it("applies the exact UTF-8 create/update/delete patch in a fresh private Git fixture, preserving unrelated bytes",async()=>{
 const root=await mkdtemp(join(tmpdir(),"publication-patch-"));roots.push(root);
 const directory=join(root,"apps/site/src/content/blog");await mkdir(directory,{recursive:true});
 await writeFile(join(directory,"old.mdx"),"旧本文\n");await writeFile(join(directory,"empty.mdx"),"");
 await writeFile(join(directory,"keep.mdx"),"無関係な内容\n");
 const changes=[{path:"apps/site/src/content/blog/old.mdx",before:"旧本文\n",after:null},
  {path:"apps/site/src/content/blog/new.mdx",before:null,after:"新本文\n"},
  {path:"apps/site/src/content/blog/empty.mdx",before:"",after:"空から更新\n"}];
 const patch=join(root,"changes.patch");await writeFile(patch,exactExportPatch(changes));
 const git=(...args:string[])=>execFileSync("git",["-c","core.autocrlf=false",...args],{cwd:root,stdio:"pipe",windowsHide:true});
 git("init","--quiet","--initial-branch=fixture");
 git("apply","--check",patch);git("apply",patch);
 expect(await readFile(join(directory,"new.mdx"),"utf8")).toBe("新本文\n");
 expect(await readFile(join(directory,"empty.mdx"),"utf8")).toBe("空から更新\n");
 expect(await readFile(join(directory,"keep.mdx"),"utf8")).toBe("無関係な内容\n");
 await expect(readFile(join(directory,"old.mdx"))).rejects.toThrow();
});
it("refuses a concurrent base edit before applying any part",async()=>{
 const root=await mkdtemp(join(tmpdir(),"publication-patch-conflict-"));roots.push(root);
 const directory=join(root,"apps/site/src/content/blog");await mkdir(directory,{recursive:true});
 await writeFile(join(directory,"old.mdx"),"concurrent\n");
 const patch=join(root,"changes.patch");await writeFile(patch,exactExportPatch([
  {path:"apps/site/src/content/blog/old.mdx",before:"original\n",after:"replacement\n"},
  {path:"apps/site/src/content/blog/new.mdx",before:null,after:"new\n"}]));
 execFileSync("git",["init","--quiet","--initial-branch=fixture"],{cwd:root,windowsHide:true});
 expect(()=>execFileSync("git",["apply","--check",patch],{cwd:root,stdio:"pipe",windowsHide:true})).toThrow();
 expect(await readFile(join(directory,"old.mdx"),"utf8")).toBe("concurrent\n");
 await expect(readFile(join(directory,"new.mdx"))).rejects.toThrow();
});
