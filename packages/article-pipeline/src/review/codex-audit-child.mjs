/** Own-process cancellation. Never terminate the bridge to cancel its child. */
export function controlAuditChild(child,{timeoutMs,cancelled,stopGraceMs=3000}){
 let stopped=false,containmentFailed=false,done=false,finish,fail,retry,containment;
 const stop=()=>{
  if(stopped||done||child.exitCode!==null||!child.pid)return;
  stopped=true;try{child.kill();}catch{/* Outcome remains uncertain until close. */}
  retry=setTimeout(()=>{if(!done)try{child.kill('SIGKILL');}catch{/* Recorded below. */}},Math.min(1000,Math.floor(stopGraceMs/2)));
  containment=setTimeout(()=>{if(!done){containmentFailed=true;child.stdin?.destroy();child.stdout?.destroy();child.stderr?.destroy();child.unref();finish(null);}},stopGraceMs);
 };
 const timer=setTimeout(stop,timeoutMs),poll=setInterval(()=>{if(cancelled())stop();},100);
 const result=new Promise((resolve,reject)=>{
  finish=resolve;fail=reject;child.once('error',reject);child.once('close',resolve);
 }).then(exitCode=>({exitCode,stopped,containmentFailed})).finally(()=>{
  done=true;clearTimeout(timer);clearInterval(poll);clearTimeout(retry);clearTimeout(containment);
  child.removeListener('error',fail);child.removeListener('close',finish);
 });
 if(cancelled())stop();
 return {stop,result};
}
