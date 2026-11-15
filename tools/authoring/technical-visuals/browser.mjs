import {spawn} from 'node:child_process';
import {openSync,closeSync} from 'node:fs';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {chromium} from 'playwright';

const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
/** Dedicated local browser, with no inherited user profile and no pipe transport. */
export async function localBrowser(runtime) {
  const candidates = [process.env.CHROME_PATH, ...(process.platform === 'win32' ?
    ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'] :
    ['/usr/bin/google-chrome','/usr/bin/chromium'])].filter(Boolean);
  let executable;
  for (const candidate of candidates) {if (!isAbsolute(candidate)) throw Error('CHROME_PATH must be absolute');try {await access(candidate);executable=candidate;break;} catch {}}
  if (!executable) throw Error('Installed Chrome required; set CHROME_PATH to its absolute executable');
  const profile=join(runtime,'browser-profile');await mkdir(profile,{mode:0o700});
  const log=join(runtime,'browser.log'),logFd=openSync(log,'wx');
  const child=spawn(executable,['--headless=new','--disable-gpu','--disable-background-networking','--disable-extensions',
    '--disable-component-update','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',
    '--remote-debugging-address=127.0.0.1','--user-data-dir='+profile,'--renderer-process-limit=2',
    '--js-flags=--max-old-space-size=192','about:blank'],{stdio:['ignore',logFd,logFd],windowsHide:true,
    env:{...process.env,TEMP:runtime,TMP:runtime,TMPDIR:runtime}});
  closeSync(logFd);
  let spawnError;child.on('error',error=>{spawnError=error;});
  const exited=new Promise(resolve=>child.once('exit',resolve));
  await writeFile(join(runtime,'browser.json'),JSON.stringify({pid:child.pid,profile}),{flag:'wx'});
  let browser,cleanupResult;
  const close = async () => {
    if(cleanupResult)return cleanupResult;
    let mode="graceful";
    if (browser) {
      try {const session=await browser.newBrowserCDPSession();await session.send('Browser.close');} catch {}
      await browser.close().catch(()=>{});
    }
    if (child.exitCode === null && child.signalCode === null) {
      const ended=await Promise.race([exited.then(()=>true),delay(15000).then(()=>false)]);
      if (!ended) {
        // The spawned child handle is still live. Stop only this dedicated process tree.
        mode='forced-owned-tree';
        if(process.platform==='win32') {
          const cleanup=spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});
          const timer=setTimeout(()=>cleanup.kill(),5000);
          try {await new Promise((yes,no)=>{cleanup.once('error',no);cleanup.once('exit',yes);});} finally {clearTimeout(timer);}
        } else child.kill('SIGKILL');
        if(child.exitCode===null&&child.signalCode===null && !await Promise.race([exited.then(()=>true),delay(5000).then(()=>false)]))throw Error('Dedicated browser cleanup not verified (PID '+child.pid+')');
      }
    }
    cleanupResult={mode,processExited:true};return cleanupResult;
  };
  try {
    for (let attempt=0;attempt<150;attempt++) {
      if (spawnError) throw spawnError;
      if (child.exitCode !== null) throw Error('Browser exited before DevTools was ready ('+child.exitCode+'): '+(await readFile(log,'utf8')).slice(-1400));
      let port;
      try {port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];} catch {}
      if (/^\d+$/u.test(port ?? '')) {browser=await chromium.connectOverCDP('http://127.0.0.1:'+port,{timeout:5000});break;}
      await delay(100);
    }
    if (!browser) throw Error('Local browser startup timeout');
    return {browser,close,pid:child.pid};
  } catch (error) {await close();throw error;}
}
