import {readFile,writeFile,mkdir} from "node:fs/promises";
import {createHash} from "node:crypto";
import {join,resolve} from "node:path";
const destination=resolve(process.argv[2] ?? (()=>{throw Error("Explicit output directory required")})());
await mkdir(destination,{recursive:true});
const pkg=JSON.parse(await readFile("package.json","utf8"));
const distributed={name:pkg.name,version:pkg.version,type:"module",main:"./tool.mjs",exports:{".":"./tool.mjs"},peerDependencies:pkg.peerDependencies};
const bytes=new Map([["package.json",Buffer.from(JSON.stringify(distributed,null,2)+"\n")]]);
for(const [source,target] of [["src/tool.mjs","tool.mjs"],["src/tool.css","tool.css"],["src/worker-source.mjs","worker-source.mjs"],["src/loader.mjs","loader.mjs"],["LICENSE","LICENSE"],["NOTICE","NOTICE"]])
  bytes.set(target,await readFile(source));
for(const [path,body] of bytes)await writeFile(join(destination,path),body,{flag:"wx"});
const manifest={schemaVersion:1,toolId:"synthetic-counter",version:pkg.version,
  integration:{kind:"react-island",apiVersion:1,entry:"tool.mjs",styles:["tool.css"]},
  runtime:{profile:"bounded-browser-v2",network:"none-after-ready",storage:"memory",capabilities:{fileInput:false,download:false,clipboard:false,worker:true,wasm:true},
    clipboardPolicy:"user-gesture-write-only",assetMode:"fixed-bundled",maxInputBytes:4096,maxOutputBytes:8192,maxComputeMs:50,jobMaxMs:500,maxWorkers:1,maxWasmBytes:65536,maxTransportBytes:8192,
    embeddedWorkerModules:["worker-source.mjs"],embeddedWasmModules:["worker-source.mjs"],workerLoaderModules:["loader.mjs"]},
  license:{spdx:"MIT",file:"LICENSE",notice:"NOTICE"},
  files:[...bytes].sort(([a],[b])=>a.localeCompare(b,"en")).map(([path,body])=>({path,bytes:body.length,sha256:createHash("sha256").update(body).digest("hex")}))};
await writeFile(join(destination,"browser-tool.json"),JSON.stringify(manifest,null,2)+"\n",{flag:"wx"});
