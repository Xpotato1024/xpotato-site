// This executable is an explicit opt-in host boundary. Imports of the library
// never consult environment credentials. The repository workflow remains false.
import {readFile} from 'node:fs/promises';
import {createIntegrityMonitor} from './site-integrity-monitor.mjs';
async function main(){
 if(process.argv.length!==3||process.env.SITE_MONITOR_AUTHORIZATION!=='separately-approved-readonly-monitor')throw Error('BLOCKED');
 const baseline=JSON.parse(await readFile(process.argv[2],'utf8'));
 const monitor=createIntegrityMonitor({baseline,credentialProvider:async()=>process.env.CLOUDFLARE_SITE_MONITOR_READ_TOKEN,fetchImpl:fetch});
 const receipt=await monitor.check();
 console.log(JSON.stringify(receipt));
 if(receipt.status!=='OBSERVED_MATCH'){console.error('Site integrity incident: STOP deployment. Owner Dashboard revocation and known-good artifact recovery required.');process.exitCode=1}
}
main().catch(()=>{console.error('Site integrity monitor unavailable: STOP deployment; owner investigation required.');process.exitCode=1});
