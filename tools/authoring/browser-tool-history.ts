import {randomUUID} from 'node:crypto';
import {mkdir,lstat,open,rename,rm,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {browserToolPinSchema} from '@xpotato/content-contracts';
import {readHistoricalToolFiles} from '../../packages/site-validators/src/browser-tool-history.js';
import {inspectToolArtifactFiles,noToolLinks,verifyToolPin,verifyToolPinArtifact} from '../../packages/site-validators/src/browser-tool-adoption.js';

/** Explicit local rollback preparation; never selects, installs or publishes a release. */
export async function restoreHistoricalToolRelease(root:string,pinInput:unknown){
 const pin=browserToolPinSchema.parse(pinInput),vendor=join(root,'vendor/browser-tools');
 await noToolLinks(vendor);
 const files=await readHistoricalToolFiles(root,pin);if(!files)throw Error('Unknown historical release');
 verifyToolPinArtifact(vendor,pin,inspectToolArtifactFiles(files));
 const parent=join(vendor,pin.toolId);await mkdir(parent,{recursive:true});await noToolLinks(parent);
 const target=join(parent,pin.releaseId),stage=join(parent,'.restore-'+randomUUID()),lockPath=join(parent,'.adoption-lock');
 const lock=await open(lockPath,'wx');
 try{
  try{await lstat(target);await verifyToolPin(vendor,pin);return{restored:false,pin};}
  catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
   try{await lstat(target);throw Error('Existing historical tree is incomplete; refusing replacement');}catch(missing){if((missing as NodeJS.ErrnoException).code!=='ENOENT')throw missing;}
  }
  await mkdir(stage);
  for(const[p,bytes]of files){await mkdir(dirname(join(stage,p)),{recursive:true});await writeFile(join(stage,p),bytes,{flag:'wx'});}
  // Check actual materialized bytes with the same artifact validator before atomic publication.
  const {inspectToolArtifact}=await import('../../packages/site-validators/src/browser-tool-adoption.js');
  verifyToolPinArtifact(vendor,pin,await inspectToolArtifact(stage));
  await rename(stage,target);await verifyToolPin(vendor,pin);
  return{restored:true,pin};
 }finally{await rm(stage,{recursive:true,force:true});await lock.close();await rm(lockPath);}
}
