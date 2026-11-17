import assert from 'node:assert/strict';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {parse} from 'parse5';
const current=resolve('.'),baseline=resolve(process.argv[2]??'../site-cms-baseline-20261117');
async function htmlFiles(dir,prefix=''){const files=[];for(const item of await readdir(dir,{withFileTypes:true})){const name=prefix+item.name;if(item.isDirectory())files.push(...await htmlFiles(join(dir,item.name),name+'/'));else if(name.endsWith('.html'))files.push(name);}return files.sort();}
const text=node=>('value'in node?node.value:'childNodes'in node?node.childNodes.map(text).join(''):'').replace(/\s+/gu,' ').trim();
function semantic(html){const result={titles:[],metadata:[],canonicals:[],headings:[],links:[],media:[],structuredData:[],main:[]};
 const walk=(node,inFooter=false)=>{inFooter=inFooter||('tagName'in node&&node.tagName==='footer');if('tagName'in node){const attr=name=>node.attrs.find(a=>a.name===name)?.value;
 if(node.tagName==='title')result.titles.push(text(node));
 if(node.tagName==='meta'&&(attr('name')||attr('property'))&&!/revision|build/u.test(attr('name')??''))result.metadata.push([attr('name')??attr('property'),attr('content')]);
 if(node.tagName==='link'&&attr('rel')==='canonical')result.canonicals.push(attr('href'));
 if(/^h[1-6]$/u.test(node.tagName))result.headings.push([node.tagName,attr('id')??'',text(node)]);
 if(node.tagName==='a'){const href=attr('href')??'';result.links.push(inFooter&&/^https:\/\/github\.com\/Xpotato1024\/xpotato-site\/commit\/[a-f0-9]{40}$/u.test(href)?['generated-site-revision', 'generated-site-revision']:[href,text(node)]);}
 if(['img','source'].includes(node.tagName)){const ref=attr('srcset')??attr('src')??'';if(/assets\.xpotato\.net|\/images\/|\/media\//u.test(ref))result.media.push([ref,attr('alt')??'',attr('width')??'',attr('height')??'']);}
 if(node.tagName==='script'&&attr('type')==='application/ld+json')result.structuredData.push(JSON.parse(text(node)));
 if(node.tagName==='main')result.main.push(text(node));
 }if('childNodes'in node)for(const child of node.childNodes)walk(child,inFooter);};walk(parse(html));return result;}
const beforeRoot=join(baseline,'apps/site/dist'),afterRoot=join(current,'apps/site/dist');
const before=await htmlFiles(beforeRoot),after=(await htmlFiles(afterRoot)).filter(path=>!path.startsWith('editor/'));
assert.deepEqual(after,before,'Existing page set must not change');
let semanticPages=0;for(const file of before){assert.deepEqual(semantic(await readFile(join(afterRoot,file),'utf8')),semantic(await readFile(join(beforeRoot,file),'utf8')),file);semanticPages++;}
for(const file of ['robots.txt','sitemap-index.xml','sitemap-0.xml','rss.xml','search/search-index.json']){const before=await readFile(join(beforeRoot,file),'utf8'),after=await readFile(join(afterRoot,file),'utf8');assert.equal(after,before,file);}
const oldFiles=execFileSync('git',['ls-tree','-r','--name-only','bcc66da4ef1a1ed2683abddfb8491183a911d845','apps/site/src/content'],{cwd:current,encoding:'utf8'}).trim().split('\n').filter(p=>/\.mdx?$/u.test(p));
for(const oldPath of oldFiles){const path=oldPath.replace('apps/site/src/content/blog/','content/articles/').replace('apps/site/src/content/','content/');assert.deepEqual(await readFile(join(current,path)),execFileSync('git',['show','bcc66da4ef1a1ed2683abddfb8491183a911d845:'+oldPath],{cwd:current}),path);}
const report={sourceBaseline:'bcc66da4ef1a1ed2683abddfb8491183a911d845',mode:'local-built-output-comparison',result:'pass',semanticPages,byteIdenticalContentFiles:oldFiles.length,byteIdenticalDiscovery:['robots','sitemap','RSS','search index'],expectedAdditionalRoute:'/editor/'};
await mkdir(join(current,'.local/cms-validation'),{recursive:true});await writeFile(join(current,'.local/cms-validation/content-parity.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
