import {runApplicationBuilds} from './apps-graph.mjs';
import {spawn} from 'node:child_process';
import {cp,stat,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url)),npm=process.env.npm_execpath;
if(!npm)throw Error('Run through the pinned npm entrypoint');
const run=script=>new Promise((accept,reject)=>{const child=spawn(process.execPath,[npm,'run',script],{cwd:root,stdio:'inherit',env:process.env});child.once('error',reject);child.once('exit',(code,signal)=>code===0?accept():reject(Error(script+' build failed: '+code+' '+signal)));});
// Each application is built once; no consumer repeats either build.
await runApplicationBuilds(run);
const source=join(root,'apps/editor/dist'),target=join(root,'apps/site/dist/editor');
for(const dir of [source,join(root,'apps/site/dist')]){const info=await stat(dir);if(!info.isDirectory())throw Error('APP_OUTPUT_INVALID');}
await rm(target,{recursive:true,force:true});await cp(source,target,{recursive:true,errorOnExist:true});
console.log('Static site and editor built once in parallel; editor shell composed under /editor/.');
