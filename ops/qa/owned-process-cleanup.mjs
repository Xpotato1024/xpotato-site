import {execFileSync} from 'node:child_process';
/** Only accepts the ChildProcess created by this suite. A raced exit is not a cleanup failure. */
export async function stopOwnedProcess(child,{platform=process.platform,killTree=pid=>execFileSync('taskkill',['/PID',String(pid),'/T','/F'],{stdio:'ignore',windowsHide:true}),exists=pid=>{try{process.kill(pid,0);return true;}catch(error){if(error.code==='ESRCH')return false;throw error;}},settle=()=>new Promise(resolve=>setTimeout(resolve,50))}={}){
 if(!child?.pid||child.exitCode!==null||child.signalCode)return;
 try{if(platform==='win32')killTree(child.pid);else child.kill('SIGTERM');}
 catch(error){await settle();if(child.exitCode!==null||child.signalCode||!exists(child.pid))return;throw error;}
}
