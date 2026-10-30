/** Deadline and cancellation for trusted callbacks. No retries. A timed-out
 * callback may still finish remotely; callers must retain an unknown intent.
 */
export async function runtimeDeadline<T>(timeoutMs:number,outer:AbortSignal|undefined,run:(signal:AbortSignal)=>Promise<T>):Promise<T>{
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>240000)throw Error("RUNTIME_DEADLINE_INVALID");
 const c=new AbortController(),abort=()=>c.abort();outer?.addEventListener("abort",abort,{once:true});
 let timer:ReturnType<typeof setTimeout>|undefined,stop:(()=>void)|undefined;
 const expired=new Promise<never>((_,reject)=>{stop=()=>reject(Error("RUNTIME_DEADLINE_OR_CANCEL"));c.signal.addEventListener("abort",stop,{once:true});timer=setTimeout(abort,timeoutMs);if(outer?.aborted)abort();});
 try{const value=await Promise.race([Promise.resolve().then(()=>{c.signal.throwIfAborted();return run(c.signal);}),expired]);c.signal.throwIfAborted();return value;}
 finally{clearTimeout(timer);if(stop)c.signal.removeEventListener("abort",stop);outer?.removeEventListener("abort",abort);}
}
