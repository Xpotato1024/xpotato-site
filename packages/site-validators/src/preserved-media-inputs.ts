import {lstatSync,readFileSync,readdirSync,realpathSync} from 'node:fs';
import {join,relative,extname} from 'node:path';
import {sha256} from '@xpotato/content-contracts/canonical';
export const preservedMediaCatalogPath='apps/site/source-inputs/media/catalog.json';
const prefix='apps/site/source-inputs/media/sha256/';
interface SourceEntry {path:string;source:{commit:string;path:string;sha256:string;sizeBytes:number};disposition:string;bindings:{contentId:string;assetId:string;rightsRef?:string;relation?:string}[]}
export interface PreservedMediaCatalog {schemaVersion:1;kind:'preserved-repository-media-inputs';entries:SourceEntry[]}
function regularBytes(root:string,path:string):Buffer {
 let current=root;for(const part of path.split('/')){if(!part||part==='.'||part==='..')throw Error('Preserved media path invalid');current=join(current,part);if(lstatSync(current).isSymbolicLink())throw Error('Preserved media symlink is forbidden');}
 const stat=lstatSync(current);if(!stat.isFile()||stat.nlink!==1||stat.size>2_000_000||relative(realpathSync(root),realpathSync(current)).replaceAll('\\','/')!==path)throw Error('Preserved media must be a bounded regular source input');
 return readFileSync(current);
}
/** Existing source bytes are verified against their current catalog, not regenerated from old code. */
export function readPreservedMediaInputs(root:string){
 const catalog=JSON.parse(regularBytes(root,preservedMediaCatalogPath).toString('utf8')) as PreservedMediaCatalog;
 if(catalog.schemaVersion!==1||catalog.kind!=='preserved-repository-media-inputs'||!Array.isArray(catalog.entries)||catalog.entries.length!==9)throw Error('Preserved media catalog invalid');
 const bySourcePath=new Map<string,Buffer>(),paths=new Set<string>();
 for(const entry of catalog.entries){
  if(!entry.source||!/^[a-f0-9]{64}$/.test(entry.source.sha256)||!/^[a-f0-9]{40}$/.test(entry.source.commit)||!Number.isSafeInteger(entry.source.sizeBytes)||entry.source.sizeBytes<=0||entry.source.sizeBytes>2_000_000||!Array.isArray(entry.bindings))throw Error('Preserved media source invalid');
  const extension=extname(entry.path).toLowerCase();
  if(!['.png','.jpg','.jpeg'].includes(extension)||entry.path!==prefix+entry.source.sha256+extension||paths.has(entry.path)||bySourcePath.has(entry.source.path))throw Error('Preserved media catalog duplicate or path invalid');
  const bytes=regularBytes(root,entry.path);if(bytes.length!==entry.source.sizeBytes||sha256(bytes)!==entry.source.sha256)throw Error('Preserved media input bytes mismatch: '+entry.path);
  paths.add(entry.path);bySourcePath.set(entry.source.path,bytes);
 }
 const actual=readdirSync(join(root,prefix)).map(name=>prefix+name).sort();
 if(JSON.stringify(actual)!==JSON.stringify([...paths].sort()))throw Error('Unregistered preserved media source');
 return {catalog,bySourcePath,paths};
}
export function preservedMediaOutputErrors(path:string,bytes:Buffer,hashes:ReadonlySet<string>):string[]{
 return /(?:^|[\\/])source-inputs(?:[\\/]|$)/u.test(path)||hashes.has(sha256(bytes))?['Preserved original source input is forbidden in public output']:[];
}
