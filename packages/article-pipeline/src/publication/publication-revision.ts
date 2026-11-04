import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {articleRoute,publicationRevisionSchema,publicationProvenanceRecordSchema,contentMediaRegistrySchema,mediaRightsRecordSchema,type PublicationRevision} from '@xpotato/content-contracts';
import {assertCompactRegistryMedia} from '@xpotato/portable-content/compact-media';
import {splitDraft,type DraftRepository} from '../draft-job.js';
import {fingerprint,sha256} from '../canonical.js';
import {assertPublicPublicationMetadata,assertPublicationRights} from './publication-public-metadata.js';

export function revisionPaths(id:string,fileSlug:string){return {
 mdx:'apps/site/src/content/blog/'+fileSlug+'.mdx',
 media:'apps/site/src/content-registry/media/blog/'+id+'.json',
 rights:'apps/site/src/content-registry/media-rights/blog/'+id+'.json',
 provenance:'apps/site/src/content-registry/provenance/blog/'+id+'.json',
};}
export function readPreviousPublication(id:string,fileSlug:string,base:Readonly<Record<string,string|null>>){
 const paths=revisionPaths(id,fileSlug),text=(path:string)=>{const t=base[path];if(typeof t!=='string')throw Error('CI_UPDATE_BASE_REQUIRED');return t;};
 const mdx=text(paths.mdx),fm=splitDraft(mdx).frontmatter;
 const registry=contentMediaRegistrySchema.parse(JSON.parse(text(paths.media)));
 const rights=mediaRightsRecordSchema.array().parse(JSON.parse(text(paths.rights)));
 const provenance=publicationProvenanceRecordSchema.parse(JSON.parse(text(paths.provenance)));
 if(fm.id!==id||fm.draft||registry.contentId!==id||provenance.contentId!==id||provenance.origin!=='article_job'
  ||provenance.content.route!==articleRoute(id)||provenance.content.mdxSha256!==sha256(mdx)
  ||provenance.content.frontmatterSha256!==fingerprint(fm)||!provenance.mediaRecovery)throw Error('CI_UPDATE_PUBLISHED_BASE_REQUIRED');
 assertPublicationRights(rights);assertCompactRegistryMedia({registry,rights,provenance});
 assertPublicPublicationMetadata({registry,rights,provenance});
 return {fm,registry,rights,provenance,binding:{fileSlug,route:provenance.content.route,pubDate:fm.pubDate,
  ...(fm.updatedDate?{updatedDate:fm.updatedDate}:{}),mdxSha256:sha256(mdx),mediaSha256:sha256(text(paths.media)),
  rightsSha256:sha256(text(paths.rights)),provenanceSha256:sha256(text(paths.provenance)),mediaRecoverySha256:fingerprint(provenance.mediaRecovery)}};
}
export function preparePublicationRevision(repo:DraftRepository,id:string,kind:unknown){
 const records=repo.records.filter(r=>r.contentId===id);
 if(records.length!==1||records[0]!.collection!=='blog')throw Error('CI_UPDATE_CONTENT_OWNERSHIP');
 const record=records[0]!,paths=revisionPaths(id,record.slug),base={...repo.registrySnapshot,[paths.mdx]:record.source};
 const previous=readPreviousPublication(id,record.slug,base);
 if(record.sourceSha256!==sha256(record.source)||record.route!==previous.binding.route)throw Error('CI_UPDATE_BASE_CONFLICT');
 return publicationRevisionSchema.parse({kind,previous:{commit:repo.commit,...previous.binding}});
}
export function assertPublicationRevisionBase(id:string,revision:PublicationRevision,repo:DraftRepository,base:Readonly<Record<string,string|null>>){
 const r=publicationRevisionSchema.parse(revision),records=repo.records.filter(row=>row.contentId===id);
 if(records.length!==1||records[0]!.collection!=='blog'||records[0]!.slug!==r.previous.fileSlug||records[0]!.route!==r.previous.route)throw Error('CI_UPDATE_CONTENT_OWNERSHIP');
 const paths=revisionPaths(id,r.previous.fileSlug),record=records[0]!;
 if(base[paths.mdx]!==record.source||record.sourceSha256!==sha256(record.source)
  ||[paths.media,paths.rights,paths.provenance].some(p=>typeof repo.registrySnapshot[p]!=='string'||repo.registrySnapshot[p]!==base[p]))throw Error('CI_UPDATE_BASE_CONFLICT');
 const previous=readPreviousPublication(id,r.previous.fileSlug,base),{commit:_commit,...expected}=r.previous;
 if(fingerprint(previous.binding)!==fingerprint(expected))throw Error('CI_UPDATE_BASE_CONFLICT');
 return previous;
}
/** Read only the exact four public preimages in the approved immutable ancestor.
 * No network, credential, repository mutation, or unbounded Git output. */
export function assertPublicationRevisionGit(root:string,currentCommit:string,id:string,revision:PublicationRevision){
 const r=publicationRevisionSchema.parse(revision),repository=resolve(root);
 if(!/^[a-f0-9]{40}$/u.test(currentCommit))throw Error('CI_UPDATE_GIT_BASE_REQUIRED');
 const git=(...args:string[])=>execFileSync('git',['-c','core.fsmonitor=false','-C',repository,...args],
  {encoding:'utf8',maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe'],env:{...process.env,GIT_NO_REPLACE_OBJECTS:'1',GIT_OPTIONAL_LOCKS:'0'}});
 try{
  if(resolve(git('rev-parse','--show-toplevel').trim())!==repository||git('rev-parse','HEAD').trim()!==currentCommit)throw Error();
  git('merge-base','--is-ancestor',r.previous.commit,currentCommit);
  for(const [key,path]of Object.entries(revisionPaths(id,r.previous.fileSlug))){
   const expected=r.previous[(key+'Sha256') as 'mdxSha256'|'mediaSha256'|'rightsSha256'|'provenanceSha256'];
   if(sha256(git('show',r.previous.commit+':'+path))!==expected)throw Error();
  }
 }catch{throw Error('CI_UPDATE_GIT_BASE_CONFLICT');}
}
