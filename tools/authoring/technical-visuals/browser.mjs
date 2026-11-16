import {spawn} from 'node:child_process';
import {openSync,closeSync} from 'node:fs';
import {readFile,writeFile,access} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {chromium} from 'playwright';
import {prepareBrowserStorage,cleanupBrowserStorage} from './browser-storage.mjs';
import {finishBrowserRuntime} from './browser-cleanup.mjs';
import {observeChromeProcess,waitForChromePage} from '../../qa/chrome-page-ready.mjs';

async function waitForChild(child,exited,ms){
  if(child.exitCode!==null||child.signalCode!==null)return;
  let timer;
  try{await Promise.race([exited,new Promise(resolve=>{timer=setTimeout(resolve,ms);})]);}
  finally{clearTimeout(timer);}
}
/** Dedicated local browser. The OS sandbox stays enabled; no inherited user profile. */
export async function localBrowser(runtime){
  const candidates=[process.env.CHROME_PATH,...(process.platform==='win32'?
    ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']:
    ['/usr/bin/google-chrome','/usr/bin/chromium'])].filter(Boolean);
  let executable;
  for(const candidate of candidates){if(!isAbsolute(candidate))throw Error('CHROME_PATH must be absolute');try{await access(candidate);executable=candidate;break;}catch{}}
  if(!executable)throw Error('Installed Chrome required; set CHROME_PATH to its absolute executable');
  const storage=await prepareBrowserStorage(runtime),{profile}=storage,log=join(runtime,'browser.log');
  let logFd,child,browser,exited,closing;
  const binding=()=>({pid:child.pid,profile,storage:{root:storage.root,profile,temporary:storage.temporary,token:storage.token,runtime},ownedGroup:process.platform==='linux'});
  const close=()=>closing??=(async()=>{
    if(browser){
      try{const session=await browser.newBrowserCDPSession();await session.send('Browser.close');}catch{}
      await browser.close().catch(()=>{});
    }
    if(child?.pid){
      await waitForChild(child,exited,5000);
      const result=await finishBrowserRuntime(binding());
      return {mode:result.forced?'forced-owned-tree':'graceful',processExited:true,storageRemoved:true};
    }
    await cleanupBrowserStorage(storage);
    return {mode:'not-started',processExited:true,storageRemoved:true};
  })();
  try{
    logFd=openSync(log,'wx');
    child=spawn(executable,['--headless=new','--disable-gpu','--disable-background-networking','--disable-extensions',
      '--disable-component-update','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',
      '--remote-debugging-address=127.0.0.1','--user-data-dir='+profile,'--renderer-process-limit=2',
      '--js-flags=--max-old-space-size=192','about:blank'],{stdio:['ignore',logFd,logFd],windowsHide:true,
      env:storage.environment,detached:process.platform==='linux'});
    const processState=observeChromeProcess(child);
    exited=new Promise(resolve=>child.once('exit',resolve));
    closeSync(logFd);logFd=undefined;
    await writeFile(join(runtime,'browser.json'),JSON.stringify(binding()),{flag:'wx'});
    const {port}=await waitForChromePage({profile,processState,timeoutMs:15000});
    browser=await chromium.connectOverCDP('http://127.0.0.1:'+port,{timeout:5000});
    return {browser,close,pid:child.pid};
  }catch(error){
    const detail=(await readFile(log,'utf8').catch(()=>'')).slice(-1800);
    try{await close();}catch(cleanup){throw new AggregateError([error,cleanup],'Browser startup and cleanup failed: '+error.message+'; '+detail);}
    throw Error(error.message+(detail?' Browser log: '+detail:''));
  }finally{if(logFd!==undefined)closeSync(logFd);}
}
