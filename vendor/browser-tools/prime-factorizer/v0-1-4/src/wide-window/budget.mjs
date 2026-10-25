// SPDX-License-Identifier: AGPL-3.0-only
export const WIDE_LIMITS=Object.freeze({maxMs:3600000,maxFamilies:4096,maxEvents:16416,maxGraphSnapshots:512,maxProgress:4096});
const TIME_KEYS=['prepareMs','sieveMs','copyFreeMs','framingMs','submitMs','observeMs','extractMs'];
export function validateWideTimings(t,previous=null){
 if(!t)throw Error('Missing long timings');let sum=0;
 for(const k of TIME_KEYS){if(!Number.isFinite(t[k])||t[k]<0||t[k]>WIDE_LIMITS.maxMs||previous&&t[k]<previous[k])throw Error('Long timing '+k);sum+=t[k];}
 if(sum>WIDE_LIMITS.maxMs+10000)throw Error('Long timing total');
}
export function validateWideQuotaTelemetry(q){
 if(q===null||q===undefined)return null;
 const integer=n=>Number.isInteger(n)&&n>=0&&n<=4294967295;
 if(!q||typeof q!=='object'||Object.keys(q).sort().join(',')!=='active,extracting,preflightRefused,refusals,stages'||typeof q.extracting!=='boolean'||![0,1].includes(q.active)||![0,1].includes(q.preflightRefused)||!integer(q.refusals)||!Array.isArray(q.stages)||q.stages.length>24)throw Error('Native quota telemetry');
 for(const r of q.stages){
  if(!Array.isArray(r)||r.length!==12||!r.every(integer)||r[4]>r[5]||r[5]>r[6]||r[6]>1024*1048576||r[6]%65536||r[7]<1||r[7]>640*1048576||r[8]<65536||r[8]>832*1048576)throw Error('Native quota stage');
 }
 return q;
}
