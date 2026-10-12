import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,mkdtemp,stat,realpath,readdir} from 'node:fs/promises';
import {dirname,join,resolve,sep,isAbsolute,extname,relative} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

// Optional final-dist consumer: collect only. Never builds, asserts scores, uploads or runs an LHCI server.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'), dist=await realpath(join(root,'apps/site/dist'));
const report=process.env.XPOTATO_LIGHTHOUSE_REPORT;
if(!report||!isAbsolute(report))throw Error('XPOTATO_LIGHTHOUSE_REPORT absolute output directory required');
const withinTemp=relative(resolve(process.env.RUNNER_TEMP??tmpdir()),resolve(report));
if(!withinTemp||withinTemp.startsWith('..')||isAbsolute(withinTemp))throw Error('Lighthouse reports must remain under task/runner temp, outside final dist');
await mkdir(report,{recursive:true});
const work=await mkdtemp(join(report,'run-'));
const headers=Object.fromEntries((await readFile(join(dist,'_headers'),'utf8')).split('\n').filter(l=>/^\s+[^:]+:/.test(l)).map(l=>{const i=l.indexOf(':');return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{try{
  const pathName=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathName.split('/').some(p=>p.startsWith('.')||['_headers','_redirects'].includes(p)))throw Error('Denied');
  let path=resolve(dist,'.'+pathName);if(!path.startsWith(dist+sep)&&path!==dist)throw Error('Escape');
  if((await stat(path)).isDirectory())path=join(path,'index.html');path=await realpath(path);if(!path.startsWith(dist+sep))throw Error('Escape');
  res.writeHead(200,{...headers,'Content-Type':mime[extname(path)]??'application/octet-stream'});res.end(await readFile(path));
}catch{res.writeHead(404);res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
try{
  const origin='http://127.0.0.1:'+server.address().port;
  const config={ci:{collect:{url:['/','/notes/wordpress-migration-playbook/','/tools/prime-factorizer/'].map(r=>origin+r),numberOfRuns:1,...(process.env.CHROME_PATH?{chromePath:process.env.CHROME_PATH}:{}),settings:{chromeFlags:'--headless=new --no-sandbox --disable-dev-shm-usage --disable-background-networking',onlyCategories:['performance','accessibility','best-practices','seo']}}}};
  await writeFile(join(work,'lhci.json'),JSON.stringify(config,null,2));
  const code=await new Promise((resolveRun,reject)=>{const child=spawn(process.execPath,[join(root,'node_modules/@lhci/cli/src/cli.js'),'collect','--config='+join(work,'lhci.json')],{cwd:work,stdio:'inherit',windowsHide:true,env:{...process.env,LHCI_BUILD_CONTEXT__CURRENT_HASH:process.env.RELEASE_SOURCE_SHA??'local-review'}});child.on('error',reject);child.on('exit',resolveRun)});
  if(code!==0)throw Error('Optional Lighthouse collection failed: '+code);
  const rows=[];
  for(const file of await readdir(join(work,'.lighthouseci')))if(file.endsWith('.json')&&file.startsWith('lhr-')){
    const result=JSON.parse(await readFile(join(work,'.lighthouseci',file),'utf8'));
    rows.push({route:new URL(result.finalDisplayedUrl??result.finalUrl).pathname,lighthouseVersion:result.lighthouseVersion,scores:Object.fromEntries(Object.entries(result.categories).map(([key,value])=>[key,value.score])),lcpMs:result.audits['largest-contentful-paint'].numericValue,cls:result.audits['cumulative-layout-shift'].numericValue,runWarnings:result.runWarnings});
  }
  await writeFile(join(report,'summary.json'),JSON.stringify({schemaVersion:1,status:'REPORT_ONLY',buildCount:0,uploadCount:0,source:process.env.RELEASE_SOURCE_SHA??'local working tree',reports:rows,limitations:'One lab run per public route; nonblocking, no field p75/INP/conformance claim; raw reports remain local/authorized CI artifact only'},null,2)+'\n');
  console.log('Lighthouse supplementary report: '+rows.length+' routes; uploads=0, builds=0, score gate=none');
}finally{await new Promise(r=>server.close(r))}
