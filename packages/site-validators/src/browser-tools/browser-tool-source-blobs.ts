import {createHash} from "node:crypto";

type BlobRecord = {oid:string; size:number};
type BatchReader = (input:Buffer, maxBuffer:number)=>Buffer;
const maxBlobBytes=10_000_000, batchBudget=4_000_000;

/** Read exact pinned blobs without one process per source file. No source code runs. */
export function readSourceBlobs(records:readonly BlobRecord[], readBatch:BatchReader):Map<string,Buffer> {
  const unique=new Map<string,BlobRecord>(), result=new Map<string,Buffer>();
  for(const r of records){
    if(!/^[a-f0-9]{40}$/u.test(r.oid)||!Number.isSafeInteger(r.size)||r.size<0||r.size>maxBlobBytes)
      throw Error("Invalid or oversized source blob");
    if(unique.has(r.oid)&&unique.get(r.oid)!.size!==r.size)throw Error("Inconsistent source blob size");
    unique.set(r.oid,r);
  }
  let batch:BlobRecord[]=[], estimatedBytes=0;
  function flush():void {
    if(!batch.length)return;
    const input=Buffer.from(batch.map(r=>r.oid+"\n").join(""),"ascii");
    const output=readBatch(input,estimatedBytes), expected=batch;
    let offset=0;
    for(const r of expected){
      const header=Buffer.from(`${r.oid} blob ${r.size}\n`,"ascii");
      if(!output.subarray(offset,offset+header.length).equals(header))throw Error("Pinned source blob header mismatch");
      offset+=header.length;
      if(offset+r.size>=output.length||output[offset+r.size]!==10)throw Error("Truncated source blob batch");
      const bytes=Buffer.from(output.subarray(offset,offset+r.size));
      const oid=createHash("sha1").update(`blob ${r.size}\0`).update(bytes).digest("hex");
      if(oid!==r.oid)throw Error("Pinned source blob object hash mismatch");
      result.set(r.oid,bytes);offset+=r.size+1;
    }
    if(offset!==output.length)throw Error("Trailing source blob batch bytes");
    batch=[];estimatedBytes=0;
  }
  for(const r of unique.values()){
    const bytes=Buffer.byteLength(`${r.oid} blob ${r.size}\n`)+r.size+1;
    if(batch.length&&estimatedBytes+bytes>batchBudget)flush();
    batch.push(r);estimatedBytes+=bytes;
  }
  flush();return result;
}
