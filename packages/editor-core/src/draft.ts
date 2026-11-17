import {parseDocument, stringify, type Document} from 'yaml';
import {articleUrlId} from '@xpotato/content-contracts/article-route';
import {contentIdSchema, type ContentCollection} from '@xpotato/content-contracts/common';
import {blogSourceFrontmatterSchema, noteFrontmatterSchema, projectFrontmatterSchema, toolFrontmatterSchema, pageFrontmatterSchema} from '@xpotato/content-contracts/content';
import {validatePortableMdx} from '@xpotato/portable-content';
export const collectionDirectories = Object.freeze({blog:'articles',notes:'notes',projects:'projects',tools:'tools',pages:'pages'});
export const draftByteLimit = 512 * 1024;
export interface DraftMetadata {id:string; title:string; description:string; draft:boolean; category?:string; subject?:string; tags?:string[]; pubDate?:string; updatedDate?:string; [key:string]:unknown}
export interface ParsedDraft { data:DraftMetadata; body:string; header:string; newline:string; source:string }
export interface TaxonomySnapshot {contractVersion:1; categories:Record<string,string[]>; tags:string[]; modules:string[]; labels?:Record<string,string>}
export function parseDraft(source:string):ParsedDraft {
 if(new TextEncoder().encode(source).byteLength>draftByteLimit)throw Error('DRAFT_TOO_LARGE');
 const match=/^(?:\uFEFF)?---(\r?\n)([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(source);
 if(!match)throw Error('FRONTMATTER_REQUIRED');
 const doc=parseDocument(match[2]!,{uniqueKeys:true});
 if(doc.errors.length)throw Error('FRONTMATTER_INVALID');
 const data=doc.toJS({maxAliasCount:0}) as DraftMetadata;
 if(!data||Array.isArray(data)||typeof data!=='object')throw Error('FRONTMATTER_INVALID');
 contentIdSchema.parse(data.id);
 return {data,body:source.slice(match[0].length),header:match[2]!,newline:match[1]!,source};
}
export function updateDraft(source:string, fields:Partial<DraftMetadata>, body?:string):string {
 const parsed=parseDraft(source);if(fields.id!==undefined&&fields.id!==parsed.data.id)throw Error('CONTENT_ID_IMMUTABLE');
 const doc=parseDocument(parsed.header,{uniqueKeys:true});
 for(const [key,value] of Object.entries(fields))value===undefined?doc.delete(key):doc.set(key,value);
 const header=doc.toString({lineWidth:0}).replace(/\r?\n$/u,'');
 return '---'+parsed.newline+header.replace(/\r?\n/gu,parsed.newline)+parsed.newline+'---'+parsed.newline+(body??parsed.body);
}
export function createDraft(title:string,category:string,id=crypto.randomUUID()):string {
 contentIdSchema.parse(id);
 return '---\n'+stringify({id,title:title.trim()||'無題の記事',description:'',category,tags:[],draft:true},{lineWidth:0})+'---\n\n';
}
export function validateDraft(source:string,collection:ContentCollection,taxonomy?:TaxonomySnapshot):string[] {
 try {
  const {data,body}=parseDraft(source);
  const schemas={blog:blogSourceFrontmatterSchema,notes:noteFrontmatterSchema,projects:projectFrontmatterSchema,tools:toolFrontmatterSchema,pages:pageFrontmatterSchema};
  const parsed=schemas[collection].safeParse(data);
  const errors=parsed.success?[]:parsed.error.issues.map(i=>i.path.join('.')+': '+i.message);
  errors.push(...validatePortableMdx(body));
  if(taxonomy){
   if(taxonomy.contractVersion!==1)errors.push('EDITOR_CONTRACT_VERSION_UNSUPPORTED');
   const category=collection==='notes'?data.subject:data.category;
   if(category&&!(taxonomy.categories[collection]??[]).includes(category))errors.push('CATEGORY_UNKNOWN');
   for(const tag of data.tags??[])if(!taxonomy.tags.includes(tag))errors.push('TAG_UNKNOWN: '+tag);
  }
  return errors;
 }catch(e){return [e instanceof Error?e.message:'DRAFT_INVALID'];}
}
export function draftPath(id:string):string { return 'content/articles/'+articleUrlId(id)+'.mdx'; }
export function assertEditablePath(value:string):void {
 if(!/^content\/(articles|notes|projects|tools|pages)\/[a-z0-9][a-z0-9_-]*\.mdx?$/u.test(value))throw Error('CONTENT_PATH_NOT_ALLOWED');
}
export function collectionFromPath(value:string):ContentCollection {
 assertEditablePath(value);const directory=value.split('/')[1]!;
 return (Object.keys(collectionDirectories) as ContentCollection[]).find(k=>collectionDirectories[k]===directory)!;
}
export function documentHandoff(source:string,commit:string,sourcePath:string){
 const {data}=parseDraft(source);assertEditablePath(sourcePath);
 if(!/^[a-f0-9]{40}$/u.test(commit))throw Error('COMMIT_REQUIRED');
 return {schemaVersion:1 as const,contentId:data.id,sourcePath,commit,bodySource:'git' as const,publicationAuthorized:false as const};
}
