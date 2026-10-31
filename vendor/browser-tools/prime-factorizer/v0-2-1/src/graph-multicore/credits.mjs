// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Xpotato.net / Xpotato1024
const profiles=Object.freeze({batch2:Object.freeze({batch:2,credit:2,packetBytes:16777216}),batch1:Object.freeze({batch:1,credit:1,packetBytes:16777216}),credit1:Object.freeze({batch:1,credit:2,packetBytes:8388608})});
export function schedulerProfile(name){
 if(name!=='credit1')throw Error('Named scheduler required');
 return profiles[name];
}
export class CreditLedger{
 constructor(workers,mode,budget,pending=new Map(),{slots=4}={}){
  if(![1,2,3,4,5,6].includes(workers)||!Number.isSafeInteger(budget)||budget<1||budget>750000||!(pending instanceof Map)||pending.size)throw Error('Finite scheduler bounds');
  if(![4,8].includes(slots))throw Error('Finite global slots');this.slots=slots;this.transportCap=slots*8388608;
  this.profile=schedulerProfile(mode);this.workers=workers;this.budget=budget;this.pending=pending;
  this.issued=0;this.submitted=0;this.active=Array(workers).fill(null);this.owned=Array(workers).fill(0);
  this.reservedBytes=0;this.peakReserved=0;this.transport=0;this.peakTransport=0;this.peakOutstanding=0;this.inSubmit=null;this.closed=false;
 }
 owner(i){if(!Number.isInteger(i)||i<0||i>=this.workers)throw Error('Scheduler owner');}
 issue(owner){
  this.owner(owner);if(this.closed||this.active[owner]||this.issued>=this.budget)return null;
  const count=Math.min(this.profile.batch,this.profile.credit-this.owned[owner],this.budget-this.issued);
  if(count<1||this.reservedBytes+this.profile.packetBytes>this.transportCap)return null;
  const job={jobId:this.issued,first:this.issued,count,owner,packetBytes:this.profile.packetBytes};this.active[owner]=job;this.owned[owner]+=count;this.issued+=count;this.reservedBytes+=job.packetBytes;this.peakReserved=Math.max(this.peakReserved,this.reservedBytes);
  this.peakOutstanding=Math.max(this.peakOutstanding,this.issued-this.submitted);
  if(this.issued-this.submitted>Math.min(this.workers*2,this.slots))throw Error('Outstanding family bound');
  return job;
 }
 returned(owner,job,packet){
  this.owner(owner);const active=this.active[owner];
  if(this.closed||!active||['jobId','first','count','owner'].some(k=>job[k]!==active[k])||this.pending.has(job.first))throw Error('Unissued/duplicate producer packet');
  if(!(packet?.buffer instanceof ArrayBuffer)||packet.buffer.byteLength<12||packet.buffer.byteLength>active.packetBytes||this.transport+packet.buffer.byteLength>this.transportCap)throw Error('Finite packet/transport bound');
  const item={...active,buffer:packet.buffer,stats:packet.stats,bytes:packet.buffer.byteLength};
  this.pending.set(item.first,item);this.active[owner]=null;this.transport+=item.bytes;this.peakTransport=Math.max(this.peakTransport,this.transport);
  return item;
 }
 beginSubmission(){
  if(this.closed||this.inSubmit||!this.pending.has(this.submitted))return null;
  const item=this.pending.get(this.submitted);this.pending.delete(this.submitted);this.inSubmit=item;return item;
 }
 ack(jobId){
  const item=this.inSubmit;
  if(this.closed||!item||item.jobId!==jobId||item.first!==this.submitted||this.owned[item.owner]<item.count)throw Error('Out-of-prefix/duplicate acknowledgement');
  this.owned[item.owner]-=item.count;this.submitted+=item.count;this.transport-=item.bytes;this.reservedBytes-=item.packetBytes;this.inSubmit=null;
  return item;
 }
 close(){this.closed=true;}
}
