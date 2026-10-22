import {mkdir,readFile,readdir,writeFile,lstat} from "node:fs/promises";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {browserToolManifestConfigurationSchema,browserToolSyncDefaults,browserToolReactPeers,browserToolAuthoringToolchain} from "@xpotato/content-contracts";
import {inspectToolArtifact,noToolLinks,toolHash} from "./browser-tool-adoption.js";

const siteRoot=resolve(dirname(fileURLToPath(import.meta.url)),"../../..");
const stringify=(value:unknown)=>JSON.stringify(value,null,2)+"\n";
const allowedLicenses=new Set(["MIT","Apache-2.0","BSD-2-Clause","BSD-3-Clause","ISC"]);
export async function createBrowserToolSource(input:{directory:string;toolId:string;title:string;license:string;licenseFile:string;noticeFile:string}):Promise<void>{
 const base=browserToolManifestConfigurationSchema.parse({
  schemaVersion:1,toolId:input.toolId,version:"0.1.0",
  integration:{kind:"react-island",apiVersion:1,entry:"tool.mjs",styles:["tool.css"]},
  runtime:browserToolSyncDefaults,license:{spdx:input.license,file:"LICENSE",notice:"NOTICE"}});
 if(!allowedLicenses.has(input.license))throw Error("Only the existing synchronous permissive profile is scaffolded");
 if(!input.title.trim()||input.title.length>100)throw Error("Title must be 1–100 characters");
 const target=resolve(input.directory);await noToolLinks(dirname(target));
 try{await lstat(target);throw Error("Destination must not exist");}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;}
 const legal:Record<string,Buffer>={};
 for(const[name,path]of [["LICENSE",input.licenseFile],["NOTICE",input.noticeFile]]){
  await noToolLinks(resolve(path!));const info=await lstat(path!);
  if(!info.isFile()||info.size===0||info.size>100000)throw Error("Explicit nonempty license/notice files required");
  const bytes=await readFile(path!);new TextDecoder("utf-8",{fatal:true}).decode(bytes);legal[name!]=bytes;
 }
 const replacements:Record<string,string>={__TOOL_ID__:input.toolId,__TITLE_JSON__:JSON.stringify(input.title),__INPUT_BYTES__:String(base.runtime.maxInputBytes)};
 const files=new Map<string,string|Buffer>();
 async function template(folder:string,prefix=""):Promise<void>{for(const entry of await readdir(folder,{withFileTypes:true})){
  const path=prefix+entry.name;if(entry.isDirectory())await template(join(folder,entry.name),path+"/");
  else{let text=await readFile(join(folder,entry.name),"utf8");for(const[key,value]of Object.entries(replacements))text=text.replaceAll(key,value);files.set(path,text);}
 }}
 await template(join(siteRoot,"templates/browser-tool-sync"));
 for(const[name,bytes]of Object.entries(legal))files.set(name,bytes);
 files.set("package.json",stringify({name:"@xpotato-tool/"+input.toolId,version:base.version,private:true,type:"module",license:input.license,
  engines:{node:browserToolAuthoringToolchain.node,npm:browserToolAuthoringToolchain.npm},packageManager:"npm@"+browserToolAuthoringToolchain.npm,
  scripts:{test:"node --test",build:"node scripts/build.mjs"},peerDependencies:browserToolReactPeers}));
 files.set(".node-version",browserToolAuthoringToolchain.node+"\n");files.set(".npm-version",browserToolAuthoringToolchain.npm+"\n");
 files.set(".gitignore","node_modules/\n.local/\n");
 files.set("manifest.base.json",stringify(base));
 files.set("authoring-contract.json",stringify({schemaVersion:1,authority:"Xpotato1024/xpotato-site",
  schema:"packages/content-contracts/src/browser-tool.ts",schemaSha256:toolHash(await readFile(join(siteRoot,"packages/content-contracts/src/browser-tool.ts"))),
  profile:"synchronous-v1",generated:true}));
 files.set("README.md","# "+input.title+"\n\n生成された軽量同期プラグインです。計算は src/core、GUI は src/ui、host接続は src/adapter が所有します。\n\n"
 +"正本: https://github.com/Xpotato1024/xpotato-site/blob/main/docs/contracts/browser-tool-authoring.md\n\n"
 +"1. 指定Node/npmを使用し、提供済みLICENSE/NOTICEと依存を確認して npm install --package-lock-only --ignore-scripts。lockをreviewしてcommitします。\n"
 +"2. npm ci --ignore-scripts、npm test。src/core の境界試験を用途に合わせて修正します。\n"
 +"3. npm run build -- /absolute/fresh/output。site checkoutで npm run browser-tools:author -- check --artifact /absolute/fresh/output。\n"
 +"4. cleanな同一Git commitから異なる絶対pathへ2回build。正本のreview/adopt手順へ進みます。生成・checkは採用/公開承認ではありません。\n\n"
 +"manifest.base.json は生成時の契約snapshotです。権限の自己拡張は禁止。Worker/WASMやクリック時コピーが必要なら正本の共通bounded-browser-v2と独立runtime review・有限予算・実dist受入を使います。React以外のbare runtime依存やremote SDKを追加しません。\n");
 await mkdir(target);
 for(const[path,bytes]of files){await mkdir(dirname(join(target,path)),{recursive:true});await writeFile(join(target,path),bytes,{flag:"wx"});}
}
export async function checkBrowserToolArtifact(artifact:string){
 const checked=await inspectToolArtifact(resolve(artifact));
 return {toolId:checked.manifest.toolId,version:checked.manifest.version,manifestSha256:checked.manifestSha256,artifactSha256:checked.artifactSha256,scope:"artifact-only; source review/adoption not performed"};
}
