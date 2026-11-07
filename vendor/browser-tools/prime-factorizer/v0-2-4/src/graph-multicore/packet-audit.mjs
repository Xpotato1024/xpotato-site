// SPDX-License-Identifier: AGPL-3.0-only
import {validatePacket,packetEnvelope} from '../rusqsieve/contracts.mjs';
const MAX_BYTES=16777216,MAX_CALLS=8,MAX_FAMILIES=4096;
export class StreamingPacketAudit{
 constructor(enabled,{digest=bytes=>crypto.subtle.digest('SHA-256',bytes)}={}){
  if(typeof enabled!=='boolean'||typeof digest!=='function')throw Error('Audit option');
  this.enabled=enabled;this.digest=digest;this.bytes=0;this.packets=[];this.pending=new Set();this.seen=new Set();this.rows=[];this.pendingBytes=0;this.peakPendingBytes=0;this.peakPendingCalls=0;this.totalPacketBytes=0;this.packetCount=0;this.failed=null;this.sealed=false;
 }
 add(job,bytes){
  if(!this.enabled)return;
  if(this.sealed)throw Error('Audit sealed');if(this.failed)throw this.failed;
  if(!(bytes instanceof Uint8Array)||bytes.length>8388608)throw Error('Audit packet cap');
  validatePacket(bytes,{first:job.first,count:job.count,target:1000000});
  const body=packetEnvelope(bytes,10),v=new DataView(body.buffer,body.byteOffset,body.length),parts=[];let offset=4,reserved=0;
  for(let i=0;i<job.count;i++){const length=v.getUint32(offset,true);offset+=4;const family=job.first+i;if(this.seen.has(family))throw Error('Duplicate audit family');
   parts.push({family,bytes:length,polynomials:Number(v.getBigUint64(offset+8,true)),rawRelations:v.getUint32(offset+16,true),offset,length});reserved+=2*length;offset+=length;
  }
  if(this.seen.size+parts.length>MAX_FAMILIES)throw Error('Audit family cap');
  if(this.pending.size+parts.length>MAX_CALLS||this.pendingBytes+reserved>MAX_BYTES)throw Error('Audit pending cap');
  for(const p of parts){
   this.seen.add(p.family);this.pendingBytes+=2*p.length;const copy=Uint8Array.from(body.subarray(p.offset,p.offset+p.length));
   let task;task=Promise.resolve().then(()=>this.digest(copy)).then(hash=>{
    if(!(hash instanceof ArrayBuffer)||hash.byteLength!==32)throw Error('SHA256 result width');
    this.rows.push({family:p.family,bytes:p.bytes,polynomials:p.polynomials,rawRelations:p.rawRelations,sha256:Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('')});
   }).catch(e=>{this.failed=e instanceof Error?e:Error(String(e));}).finally(()=>{this.pendingBytes-=2*p.length;this.pending.delete(task);});
   this.pending.add(task);
  }
  this.peakPendingBytes=Math.max(this.peakPendingBytes,this.pendingBytes);this.peakPendingCalls=Math.max(this.peakPendingCalls,this.pending.size);this.totalPacketBytes+=bytes.length;this.packetCount++;
 }
 async flush(){
  let timer;try{await Promise.race([Promise.all([...this.pending]),new Promise((_,no)=>{timer=setTimeout(()=>no(Error('Audit digest deadline')),10000);})]);}finally{clearTimeout(timer);}
  if(this.failed)throw this.failed;
 }
 async finish(){
  this.sealed=true;await this.flush();if(this.pendingBytes!==0||this.pending.size)throw Error('Audit pending after flush');
  this.rows.sort((a,b)=>a.family-b.family);if(this.rows.length!==this.seen.size)throw Error('Missing audit family digest');
  return{enabled:this.enabled,packetCount:this.packetCount,totalPacketBytes:this.totalPacketBytes,pendingBytes:0,peakPendingBytes:this.peakPendingBytes,peakPendingCalls:this.peakPendingCalls,retainedRawBytes:0,maxFamilies:MAX_FAMILIES,families:this.rows};
 }
}
