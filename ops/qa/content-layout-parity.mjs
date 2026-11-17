import assert from 'node:assert/strict';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {semanticPage} from './content-layout-semantics.mjs';
const current=resolve('.'),baseline=resolve(process.argv[2]??'../site-cms-baseline-20261117');
async function htmlFiles(dir,prefix=''){const files=[];for(const item of await readdir(dir,{withFileTypes:true})){const name=prefix+item.name;if(item.isDirectory())files.push(...await htmlFiles(join(dir,item.name),name+'/'));else if(name.endsWith('.html'))files.push(name);}return files.sort();}
const beforeRoot=join(baseline,'apps/site/dist'),afterRoot=join(current,'apps/site/dist');
const before=await htmlFiles(beforeRoot),after=(await htmlFiles(afterRoot)).filter(path=>!path.startsWith('editor/'));
assert.deepEqual(after,before,'Existing page set must not change');
const sourceRevision=execFileSync('git',['rev-parse','HEAD'],{cwd:current,encoding:'utf8'}).trim();
const baselineRevision='bcc66da4ef1a1ed2683abddfb8491183a911d845';
let semanticPages=0;for(const file of before){assert.deepEqual(semanticPage(await readFile(join(afterRoot,file),'utf8'),{sourceRevision}),semanticPage(await readFile(join(beforeRoot,file),'utf8'),{sourceRevision:baselineRevision}),file);semanticPages++;}
for(const file of ['robots.txt','sitemap-index.xml','sitemap-0.xml','rss.xml','search/search-index.json']){const before=await readFile(join(beforeRoot,file),'utf8'),after=await readFile(join(afterRoot,file),'utf8');assert.equal(after,before,file);}
const oldFiles=execFileSync('git',['ls-tree','-r','--name-only','bcc66da4ef1a1ed2683abddfb8491183a911d845','apps/site/src/content'],{cwd:current,encoding:'utf8'}).trim().split('\n').filter(p=>/\.mdx?$/u.test(p));
for(const oldPath of oldFiles){const path=oldPath.replace('apps/site/src/content/blog/','content/articles/').replace('apps/site/src/content/','content/');assert.deepEqual(await readFile(join(current,path)),execFileSync('git',['show','bcc66da4ef1a1ed2683abddfb8491183a911d845:'+oldPath],{cwd:current}),path);}
const report={sourceBaseline:'bcc66da4ef1a1ed2683abddfb8491183a911d845',sourceRevision,mode:'local-built-output-comparison',result:'pass',semanticPages,byteIdenticalContentFiles:oldFiles.length,byteIdenticalDiscovery:['robots','sitemap','RSS','search index'],expectedAdditionalRoute:'/editor/'};
await mkdir(join(current,'.local/cms-validation'),{recursive:true});await writeFile(join(current,'.local/cms-validation/content-parity.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
