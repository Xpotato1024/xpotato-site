import{describe,it,expect}from"vitest";
import{createHash}from"node:crypto";
import{readSourceBlobs}from"./browser-tool-source-blobs.js";
const blob=(bytes:Buffer)=>({oid:createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex"),size:bytes.length});
const record=(bytes:Buffer)=>{const r=blob(bytes);return {r,bytes,wire:Buffer.concat([Buffer.from(`${r.oid} blob ${r.size}\n`),bytes,Buffer.from("\n")])};};
describe("bounded pinned Git blob batches",()=>{
 it("reads binary/newline/empty blobs exactly and deduplicates repeated object requests",()=>{
  const a=record(Buffer.from([0,10,255,13,0])),b=record(Buffer.alloc(0)),calls:Buffer[]=[];
  const out=readSourceBlobs([a.r,b.r,a.r],(input,max)=>{calls.push(input);const wire=Buffer.concat([a.wire,b.wire]);expect(max).toBe(wire.length);return wire;});
  expect(calls).toEqual([Buffer.from(a.r.oid+"\n"+b.r.oid+"\n")]);expect(out.get(a.r.oid)).toEqual(a.bytes);expect(out.get(b.r.oid)).toEqual(b.bytes);
 });
 it("batches by byte budget and keeps a valid larger single blob bounded",()=>{
  const items=[record(Buffer.alloc(2_000_000,1)),record(Buffer.alloc(2_000_000,2)),record(Buffer.alloc(4_100_000,3))],calls:number[]=[];
  const out=readSourceBlobs(items.map(x=>x.r),(input,max)=>{const ids=input.toString().trim().split("\n");calls.push(ids.length);const wire=Buffer.concat(ids.map(id=>items.find(x=>x.r.oid===id)!.wire));expect(wire.length).toBe(max);return wire;});
  expect(calls).toEqual([1,1,1]);expect(out.size).toBe(3);
 });
 it("requires the pinned object/type/size header and exact binary framing",()=>{
  const a=record(Buffer.from("original\n"));
  for(const wire of[Buffer.from(a.r.oid+" missing\n"),Buffer.from(a.r.oid+" tree 9\noriginal\n\n"),Buffer.from("0".repeat(40)+" blob 9\noriginal\n\n"),Buffer.concat([Buffer.from(`${a.r.oid} blob 8\n`),a.bytes,Buffer.from("\n")]),a.wire.subarray(0,-1),Buffer.concat([a.wire,Buffer.from("extra")])])
   expect(()=>readSourceBlobs([a.r],()=>wire)).toThrow(/header|Truncated|Trailing/);
 });
 it("independently verifies blob object hash instead of trusting a matching header",()=>{
  const a=record(Buffer.from("original")),wire=Buffer.from(a.wire),index=wire.indexOf(10)+1;wire[index]=wire[index]!^1;
  expect(()=>readSourceBlobs([a.r],()=>wire)).toThrow(/object hash/);
 });
 it("rejects invalid IDs/sizes and inconsistent duplicate metadata before spawning",()=>{
  const a=record(Buffer.from("x"));let calls=0;const read=()=>{calls++;return a.wire;};
  for(const r of[{...a.r,oid:"HEAD"},{...a.r,size:-1},{...a.r,size:1.5},{...a.r,size:10_000_001}])expect(()=>readSourceBlobs([r],read)).toThrow(/Invalid/);
  expect(()=>readSourceBlobs([a.r,{...a.r,size:2}],read)).toThrow(/Inconsistent/);expect(calls).toBe(0);
 });
 it("performs no process work for an empty tree",()=>{expect(readSourceBlobs([],()=>{throw Error("Must not run");}).size).toBe(0);});
});
