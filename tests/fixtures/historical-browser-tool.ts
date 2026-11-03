import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {browserToolReleases} from '../../apps/site/src/content-registry/interactive/releases.js';
import {readHistoricalToolFiles} from '../../packages/site-validators/src/browser-tool-history.js';
import {inspectToolArtifactFiles,verifyToolPinArtifact} from '../../packages/site-validators/src/browser-tool-adoption.js';

export async function historicalToolFiles(releaseId:string){
 const pin=browserToolReleases.find(p=>p.toolId==='prime-factorizer'&&p.releaseId===releaseId);
 if(!pin)throw Error('Unknown historical fixture release');
 const files=await readHistoricalToolFiles(resolve('.'),pin);if(!files)throw Error('Historical fixture unavailable');
 verifyToolPinArtifact(resolve('vendor/browser-tools'),pin,inspectToolArtifactFiles(files));
 return files;
}
export async function materializeHistoricalToolFixture(releaseId:string){
 const files=await historicalToolFiles(releaseId),root=await mkdtemp(join(tmpdir(),'historical-tool-fixture-'));
 try{for(const[p,bytes]of files){await mkdir(dirname(join(root,p)),{recursive:true});await writeFile(join(root,p),bytes,{flag:'wx'});}}
 catch(error){await rm(root,{recursive:true,force:true});throw error;}
 return{root,cleanup:()=>rm(root,{recursive:true,force:true})};
}
