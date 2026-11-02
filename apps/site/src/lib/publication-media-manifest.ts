import type {ContentMediaRegistry} from '@xpotato/content-contracts';
import {assertCompactRegistryMedia} from '@xpotato/portable-content/compact-media';
import type {PublishedMediaEvidence} from './compact-social-image.js';
import {publicationMediaOrigin,publicationMediaReferences} from '../../../../scripts/release/publication-media-policy.mjs';

export function buildPublicationMediaManifest(sourceSha:string,inputs:readonly {registry:ContentMediaRegistry;evidence:PublishedMediaEvidence}[]){
 if(!/^[a-f0-9]{40}$/u.test(sourceSha))throw Error('PUBLICATION_MEDIA_SOURCE_REQUIRED');
 const rows=new Map<string,{url:string;bytes:number;sha256:string}>();
 for(const {registry,evidence} of inputs){
  assertCompactRegistryMedia({registry,...evidence});
  for(const asset of registry.assets.filter(a=>a.status==='active'))for(const object of [asset.delivery.master,...asset.delivery.variants]){
   const row={url:publicationMediaOrigin+'/'+object.objectKey,bytes:object.sizeBytes,sha256:object.sha256};
   const previous=rows.get(row.url);
   if(previous&&JSON.stringify(previous)!==JSON.stringify(row))throw Error('PUBLICATION_MEDIA_CONFLICT');
   rows.set(row.url,row);
  }
 }
 const manifest={protocol:'xpotato-built-publication-media-v1',sourceSha,objects:[...rows.values()].sort((a,b)=>a.url.localeCompare(b.url))};
 publicationMediaReferences(manifest,sourceSha);
 return manifest;
}
