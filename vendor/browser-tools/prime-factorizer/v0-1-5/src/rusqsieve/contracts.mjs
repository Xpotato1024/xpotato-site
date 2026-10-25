// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Xpotato.net / Xpotato1024
export const LIMITS=Object.freeze({workers:2,wasmBytes:268435456,totalWasmBytes:536870912,packetBytes:16777216,transportBytes:33554432,batchFamilies:2,maxMs:600000,initMs:10000,maxExtracts:1});
export function validateInput(input){
 if(typeof input!=='string'||input.length>100||!/^[1-9][0-9]*$/.test(input))throw Error('Canonical integer required');
 const n=BigInt(input),bits=n.toString(2).length;if(n<2n||bits>332)throw Error('Input outside SIQS profile');return{input,bits};
}
export function packetEnvelope(bytes,kind){
 if(!(bytes instanceof Uint8Array)||bytes.byteLength<12||bytes.byteLength>LIMITS.packetBytes)throw Error('Packet size');
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(bytes[0]!==81||bytes[1]!==83||bytes[2]!==86||bytes[3]!==49||v.getUint16(4,true)!==kind||v.getUint16(6,true)!==1||v.getUint32(8,true)!==bytes.length-12)throw Error('Packet envelope');
 return bytes.subarray(12);
}
export function validatePacket(bytes,{first,count,target}){
 if(!Number.isSafeInteger(first)||first<0||!Number.isInteger(count)||count<1||count>2||!Number.isInteger(target)||target<1||target>1000000)throw Error('Issued batch');
 const b=packetEnvelope(bytes,10),v=new DataView(b.buffer,b.byteOffset,b.length);let o=0,relations=0,polynomials=0;
 const need=n=>{if(!Number.isInteger(n)||n<0||o+n>b.length)throw Error('Truncated family');};
 const u8=()=>{need(1);return b[o++];},u16=()=>{need(2);const n=v.getUint16(o,true);o+=2;return n;},u32=()=>{need(4);const n=v.getUint32(o,true);o+=4;return n;},u64=()=>{need(8);const n=v.getBigUint64(o,true);o+=8;return n;};
 if(u32()!==count)throw Error('Batch count');
 for(let f=0;f<count;f++){
  const length=u32(),end=o+length;if(length<20||end>b.length)throw Error('Family length');
  if(u64()!==BigInt(first+f))throw Error('Unissued or duplicate family');
  const polys=u64();if(polys>1048576n)throw Error('Polynomial bound');polynomials+=Number(polys);
  const nr=u32();if(nr>1048576||nr>Math.floor((end-o)/8))throw Error('Relation bound');
  for(let r=0;r<nr;r++){
   const root=u16();if(root>128)throw Error('Root width');need(root);o+=root;
   if(u8()>1)throw Error('Sign');const tag=u8();if(tag>2)throw Error('Large prime tag');
   for(let j=0;j<tag;j++)if(u64()<2n)throw Error('Large prime value');
   const powers=u32();if(powers>target||powers>Math.floor((end-o)/6))throw Error('Power count');
   const seen=new Set();for(let j=0;j<powers;j++){const index=u32(),exp=u16();if(index>=target||seen.has(index)||!exp)throw Error('Factor base powers');seen.add(index);}
  }
  if(o!==end)throw Error('Trailing family bytes');relations+=nr;
 }
 if(o!==b.length)throw Error('Trailing batch bytes');
 return{families:count,relations,polynomials,bytes:bytes.byteLength};
}
export function factorPacket(bytes,input){
 const b=packetEnvelope(bytes,11);if(b.length!==128)throw Error('Factor width');let n=0n;
 for(let i=b.length-1;i>=0;i--)n=n*256n+BigInt(b[i]);
 const whole=BigInt(input);if(n<=1n||n>=whole||whole%n!==0n)throw Error('Invalid divisor');return n.toString();
}

export function validateMemory(m){
 if(!m||!Number.isInteger(m.linearBytes)||m.linearBytes<1114112||m.linearBytes>LIMITS.wasmBytes||m.linearBytes%65536)throw Error('Linear memory telemetry');
 for(const key of ['liveRequested','peakRequested','allocationFailures','lastFailed'])if(!Number.isInteger(m[key])||m[key]<0||m[key]>4294967295)throw Error('Memory telemetry integer');
 if(m.liveRequested>m.peakRequested||m.peakRequested>m.linearBytes)throw Error('Requested memory telemetry');return m;
}
