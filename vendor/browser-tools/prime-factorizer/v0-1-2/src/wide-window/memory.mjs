// SPDX-License-Identifier: AGPL-3.0-only
// Wide-only telemetry bounds; ordinary and Stage37 contracts remain fixed.
export function validateWideMemory(m,capMiB){
 if(![64,1024].includes(capMiB))throw Error('Wide memory role cap');
 if(!m||!Number.isInteger(m.linearBytes)||m.linearBytes<1114112||m.linearBytes>capMiB*1048576||m.linearBytes%65536)throw Error('Linear memory telemetry');
 for(const key of ['liveRequested','peakRequested','allocationFailures','lastFailed'])if(!Number.isInteger(m[key])||m[key]<0||m[key]>4294967295)throw Error('Memory telemetry integer');
 if(m.liveRequested>m.peakRequested||m.peakRequested>m.linearBytes)throw Error('Requested memory telemetry');return m;
}
