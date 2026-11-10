import {it,expect} from 'vitest';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {inspectToolArtifact,toolHash} from './browser-tool-adoption.js';
import {materializeHistoricalToolFixture} from "../../../../tests/fixtures/historical-browser-tool.js";
it('checks the exact v0.2.2 provenance output set and hashes without trusting its self-report',async()=>{
 const {root,cleanup}=await materializeHistoricalToolFixture('v0-2-2');
 try{
  await expect(inspectToolArtifact(root)).resolves.toMatchObject({artifactSha256:'8734aeeb4886c2f295db5d00f6fa8b35e6451b8f20aaf16ce5511c661517a26e'});
  const original=JSON.parse(await readFile(join(root,'artifact-provenance.json'),'utf8')),manifest=JSON.parse(await readFile(join(root,'browser-tool.json'),'utf8'));
  for(const change of [(p:any)=>p.outputs.pop(),(p:any)=>p.outputs.push(p.outputs[0]),(p:any)=>p.outputs[0].sha256='0'.repeat(64),(p:any)=>p.limits.authenticityVerified=true,(p:any)=>p.unrecognized=true]){
   const p=structuredClone(original);change(p);const text=JSON.stringify(p),m=structuredClone(manifest),record=m.files.find((x:{path:string})=>x.path==='artifact-provenance.json');record.bytes=Buffer.byteLength(text);record.sha256=toolHash(text);
   await writeFile(join(root,'artifact-provenance.json'),text);await writeFile(join(root,'browser-tool.json'),JSON.stringify(m));
   await expect(inspectToolArtifact(root)).rejects.toThrow();
  }
 }finally{await cleanup();}
},20000);
