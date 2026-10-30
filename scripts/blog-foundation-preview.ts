import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {taxonomyRegistry} from '../apps/site/src/content-registry/taxonomy/index.js';
import {fixture} from '../tests/fixtures/blog-foundation/social-evidence.js';
import {deterministicBlogSocialCard,SharpCanonicalMediaProcessor,generatePublicDeliveryMaster} from '@xpotato/media-ingest';
import {readFile} from 'node:fs/promises';
import {articleRoute} from '@xpotato/content-contracts';
import {articleMediaTargets} from '@xpotato/content-contracts/article-media-targets';

// Isolated synthetic projection of the real templates; never writes the production content tree.
const repo=fileURLToPath(new URL('../',import.meta.url)),root=join(repo,'apps/site/.local/blog-public-projection-id-v1');
await mkdir(join(root,'src/pages/articles'),{recursive:true});
for(const collection of ['blog','notes','projects','tools','pages'])await mkdir(join(root,'src/content',collection),{recursive:true});
const local=(path:string)=>join(repo,path).replaceAll('\\','/');
const q=JSON.stringify;
const child=(id:string,parentId:string,label:string)=>({...taxonomyRegistry.blogCategories[0]!,id,slug:id,parentId,label});
const taxonomy={...taxonomyRegistry,blogCategories:[...taxonomyRegistry.blogCategories,child('electronics','robotics','電子工作'),child('boards','electronics','制御基板')],tags:[...taxonomyRegistry.tags,{...taxonomyRegistry.tags[0]!,id:'metadata-only',slug:'metadata-only',label:'属性のみ',archive:false}]};
const sampleTitle='分類とSNS表示を確認する合成記事',sampleDisplay={lines:['分類とSNS表示を','確認する合成記事']};
const mediaFolder=join(root,'social-card');await mkdir(mediaFolder,{recursive:true});
const standard=await deterministicBlogSocialCard({repositoryRoot:repo,contentId:fixture().registry.contentId,title:sampleTitle,categoryLabel:'制御基板',cardDisplay:sampleDisplay});
const standardSource=join(mediaFolder,'social.svg');await writeFile(standardSource,standard.svg);
const canonical=await new SharpCanonicalMediaProcessor('canonical',mediaFolder).ingest({schemaVersion:1,sourcePath:standardSource,target:{contentId:standard.binding.contentId,semanticAssetId:'social'},kind:'diagram',profileId:'canonical-raster-srgb8-lossless-webp-v1',overwrite:false});
const standardPng=await generatePublicDeliveryMaster(canonical,'social-card-v1','delivery',mediaFolder);
const media=fixture({sha256:standardPng.sha256,sizeBytes:standardPng.sizeBytes,canonicalSha256:canonical.canonicalMaster.sha256,canonicalSizeBytes:canonical.canonicalMaster.sizeBytes,alt:standard.alt});
const swaps:Record<string,string>={};
for(const [name,source] of Object.entries({
 'content-registry/taxonomy/index.js':`export const taxonomyRegistry=${q(taxonomy)};`,
 'content-registry/media/index.js':`export const mediaRegistries=${q([media.registry])};`,
 'content-registry/media-evidence/index.js':`export const publishedMediaEvidence=${q({[media.registry.contentId]:media.evidence})};`,
})){const target=join(root,name.replaceAll('/','-')+'.ts');await writeFile(target,source);swaps[name]=target;}
const require=createRequire(join(repo,'apps/site/package.json'));
const resolve=(name:string)=>pathToFileURL(require.resolve(name)).href;
const config=`import {defineConfig} from ${q(resolve('astro/config'))};import mdx from ${q(resolve('@astrojs/mdx'))};import tw from ${q(resolve('@tailwindcss/vite'))};import {routeFontIntegration} from ${q(pathToFileURL(join(repo,'apps/site/src/lib/font-subsets.mjs')).href)};const swaps=${q(swaps)};export default defineConfig({root:${q(root)},site:'https://xpotato.net/',output:'static',publicDir:${q(join(repo,'apps/site/public'))},outDir:${q(join(root,'output'))},integrations:[mdx(),routeFontIntegration()],vite:{plugins:[{name:'isolated-synthetic-registry',enforce:'pre',resolveId(source){for(const [suffix,target]of Object.entries(swaps))if(source.endsWith(suffix))return target;}},tw()],ssr:{noExternal:['@xpotato/content-contracts','@xpotato/portable-content']}}});`;
await writeFile(join(root,'astro.config.mjs'),config);
await writeFile(join(root,'package.json'),'{"private":true,"type":"module"}');
const schemas=['blogFrontmatterSchema','noteFrontmatterSchema','projectFrontmatterSchema','toolFrontmatterSchema','pageFrontmatterSchema'];
await writeFile(join(root,'src/content.config.ts'),`import {defineCollection} from 'astro:content';import {glob} from 'astro/loaders';import {${schemas.join(',')}} from '@xpotato/content-contracts';export const collections={${['blog','notes','projects','tools','pages'].map((name,i)=>`${name}:defineCollection({loader:glob({pattern:'**/*.mdx',base:${q(join(root,'src/content',name))}}),schema:${schemas[i]}})`).join(',')}};`);
await writeFile(join(root,'src/pages/articles/[...slug].astro'),`---\nimport Target,{getStaticPaths as paths} from ${q(local('apps/site/src/pages/articles/[...slug].astro'))};export const getStaticPaths=paths;\n---\n<Target {...Astro.props}/>\n`);
await writeFile(join(root,'src/pages/articles/index.astro'),`---\nimport Target from ${q(local('apps/site/src/pages/articles/index.astro'))};\n---\n<Target/>\n`);
for(let i=0;i<16;i++){
 const slug=i===0?'sample':i===13?'noindex':i===14?'held':i===15?'fdm-strength-settings':`sample-${i}`;
 const id=i===0?media.registry.contentId:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`;
 const fm={id,title:i===0?sampleTitle:i===15?'3Dプリンタの形状と設定を考える合成記事':`合成記事 ${i}`,description:'テンプレートの検証用です。公開記事ではありません。',pubDate:'2026-10-29',category:i===15?'3d-printing':'boards',tags:i===15?['fdm','design','troubleshooting']:['rust','metadata-only'],draft:i===14,...(i===0?{cardDisplay:sampleDisplay,seo:{canonicalOverride:'https://xpotato.net/articles/canonical-target/',titleOverride:'検索向けの一行タイトル'}}:i===13?{seo:{noindex:true}}:{})};
 const body=Array.from({length:3},(_,n)=>`## 検証の章 ${n+1}\n\n${'表示と導線を確認するための合成文章です。'.repeat(30)}\n\n### 小見出し ${n+1}\n\nこれはfixtureです。`).join('\n\n');
 await writeFile(join(root,'src/content/blog',slug+'.mdx'),'---\n'+Object.entries(fm).map(([key,value])=>key+': '+q(value)).join('\n')+'\n---\n\n'+body);
}
await writeFile(join(root,'src/pages/articles/canonical-target.astro'),`---\nimport {getCollection} from 'astro:content';import BlogDetail from ${q(local('apps/site/src/components/content/BlogDetail.astro'))};const entry=(await getCollection('blog')).find(e=>e.id==='sample');if(!entry)throw Error('fixture missing');\n---\n<BlogDetail entry={entry}/>\n`);
const {build}=await import(resolve('astro'));
await build({root,configFile:'astro.config.mjs'});
await writeFile(join(root,'output/__fixture-social.png'),await readFile(join(mediaFolder,standardPng.privateRelativePath)));
await writeFile(join(root,'output/__fixture-social.json'),JSON.stringify({title:sampleTitle,seoTitle:'検索向けの一行タイトル',alt:standard.alt,sha256:standardPng.sha256,routes:{sample:articleRoute(media.registry.contentId),noindex:articleRoute('00000000-0000-4000-8000-000000000013'),held:articleRoute('00000000-0000-4000-8000-000000000014'),selected:articleRoute('00000000-0000-4000-8000-000000000015')},url:new URL(media.registry.assets[0]!.delivery.master.objectKey,articleMediaTargets.publicOrigin).href}));
await writeFile(join(root,'output/.private-draft-preview'),'xpotato-private-draft-preview-v1\nsynthetic projection; productionEligible=false\n');
await writeFile(join(root,'verification-input.json'),JSON.stringify({productionEligible:false,scope:'synthetic_public_projection',root,output:join(root,'output')},null,2));
console.log(root);
