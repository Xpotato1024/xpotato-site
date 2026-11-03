import {execFileSync} from 'node:child_process';
import {lstatSync,readFileSync,realpathSync} from 'node:fs';
import {join,relative,extname} from 'node:path';
import {phase6MediaRawInventorySchema,phase6MediaRepositoryCandidateManifestSchema} from '@xpotato/content-contracts';
import {fingerprint,sha256} from '@xpotato/content-contracts/canonical';
import {LEGACY_COMMIT} from './legacy-inventory.js';
import {readFrozenLegacyTextCopies} from './repository-retirement.js';
import {readSourceBlobs} from "../browser-tools/browser-tool-source-blobs.js";

export const preservedMediaCatalogPath='apps/site/source-inputs/media/catalog.json';
const sourcePrefix='apps/site/source-inputs/media/sha256/';
type Binding={contentId:string;assetId:string;rightsRef?:string;relation?:'replaced-by'};
type Entry={path:string;source:{commit:string;path:string;sha256:string;sizeBytes:number};
 disposition:'homepage-build-input'|'migration-ingest-input'|'replaced-original'|'unassigned-original';bindings:Binding[]};
export type PreservedMediaCatalog={schemaVersion:1;kind:'preserved-repository-media-inputs';entries:Entry[]};
const json=(root:string,path:string):unknown=>JSON.parse(readFileSync(join(root,path),'utf8'));

function frozenRasterSources(root:string):Map<string,Buffer>{
 // Reuse exact annotated-tag/baseline verification. This is recovery, not publication admission.
 readFrozenLegacyTextCopies(root);
 const options={cwd:root,env:{...process.env,GIT_NO_REPLACE_OBJECTS:'1',GIT_OPTIONAL_LOCKS:'0'}};
 const records=execFileSync('git',['ls-tree','-rlz',LEGACY_COMMIT,'--','public'],{...options,maxBuffer:1000000}).toString('utf8')
  .split('\0').filter(Boolean).filter(line=>/\.(?:png|jpe?g)$/iu.test(line)).map(line=>{
   const match=/^100644 blob ([a-f0-9]{40})\s+(\d+)\t(public\/[^\0]+)$/u.exec(line);
   if(!match)throw Error('Nonregular preserved media source');
   return{oid:match[1]!,size:Number(match[2]),path:match[3]!};
  });
 if(records.length!==9||records.some(r=>r.size>2_000_000))throw Error('Frozen nine-image source set mismatch');
 const blobs=readSourceBlobs(records,(input,maxBuffer)=>execFileSync('git',['cat-file','--batch'],{...options,input,maxBuffer}));
 return new Map(records.map(r=>[r.path,blobs.get(r.oid)!]));
}

export function buildPreservedMediaCatalog(root:string):PreservedMediaCatalog{
 const raw=phase6MediaRawInventorySchema.parse(json(root,'docs/migration/media-raw-inventory-v1.json'));
 const accepted=phase6MediaRepositoryCandidateManifestSchema.parse(json(root,'docs/migration/media-repository-candidate-v1.json'));
 const entries:Entry[]=[...frozenRasterSources(root)].map(([path,bytes])=>{
  const hash=sha256(bytes),active=accepted.provenance.filter(p=>p.origin==='legacy_git'&&p.repositoryPath===path);
  const bindings:Binding[]=active.map(p=>{
   const rights=accepted.rightsBindings.find(r=>r.contentId===p.contentId&&r.assetId===p.assetId);
   if(!rights||p.sourceSha256!==hash)throw Error('Preserved media accepted ownership mismatch');
   return{contentId:p.contentId,assetId:p.assetId,rightsRef:rights.rightsId};
  });
  let disposition:Entry['disposition']=active.length?'migration-ingest-input':'unassigned-original';
  if(path==='public/images/ui/hero-workshop-stage.jpg'){
   disposition='homepage-build-input';bindings.push({contentId:'daf04736-9b1b-49c7-8942-1e1545a4b985',assetId:'home-workshop'});
  }else if(!active.length){
   const record=raw.records.find(r=>'repositoryPath'in r&&r.repositoryPath===path);
   if(record){
    disposition='replaced-original';
    for(const b of record.contentBindings){
     const replacement=accepted.processingPlan.find(p=>p.contentId===b.vNextContentId&&b.roleHints.some(role=>role===p.role));
     if(!replacement)throw Error('Preserved original replacement binding missing');
     bindings.push({contentId:b.vNextContentId,assetId:replacement.assetId,relation:'replaced-by'});
    }
   }
  }
  return{path:sourcePrefix+hash+extname(path).toLowerCase(),source:{commit:LEGACY_COMMIT,path,sha256:hash,sizeBytes:bytes.length},disposition,bindings};
 });
 return{schemaVersion:1,kind:'preserved-repository-media-inputs',entries};
}

function regularBytes(root:string,path:string):Buffer{
 let current=root;
 for(const part of path.split('/')){current=join(current,part);if(lstatSync(current).isSymbolicLink())throw Error('Preserved media symlink is forbidden');}
 const stat=lstatSync(current);
 if(!stat.isFile()||stat.nlink!==1||stat.size>2_000_000||relative(realpathSync(root),realpathSync(current)).replaceAll('\\','/')!==path)
  throw Error('Preserved media must be a bounded regular source input');
 return readFileSync(current);
}

/** Measured exact-copy relocations only. Never a generic raster or removal exemption. */
export function readPreservedMediaInputs(root:string){
 const expected=buildPreservedMediaCatalog(root);
 const actual=JSON.parse(regularBytes(root,preservedMediaCatalogPath).toString('utf8')) as unknown;
 if(fingerprint(actual)!==fingerprint(expected))throw Error('Preserved media catalog exact set/ownership mismatch');
 const byLegacyPath=new Map<string,Buffer>(),relocations=new Map<string,string>();
 for(const entry of expected.entries){
  const bytes=regularBytes(root,entry.path);
  if(bytes.length!==entry.source.sizeBytes||sha256(bytes)!==entry.source.sha256)throw Error('Preserved media input bytes mismatch: '+entry.path);
  try{lstatSync(join(root,entry.source.path));throw Error('Old root media copy must be absent after relocation');}
  catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  byLegacyPath.set(entry.source.path,bytes);relocations.set(entry.source.path,entry.path);
 }
 return{catalog:expected,byLegacyPath,relocations};
}

export function preservedMediaOutputErrors(path:string,bytes:Buffer,hashes:ReadonlySet<string>):string[]{
 if(/(?:^|[\\/])source-inputs(?:[\\/]|$)/u.test(path)||hashes.has(sha256(bytes)))return['Preserved original source input is forbidden in public output'];
 return[];
}
