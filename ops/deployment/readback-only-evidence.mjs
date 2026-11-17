import {inflateRawSync} from 'node:zlib';
import {hashBytes} from './manual-deployment.mjs';
class EvidenceError extends Error{}
const fail=code=>{throw new EvidenceError(code);};
export const evidenceErrorCode=error=>error instanceof EvidenceError?error.message:null;
export function crc32(bytes){let value=0xffffffff;for(const byte of bytes){value^=byte;for(let n=0;n<8;n++)value=(value>>>1)^((value&1)?0xedb88320:0);}return (value^0xffffffff)>>>0;}
// No general extraction: only the three nonsecret evidence files of the pinned
// original run are admitted; only manual-result.json is returned in memory.
export function readOriginalResult(zip,pin){
  if(!Buffer.isBuffer(zip)||zip.length!==pin.bytes||zip.length>1048576||'sha256:'+hashBytes(zip)!==pin.digest)fail('EVIDENCE_ARCHIVE_DIGEST');
  try{
    const end=zip.length-22;
    if(end<0||zip.readUInt32LE(end)!==0x06054b50||zip.readUInt16LE(end+4)!==0||zip.readUInt16LE(end+6)!==0
      ||zip.readUInt16LE(end+8)!==3||zip.readUInt16LE(end+10)!==3||zip.readUInt16LE(end+20)!==0)fail('EVIDENCE_ZIP_LAYOUT');
    const start=zip.readUInt32LE(end+16),size=zip.readUInt32LE(end+12);
    if(start+size!==end)fail('EVIDENCE_ZIP_LAYOUT');
    const allowed=new Set(['manual-preimage.json','manual-progress.json','manual-result.json']),ranges=[];let cursor=start,result,total=0;
    for(let n=0;n<3;n++){
      if(cursor+46>end||zip.readUInt32LE(cursor)!==0x02014b50)fail('EVIDENCE_ZIP_LAYOUT');
      const flags=zip.readUInt16LE(cursor+8),method=zip.readUInt16LE(cursor+10),crc=zip.readUInt32LE(cursor+16),compressed=zip.readUInt32LE(cursor+20),expanded=zip.readUInt32LE(cursor+24);
      const nameLength=zip.readUInt16LE(cursor+28),extraLength=zip.readUInt16LE(cursor+30),commentLength=zip.readUInt16LE(cursor+32),attributes=zip.readUInt32LE(cursor+38),offset=zip.readUInt32LE(cursor+42);
      const name=zip.subarray(cursor+46,cursor+46+nameLength).toString('utf8'),type=(attributes>>>16)&0xf000;
      if(!allowed.delete(name)||flags&~0x808||![0,8].includes(method)||extraLength!==0||commentLength!==0||zip.readUInt16LE(cursor+34)!==0
        ||![0,0x8000].includes(type)||attributes&0x410||expanded>1048576||compressed>1048576)fail('EVIDENCE_ZIP_ENTRY');
      if(offset+30>start||zip.readUInt32LE(offset)!==0x04034b50||zip.readUInt16LE(offset+6)!==flags||zip.readUInt16LE(offset+8)!==method)fail('EVIDENCE_ZIP_ENTRY');
      const localName=zip.readUInt16LE(offset+26),localExtra=zip.readUInt16LE(offset+28),dataStart=offset+30+localName+localExtra,dataEnd=dataStart+compressed;
      if(zip.subarray(offset+30,offset+30+localName).toString('utf8')!==name||localExtra!==0||dataEnd>start
        ||ranges.some(([a,b])=>offset<b&&dataEnd>a))fail('EVIDENCE_ZIP_ENTRY');
      ranges.push([offset,dataEnd]);total+=expanded;if(total>2097152)fail('EVIDENCE_ZIP_LIMIT');
      const raw=zip.subarray(dataStart,dataEnd),body=method===0?raw:inflateRawSync(raw,{maxOutputLength:1048576});
      if(body.length!==expanded||crc32(body)!==crc)fail('EVIDENCE_ZIP_CRC');
      if(name==='manual-result.json')result=body;
      cursor+=46+nameLength+extraLength+commentLength;
    }
    if(cursor!==end||allowed.size||!result||result.length!==pin.resultBytes||hashBytes(result)!==pin.resultSha256)fail('EVIDENCE_RESULT_DIGEST');
    return Buffer.from(result);
  }catch(error){if(error instanceof EvidenceError)throw error;fail('EVIDENCE_ZIP_LAYOUT');}
}
function safeSignedUrl(value){
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&!url.hash
    &&(/^[a-z0-9-]+\.blob\.core\.windows\.net$/.test(url.hostname)||url.hostname==='results-receiver.actions.githubusercontent.com')?url.href:null;}catch{return null;}
}
export async function downloadOriginalEvidence({artifactId,pin,credentialProvider,fetchImpl}){
  if(!/^[1-9][0-9]*$/.test(artifactId)||typeof credentialProvider!=='function'||typeof fetchImpl!=='function')fail('EVIDENCE_DOWNLOAD_INPUT');
  const controller=new AbortController();let timer,reader;
  const operation=(async()=>{
    const token=await credentialProvider();if(typeof token!=='string'||!/^[A-Za-z0-9_.-]{16,2048}$/.test(token))fail('EVIDENCE_AUTHENTICATION_UNAVAILABLE');
    if(controller.signal.aborted)fail('EVIDENCE_DOWNLOAD_TIMEOUT');
    const redirect=await fetchImpl('https://api.github.com/repos/Xpotato1024/xpotato-site/actions/artifacts/'+artifactId+'/zip',
      {method:'GET',redirect:'manual',signal:controller.signal,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json'}});
    const signed=safeSignedUrl(redirect.headers.get('location'));
    if(redirect.status!==302||!signed)fail('EVIDENCE_DOWNLOAD_REDIRECT');
    if(controller.signal.aborted)fail('EVIDENCE_DOWNLOAD_TIMEOUT');
    // Never forward GitHub Authorization to the signed object URL.
    const response=await fetchImpl(signed,{method:'GET',redirect:'manual',signal:controller.signal,headers:{Accept:'application/zip'}});
    if(response.status!==200||!response.body?.getReader)fail('EVIDENCE_DOWNLOAD_STATUS');
    const length=response.headers.get('content-length');if(length!==null&&length!==String(pin.bytes))fail('EVIDENCE_DOWNLOAD_SIZE');
    reader=response.body.getReader();const chunks=[];let size=0;
    for(;;){if(controller.signal.aborted)fail('EVIDENCE_DOWNLOAD_TIMEOUT');const value=await reader.read();if(controller.signal.aborted)fail('EVIDENCE_DOWNLOAD_TIMEOUT');if(value.done)break;size+=value.value.length;if(size>pin.bytes||size>1048576)fail('EVIDENCE_DOWNLOAD_SIZE');chunks.push(Buffer.from(value.value));}
    if(size!==pin.bytes)fail('EVIDENCE_DOWNLOAD_SIZE');return readOriginalResult(Buffer.concat(chunks),pin);
  })();
  try{return await Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new EvidenceError('EVIDENCE_DOWNLOAD_TIMEOUT'));},10000);})]);}
  catch(error){if(error instanceof EvidenceError)throw error;fail('EVIDENCE_DOWNLOAD_FAILED');}
  finally{clearTimeout(timer);controller.abort();try{Promise.resolve(reader?.cancel()).catch(()=>{});}catch{}}
}
