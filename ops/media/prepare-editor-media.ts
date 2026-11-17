import {readFile,writeFile,mkdir,lstat,realpath} from 'node:fs/promises';
import {resolve,dirname,relative,basename,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {prepareDraftMedia} from '@xpotato/media-ingest/draft';
import {mediaPolicy,type MediaKind} from '@xpotato/editor-core/policy';
export async function prepareEditorMedia(input:string,output:string,kind:MediaKind,allowLossy=false){
 const target=resolve(output),inputPath=resolve(input);const base=resolve('.local'),temp=resolve(process.env.RUNNER_TEMP??tmpdir());
 const within=(parent:string,child:string)=>{const value=relative(parent,child);return value!==''&&!value.startsWith('..')&&!isAbsolute(value)};
 if(!within(base,target)&&!within(temp,target))throw Error('DRAFT_MEDIA_OUTPUT_MUST_BE_PRIVATE');
 const sourceStat=await lstat(inputPath);if(!sourceStat.isFile()||sourceStat.isSymbolicLink()||sourceStat.nlink!==1||sourceStat.size<=0||sourceStat.size>mediaPolicy.inputBytes)throw Error('MEDIA_INPUT_INVALID');
 await mkdir(dirname(target),{recursive:true});if(await realpath(dirname(target))!==dirname(target))throw Error('OUTPUT_SYMLINK_DENIED');
 const result=await prepareDraftMedia(await readFile(inputPath),kind,{allowLossy});
 const bundle={schemaVersion:1,protocol:'xpotato-private-editor-media-v1',metadata:result.metadata,originalName:basename(inputPath),masterBase64:result.master.toString('base64'),previewBase64:result.preview.toString('base64')};
 await writeFile(target,JSON.stringify(bundle)+'\n',{flag:'wx',mode:0o600});
 return {path:target,sourceSha256:result.metadata.sourceSha256,sha256:result.metadata.sha256,bytes:result.metadata.bytes,previewBytes:result.metadata.previewBytes,lossy:result.metadata.lossy,animation:result.metadata.animation,uploaded:false,productionEligible:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2),value=(flag:string)=>{const index=args.indexOf(flag);return index<0?undefined:args[index+1]};
 const input=value('--input'),output=value('--output'),kind=value('--kind') as MediaKind|undefined;
 if(!input||!output||!kind)throw Error('Usage: npm run editor:media -- --input path --output .local/editor-media/image.json --kind photo|technical|animation [--allow-lossy]');
 console.log(JSON.stringify(await prepareEditorMedia(input,output,kind,args.includes('--allow-lossy'))));
}
