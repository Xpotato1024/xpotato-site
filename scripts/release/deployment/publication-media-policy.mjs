// A projection emitted by the validated build, covered by the fixed artifact
// digest. This is not a new provider receipt or an independent rights audit.
export const publicationMediaManifestPath='_publication.json';
export {publicMediaOrigin as publicationMediaOrigin} from "../../../packages/content-contracts/src/profiles/public-media-origin.mjs";
import {publicMediaOrigin as publicationMediaOrigin} from "../../../packages/content-contracts/src/profiles/public-media-origin.mjs";
export function publicationMediaReferences(value,sourceSha){
 if(value?.protocol==='xpotato-publication-v1')value=value.media;
 const bad=()=>{throw Error('PUBLICATION_MEDIA_MANIFEST_INVALID');};
 if(!/^[a-f0-9]{40}$/.test(sourceSha)||!value||Object.keys(value).sort().join('|')!=='objects|protocol|sourceSha'
  ||value.protocol!=='xpotato-built-publication-media-v1'||value.sourceSha!==sourceSha
  ||!Array.isArray(value.objects)||value.objects.length>512)bad();
 const result=new Map();
 for(const row of value.objects){
  if(!row||Object.keys(row).sort().join('|')!=='bytes|sha256|url'||!Number.isSafeInteger(row.bytes)||row.bytes<1||row.bytes>25165824
   ||!/^[a-f0-9]{64}$/.test(row.sha256))bad();
  const extension=/\.(png|webp|avif|jpg|jpeg|svg)$/.exec(row.url??'')?.[1];
  const expected=publicationMediaOrigin+'/media/v1/objects/sha256/'+row.sha256.slice(0,2)+'/'+row.sha256+'.'+extension;
  if(!extension||row.url!==expected||result.has(row.url))bad();
  result.set(row.url,Object.freeze({...row}));
 }
 return result;
}
