import {readFile,mkdir,lstat,readdir} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {blogFrontmatterSchema} from '@xpotato/content-contracts';
import {fingerprint,sha256} from '@xpotato/content-contracts/canonical';
import {deterministicBlogSocialCard,SharpCanonicalMediaProcessor,generatePublicDeliveryMaster,inspectRasterBytes} from '@xpotato/media-ingest';
import {taxonomyRegistry} from '../apps/site/src/content-registry/taxonomy/index.js';
import {noLinks,safeReadBytes,immutableBytes} from '../packages/article-pipeline/src/private-files.js';

// Local preparation only. Does not write content/registry, publish media or create admission.
const {values}=parseArgs({options:{input:{type:'string'},output:{type:'string'}}});
if(!values.input)throw Error('--input <Blog frontmatter JSON> required');
const root=process.cwd(),privateRoot=resolve(root,'.local/blog-social-cards'),output=resolve(values.output??privateRoot),rel=relative(privateRoot,output);
if(rel.startsWith('..')||isAbsolute(rel))throw Error('CARD_OUTPUT_MUST_BE_PRIVATE');
for(let p=output;;p=resolve(p,'..')){
 try{if((await lstat(p)).isSymbolicLink())throw Error('CARD_OUTPUT_LINK_DENIED');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 if(p===root)break;
 if(resolve(p,'..')===p)throw Error('CARD_OUTPUT_MUST_BE_PRIVATE');
}
const bytes=await safeReadBytes(resolve(values.input),32768);
const frontmatter=blogFrontmatterSchema.parse(JSON.parse(bytes.toString('utf8')));
const category=taxonomyRegistry.blogCategories.find(c=>c.id===frontmatter.category&&c.status==='active');
if(!category)throw Error('CARD_CATEGORY_UNKNOWN');
const card=await deterministicBlogSocialCard({repositoryRoot:root,contentId:frontmatter.id,title:frontmatter.title,categoryLabel:category.label,cardDisplay:frontmatter.cardDisplay});
const preparationSha256=fingerprint({generator:card.derivationSha256,frontmatter:fingerprint(frontmatter)});
const folder=join(output,frontmatter.id,preparationSha256);
async function safeTree(path:string){
 await noLinks(path);
 const info=await lstat(path).catch((e:NodeJS.ErrnoException)=>{if(e.code==='ENOENT')return null;throw e;});
 if(!info)return;
 if(info.isFile()&&info.nlink>1)throw Error('CARD_OUTPUT_LINK_DENIED');
 if(!info.isFile()&&!info.isDirectory())throw Error('CARD_OUTPUT_FILE_INVALID');
 if(info.isDirectory())for(const name of await readdir(path))await safeTree(join(path,name));
}
await safeTree(folder);await mkdir(folder,{recursive:true});await safeTree(folder);
const immutable=(path:string,data:Buffer|string)=>immutableBytes(path,Buffer.from(data));
const source=join(folder,'social.svg');await immutable(source,card.svg);
const ingest=await new SharpCanonicalMediaProcessor('canonical',folder).ingest({schemaVersion:1,sourcePath:source,target:{contentId:frontmatter.id,semanticAssetId:'article-social'},kind:'diagram',profileId:'canonical-raster-srgb8-lossless-webp-v1',overwrite:false});
const delivery=await generatePublicDeliveryMaster(ingest,'social-card-v1','delivery',folder);
const png=await readFile(join(folder,delivery.privateRelativePath)),meta=await inspectRasterBytes(png);
if(meta.width!==1200||meta.height!==630||meta.format!=='png'||meta.exif||meta.xmp||sha256(png)!==delivery.sha256)throw Error('CARD_PNG_INVALID');
await immutable(join(folder,'social.png'),png);
const receipt={productionEligible:false,publicationAuthorized:false,profileId:card.binding.profileId,frontmatterSha256:fingerprint(frontmatter),
 title:frontmatter.title,alt:card.alt,preparationSha256,derivationSha256:card.derivationSha256,binding:card.binding,canonical:ingest,delivery};
await immutable(join(folder,'recipe.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({folder,png:join(folder,'social.png'),sha256:delivery.sha256,width:1200,height:630,productionEligible:false}));
