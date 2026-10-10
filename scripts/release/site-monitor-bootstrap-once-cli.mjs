// Run only after the reviewed code is merged and exact-main CI is successful.
import {readFileSync,statSync,existsSync,openSync,writeSync,fsyncSync,closeSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {dirname,join,resolve} from 'node:path';
import {bootstrapSourcePaths,sourceDigest,dispatchMonitorBootstrapOnce} from './site-monitor-bootstrap-once.mjs';
const repo='Xpotato1024/xpotato-site',root=new URL('../../',import.meta.url);
function bounded(path,limit){const info=statSync(path);if(!info.isFile()||info.size>limit)throw Error();const bytes=readFileSync(path);if(bytes.length>limit)throw Error();return bytes}
function gh(args,input){return spawnSync('gh',args,{encoding:'utf8',input,timeout:30000,maxBuffer:1048576,windowsHide:true})}
async function main(){
 if(process.argv.length!==5||process.argv[2]!=='--dispatch-bootstrap-once')throw Error();
 const [expectedSourceSha,baselinePath]=process.argv.slice(3);
 const approval=JSON.parse(bounded(new URL('docs/operations/site-monitor-bootstrap-approval.json',root),1024));
 if(typeof approval.baselineSha256!=='string'||!/^[a-f0-9]{64}$/.test(approval.baselineSha256))throw Error();
 const ledgerPath=join(dirname(resolve(baselinePath)),`.monitor-bootstrap-${approval.baselineSha256}-approved-once.json`);
 if(existsSync(ledgerPath))throw Error();
 const baselineJson=bounded(baselinePath,8192).toString('utf8');
 const reviewedSourceHashes=Object.fromEntries(bootstrapSourcePaths.map(path=>[path,sourceDigest(bounded(new URL(path,root),1048576))]));
 const receipt=await dispatchMonitorBootstrapOnce({expectedSourceSha,baselineJson,approval,reviewedSourceHashes,alreadyReserved:false,
  api:async path=>{const result=gh(['api',path]);if(result.status!==0)throw Error();return JSON.parse(result.stdout)},
  reserve:async value=>{const fd=openSync(ledgerPath,'wx',0o600);try{writeSync(fd,JSON.stringify(value)+'\n');fsyncSync(fd)}finally{closeSync(fd)}},
  update:async value=>writeFileSync(ledgerPath,JSON.stringify(value)+'\n',{encoding:'utf8',mode:0o600}),
  dispatch:async inputs=>gh(['workflow','run','site-integrity-monitor.yml','--repo',repo,'--ref','main','--json'],JSON.stringify(inputs))
 });
 console.log(JSON.stringify(receipt));if(receipt.state!=='BOOTSTRAP_DISPATCH_SENT_ONCE_NO_RETRY')process.exitCode=1;
}
main().catch(()=>{console.error('MONITOR_BOOTSTRAP_DISPATCH_BLOCKED: retain any ledger; no retry or schedule.');process.exitCode=1});
