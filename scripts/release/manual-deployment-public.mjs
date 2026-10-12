import {authority} from './deployment-policy.mjs';
import {hashBytes} from './manual-deployment.mjs';
import {stop,uuid} from './manual-deployment-provider.mjs';
import {dnsLabel} from './cloudflare-response-shapes.mjs';
export function createPublicReadback({fetchImpl,clock=Date.now}) {
  let count=0;
  async function read(url) {
    if(++count>144)stop('PUBLIC_READ_BUDGET');
    const controller=new AbortController();let timer;
    const operation=(async()=>{
      const response=await fetchImpl(url,{method:'GET',redirect:'manual',signal:controller.signal,headers:{'User-Agent':'xpotato-site-manual-readback','Cache-Control':'no-cache'}});
      if(![200,404].includes(response.status)||!response.body?.getReader)stop('PUBLIC_HTTP_OR_REDIRECT');
      const reader=response.body.getReader(),chunks=[];let size=0;
      const cancel=()=>{try{Promise.resolve(reader.cancel()).catch(()=>{})}catch{}};
      controller.signal.addEventListener('abort',cancel,{once:true});
      try {for(;;){if(controller.signal.aborted)stop('PUBLIC_TIMEOUT');const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>2097152){cancel();stop('PUBLIC_BODY_LIMIT')}chunks.push(Buffer.from(r.value));}}
      finally {controller.signal.removeEventListener('abort',cancel);try{reader.releaseLock()}catch{}}
      if(controller.signal.aborted)stop('PUBLIC_TIMEOUT');
      return {status:response.status,bytes:size,sha256:hashBytes(Buffer.concat(chunks))};
    })();
    try {return await Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('PUBLIC_TIMEOUT'));},10000);})]);}
    catch {stop('PUBLIC_READ_FAILED');} finally {clearTimeout(timer);controller.abort();}
  }
  async function alternates(image) {
    if(!uuid(image.versionId)||!dnsLabel(image.accountSubdomain))stop('ALTERNATE_IDENTITY');
    const suffix=image.accountSubdomain+'.workers.dev';
    const worker=await read('https://'+authority.worker+'.'+suffix+'/');
    const preview=await read('https://'+image.versionId.slice(0,8)+'-'+authority.worker+'.'+suffix+'/');
    if(worker.status!==404||preview.status!==404)stop('ALTERNATE_ENDPOINT_LIVE');
    return {workersDevStatus:worker.status,previewStatus:preview.status};
  }
  return Object.freeze({
    async before(image) {const home=await read('https://'+authority.hostname+'/');return {publicStatus:home.status,homeSha256:home.sha256,...await alternates(image)};},
    async published(targets,image) {
      const start=clock();
      for(const target of targets.targets) {
        if(!target.path.startsWith('/')||target.path.startsWith('//')||/[\\?#\r\n]/.test(target.path))stop('PUBLIC_TARGET_PATH');
        const current=await read('https://'+authority.hostname+target.path);
        if(current.status!==200||current.bytes!==target.bytes||current.sha256!==target.sha256)stop('PUBLIC_BYTES_MISMATCH');
        if(clock()-start>120000)stop('PUBLIC_READBACK_STALE');
      }
      await alternates(image);
    }
  });
}
