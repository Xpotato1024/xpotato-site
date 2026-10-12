// No default fetch or environment credential lookup. Only an explicitly wired,
// approved host can supply authentication. Imports and mocks never do network IO.
class TransportError extends Error {}
export const transportFailureCode=error=>error instanceof TransportError?error.message:null;
const fail=code=>{throw new TransportError(code)};
export function createJsonTransport({origin,credentialProvider,fetchImpl,allowRequest,timeoutMs=10000,maxBytes=1048576,clock=Date.now}){
 if(!['https://api.cloudflare.com','https://api.github.com'].includes(origin)||typeof credentialProvider!=='function'||typeof fetchImpl!=='function'||typeof allowRequest!=='function'||typeof clock!=='function'||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>1048576)fail('INVALID_TRANSPORT_CONFIGURATION');
 return async function request({path,method='GET',body,allow404=false,signal,deadlineAt}){
  let timer;
  const controller=new AbortController();
  const abort=()=>controller.abort();
  const check=()=>{if(controller.signal.aborted||signal?.aborted||deadlineAt!==undefined&&clock()>=deadlineAt)fail('REMOTE_TIMEOUT')};
  try {
   if(signal!==undefined&&!(signal instanceof AbortSignal)||deadlineAt!==undefined&&!Number.isFinite(deadlineAt))fail('INVALID_OPERATION_CONTEXT');
   signal?.addEventListener('abort',abort,{once:true});check();
   if(typeof path!=='string'||!path.startsWith('/')||path.startsWith('//')||/[\\#%\r\n]/.test(path)||!['GET','DELETE','POST'].includes(method)||typeof allow404!=='boolean')fail('REQUEST_NOT_ALLOWED');
   const url=new URL(path,origin);
   if(url.origin!==origin||!allowRequest({path:url.pathname,query:url.searchParams,method,body,allow404}))fail('REQUEST_NOT_ALLOWED');
   // No automatic retries, especially after an ambiguous mutation response.
   const operation=(async()=>{
    const value=await credentialProvider({signal:controller.signal,deadlineAt});
    check();
    if(typeof value!=='string'||!/^[A-Za-z0-9_.-]{16,2048}$/.test(value))fail('AUTHENTICATION_UNAVAILABLE');
    const options={method,redirect:'manual',signal:controller.signal,headers:{Authorization:`Bearer ${value}`,Accept:'application/json','User-Agent':'xpotato-production-review'}};
    if(origin==='https://api.github.com')options.headers['X-GitHub-Api-Version']='2026-03-10';
    if(body!==undefined){options.headers['Content-Type']='application/json';options.body=JSON.stringify(body)}
    check();const response=await fetchImpl(url.href,options);check();
    if(response.status>=300&&response.status<400)fail('REMOTE_REDIRECT_REJECTED');
    if(allow404&&response.status===404)return {status:404,data:null};
    if(response.status!==200)fail([401,403,404,429].includes(response.status)?`REMOTE_HTTP_${response.status}`:'REMOTE_HTTP_FAILURE');
    if(!response.headers.get('content-type')?.toLowerCase().includes('application/json'))fail('REMOTE_CONTENT_TYPE');
    const length=response.headers.get('content-length');
    if(length!==null&&(!/^\d+$/.test(length)||Number(length)>maxBytes))fail('REMOTE_BODY_LIMIT');
    if(!response.body?.getReader)fail('REMOTE_BODY_UNREADABLE');
    const reader=response.body.getReader(),chunks=[];let size=0;
    // A losing timeout race must not keep reading a non-cooperative body.
    // Cancellation is best effort and is never awaited indefinitely.
    const cancel=()=>{try{Promise.resolve(reader.cancel()).catch(()=>{})}catch{}};
    controller.signal.addEventListener('abort',cancel,{once:true});
    try {for(;;){check();const {done,value:chunk}=await reader.read();check();if(done)break;size+=chunk.byteLength;if(size>maxBytes){cancel();fail('REMOTE_BODY_LIMIT')}chunks.push(Buffer.from(chunk));}}catch(error){cancel();throw error}finally{controller.signal.removeEventListener('abort',cancel);try{reader.releaseLock()}catch{}}
    check();
    let data;try {data=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{fail('REMOTE_INVALID_JSON')}
    return {status:200,data};
   })();
   const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new TransportError('REMOTE_TIMEOUT'))},timeoutMs)});
   return await Promise.race([operation,timeout]);
  }catch(error){if(error instanceof TransportError)throw error;throw new TransportError('REMOTE_REQUEST_FAILED')}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);controller.abort()}
 };
}
