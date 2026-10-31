// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Xpotato.net / Xpotato1024
export class OwnerClock{
 constructor(workers,start,transportBytes=33554432){
  if(![1,2,3,4,5,6].includes(workers)||!Number.isFinite(start))throw Error('Owner clock');
  if(![33554432,67108864].includes(transportBytes))throw Error('Finite transport');this.transportBytes=transportBytes;this.start=start;this.last=start;this.closed=false;this.states=Array(workers).fill('idleMs');
  this.rows=Array.from({length:workers},()=>({assignedMs:0,submitMs:0,coordinatorIdleMs:0,blockedIdleMs:0,globalCapacityIdleMs:0,idleMs:0}));
 }
 advance(at){
  if(!Number.isFinite(at)||at<this.last||at-this.start>1000000000)throw Error('Monotonic owner clock');
  const dt=at-this.last;for(let i=0;i<this.rows.length;i++)this.rows[i][this.states[i]]+=dt;this.last=at;
 }
 transition(at,owners,owned,credit,reservedBytes=0){
  if(this.closed)return;this.advance(at);
  if(owners.length!==this.rows.length||owned.length!==this.rows.length)throw Error('Owner clock count');
  this.states=owners.map((o,i)=>o.command==='submit'?'submitMs':o.job||o.command==='job'?'assignedMs':o.canCompute===false?'coordinatorIdleMs':owned[i]>=credit?'blockedIdleMs':reservedBytes>=this.transportBytes?'globalCapacityIdleMs':'idleMs');
 }
 finish(at){if(this.closed)return;this.advance(at);this.closed=true;}
 result(){
  const window=this.last-this.start;
  return{collectionWindowMs:window,definition:'host assigned-job wall occupancy; dedicated coordinator idle is separate; not OS CPU utilization; delivered native sieve time is a lower bound for censored calls',owners:this.rows.map((states,owner)=>{
   if(Math.abs(Object.values(states).reduce((a,b)=>a+b,0)-window)>0.01)throw Error('Owner time conservation');
   return{owner,states:{...states},assignedRatio:window?states.assignedMs/window:null,blockedIdleRatio:window?states.blockedIdleMs/window:null};
  })};
 }
}
export class PacketAudit{
 constructor(enabled){if(typeof enabled!=='boolean')throw Error('Audit option');this.enabled=enabled;this.bytes=0;this.packets=[];this.ids=new Set();}
 add(job,bytes){
  if(!this.enabled)return;
  if(!(bytes instanceof Uint8Array)||bytes.length<12||this.bytes+bytes.length>8388608||this.packets.length>=1024||!Number.isSafeInteger(job.first)||![1,2].includes(job.count)||this.ids.has(job.first))throw Error('Audit retention bound/duplicate');
  this.packets.push({first:job.first,count:job.count,bytes:bytes.slice()});this.bytes+=bytes.length;this.ids.add(job.first);
 }
}
