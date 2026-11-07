// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Xpotato.net / Xpotato1024
export const DLP_PROFILES=Object.freeze({baseline:0,half:1,quarter:2});
export function dlpProfile(profile){if(typeof profile!=='string'||!Object.hasOwn(DLP_PROFILES,profile))throw Error('Named DLP profile required');return DLP_PROFILES[profile];}
const same=(a,b,label)=>{if(a!==b)throw Error('DLP configuration '+label);};
export function validateDlpConfiguration(c,profile,bits){
 dlpProfile(profile);if(!c||c.version!==1)throw Error('DLP ABI');same(c.profile,profile,'profile');same(c.bits,bits,'bits');
 for(const k of ['factorBaseBound','intervalHalfWidth','factorBaseSize','lpBits'])if(!Number.isSafeInteger(c[k])||c[k]<1||c[k]>100000000)throw Error('DLP configuration integer');
 if(!Number.isSafeInteger(c.thresholdAdjustment)||Math.abs(c.thresholdAdjustment)>128)throw Error('DLP threshold offset');
 for(const k of ['singleLimit','doubleLimit'])if(typeof c[k]!=='string'||!/^(0|[1-9][0-9]{0,19})$/.test(c[k]))throw Error('DLP bound encoding');
 if(BigInt(c.doubleLimit)>BigInt(c.singleLimit)**2n)throw Error('DLP product bound');
 if(bits>=321&&bits<=333){
  same(c.factorBaseBound,3250000,'factor base');same(c.intervalHalfWidth,524288,'interval');same(c.singleLimit,'471250000','single limit');same(c.thresholdAdjustment,-23,'offset');
  const limit=3250000n**2n*BigInt([1035,512,256][dlpProfile(profile)]);
  same(c.doubleLimit,limit.toString(),'product limit');same(c.lpBits,limit.toString(2).length,'lp_bits');
 }
}
export const DLP_STAT_KEYS=Object.freeze(['full','slp','dlp','cycles','vertices','treeEdges','usable','ingested']);
export function validateDlpStats(s,previous=null,parsedRows=0,relations=0){
 if(!s)throw Error('Missing collector counters');
 for(const k of DLP_STAT_KEYS){if(!Number.isSafeInteger(s[k])||s[k]<0||s[k]>4294967295)throw Error('Collector counter '+k);if(previous&&s[k]<previous[k])throw Error('Collector counter rollback');}
 if(s.full+s.slp+s.dlp!==s.ingested||s.full+s.cycles!==s.usable||s.usable!==relations||s.ingested>parsedRows||s.cycles>s.slp+s.dlp||s.treeEdges>s.slp+s.dlp||s.vertices>2*(s.slp+s.dlp)+1||s.treeEdges>s.vertices)throw Error('Collector counter identity');
}
export const DLP_TIME_KEYS=Object.freeze(['prepareMs','sieveMs','copyFreeMs','framingMs','submitMs','observeMs','extractMs']);
export function validateDlpTimings(t,previous=null){
 if(!t)throw Error('Missing wrapper timings');let sum=0;
 for(const k of DLP_TIME_KEYS){if(!Number.isFinite(t[k])||t[k]<0||t[k]>600000||previous&&t[k]<previous[k])throw Error('Wrapper timing '+k);sum+=t[k];}
 if(sum>610000)throw Error('Wrapper timing total');
}
