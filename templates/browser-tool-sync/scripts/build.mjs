import {readFile,writeFile,mkdir,lstat} from "node:fs/promises";
import {resolve,dirname,relative,isAbsolute,sep} from "node:path";
import {createHash} from "node:crypto";
const root=resolve(import.meta.dirname,".."), out=resolve(process.argv[2]||"");
const inside=relative(root,out);
if(process.argv.length!==3||inside===""||(!isAbsolute(inside)&&inside!==".."&&!inside.startsWith(".."+sep)))throw Error("Fresh external output directory required");
try{await lstat(out);throw Error("Output exists");}catch(e){if(e.code!=="ENOENT")throw e;}
const pkg=JSON.parse(await readFile(resolve(root,"package.json"),"utf8"));
const base=JSON.parse(await readFile(resolve(root,"manifest.base.json"),"utf8"));
const files=new Map(), hash=b=>createHash("sha256").update(b).digest("hex");
for(const [source,target] of [["src/core/convert.mjs","core.mjs"],["src/ui/Tool.mjs","ui.mjs"],["src/adapter/index.mjs","tool.mjs"],["styles/tool.css","tool.css"],["LICENSE","LICENSE"],["NOTICE","NOTICE"]]){
 let bytes=await readFile(resolve(root,source));
 if(target==="ui.mjs")bytes=Buffer.from(bytes.toString().replace('"../core/convert.mjs"','"./core.mjs"'));
 if(target==="tool.mjs")bytes=Buffer.from(bytes.toString().replace('"../ui/Tool.mjs"','"./ui.mjs"'));
 files.set(target,bytes);
}
files.set("package.json",Buffer.from(JSON.stringify({name:pkg.name,version:pkg.version,type:"module",license:pkg.license,main:"./tool.mjs",exports:{".":"./tool.mjs"},peerDependencies:pkg.peerDependencies},null,2)+"\n"));
const manifest={...base,version:pkg.version,files:[...files].sort(([a],[b])=>a.localeCompare(b,"en")).map(([path,b])=>({path,bytes:b.length,sha256:hash(b)}))};
files.set("browser-tool.json",Buffer.from(JSON.stringify(manifest,null,2)+"\n"));
await mkdir(out,{recursive:true});
for(const[path,bytes]of files)await writeFile(resolve(out,path),bytes,{flag:"wx"});
console.log("Built "+files.size+" fixed files; validate with the site canonical checker.");
