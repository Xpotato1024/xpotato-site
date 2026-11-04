// Offline CI transport probe only. All IO is local or fixture-only; no ambient token/fetch.
import {mkdtemp,rm,appendFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {armedFixture,source,at} from './site-monitor-armed-fixture.mjs';
import {reserveEvidenceAttempt,prepareEvidenceWait} from './site-monitor-evidence.mjs';
import {encodeEvidenceWaitTransport} from './site-monitor-evidence-ready.mjs';
export async function syntheticWaitTransport(){
 const f=armedFixture(),root=resolve(tmpdir()),directory=await mkdtemp(join(root,'finite-receipt-smoke-'));
 if(!resolve(directory).startsWith(join(root,'finite-receipt-smoke-')))throw Error('SYNTHETIC_PATH_UNKNOWN');
 try{
  for(let i=0;i<48;i++)f.rows.push(f.raw('9'+String(i).padStart(19,'0'),10+i,source,'schedule',at(-600),at(-599),'skipped'));
  f.setNow(new Date(Date.parse(at(-599))+500).toISOString());
  const options={gate:f.gate,audit:f.audit,sourceSha:source,baselineSha256:f.gate.baselineSha256,currentRunId:'9000',currentRunNumber:6,runAttempt:1,controlDirectory:directory,clock:f.clock},permit=await reserveEvidenceAttempt(options);
  const ready=await prepareEvidenceWait({...options,permit,credentialProvider:f.credentialProvider,fetchImpl:f.fetchImpl,waitImpl:async ms=>f.setNow(new Date(f.clock()+ms).toISOString())});
  const transport=encodeEvidenceWaitTransport({receipt:ready.receipt,...options});
  return {receipt:ready.receipt,transport,gate:f.gate,audit:f.audit,sourceSha:source,run:f.collector};
 }finally{await rm(directory,{recursive:true,force:true})}
}
async function main(){
 if(process.argv.length!==2||process.env.GITHUB_ACTIONS!=='true'||typeof process.env.GITHUB_OUTPUT!=='string')throw Error('SYNTHETIC_CONTEXT_UNKNOWN');
 const {transport}=await syntheticWaitTransport();
 const lines=['status=SYNTHETIC_WAIT_RECEIPT_TRANSPORT','receipt_sha256='+transport.receiptSha256,...transport.chunks.map((chunk,i)=>'receipt_chunk_'+String(i+1).padStart(2,'0')+'='+chunk)];
 await appendFile(process.env.GITHUB_OUTPUT,lines.join('\n')+'\n',{encoding:'utf8'});console.log('SYNTHETIC TRANSPORT ONLY; no live trial, network, credentials, upload or publication');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('SYNTHETIC_RECEIPT_TRANSPORT_STOPPED');process.exitCode=1});
