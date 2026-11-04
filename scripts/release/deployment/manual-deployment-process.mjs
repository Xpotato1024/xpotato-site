import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {authority} from './deployment-policy.mjs';
import {stop,uuid} from './manual-deployment-provider.mjs';
// Captured tool output is never forwarded to logs or errors.
export function executeCaptured(command,args,{env,cwd,timeoutMs=120000,spawnImpl=spawn}={}) {
  return new Promise((resolve,reject)=>{
    let child,output='',size=0,finished=false,timer;
    const kill=()=>{try{if(process.platform==='win32')spawn('taskkill.exe',['/pid',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else child.kill('SIGKILL');}catch{}};
    const fail=()=>{if(finished)return;finished=true;clearTimeout(timer);kill();reject(new Error('CAPTURED_TOOL_FAILED'));};
    try {child=spawnImpl(command,args,{env,cwd,shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});}
    catch {reject(new Error('CAPTURED_TOOL_FAILED'));return;}
    timer=setTimeout(fail,timeoutMs);
    child.on('error',fail);
    child.stdout.on('data',bytes=>{size+=bytes.length;if(size>1048576)fail();else output+=bytes.toString('utf8');});
    child.stderr.on('data',bytes=>{size+=bytes.length;if(size>1048576)fail();});
    child.on('close',exitCode=>{if(finished)return;finished=true;clearTimeout(timer);resolve({exitCode,output});});
  });
}
export function cleanToolEnvironment(env,extras={}) {
  const result={};
  for(const key of ['SystemRoot','SYSTEMROOT','WINDIR','PATH','Path','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA'])if(typeof env[key]==='string')result[key]=env[key];
  return {...result,CI:'true',WRANGLER_SEND_METRICS:'false',NO_COLOR:'1',...extras};
}
export function createWranglerDeploy({toolRoot,env,context,execute=executeCaptured}) {
  let invoked=false;
  return async targets=>{
    if(invoked)stop('DEPLOY_ALREADY_ATTEMPTED');invoked=true;
    const pkg=JSON.parse(await readFile(join(toolRoot,'node_modules/wrangler/package.json'),'utf8'));
    if(pkg.version!==authority.wrangler)stop('WRANGLER_VERSION_MISMATCH');
    const result=await execute(process.execPath,[join(toolRoot,'node_modules/wrangler/bin/wrangler.js'),'deploy','--config',targets.configPath],{cwd:toolRoot,env:cleanToolEnvironment(env,{CLOUDFLARE_API_TOKEN:env.CLOUDFLARE_SITE_API_TOKEN,CLOUDFLARE_ACCOUNT_ID:context.accountId})});
    const matches=[...result.output.matchAll(/Current Version ID:\s*([a-f0-9-]{36})/g)];
    if(result.exitCode!==0||matches.length!==1||!uuid(matches[0][1]))stop('DEPLOY_RECEIPT_UNKNOWN');
    return {count:1,exitCode:0,versionId:matches[0][1]};
  };
}
