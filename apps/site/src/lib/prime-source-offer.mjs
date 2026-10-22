// SPDX-License-Identifier: AGPL-3.0-only
// Build-only; the browser receives static links, no Git or network lookup.
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export function primeSiteSourceOffer(){
 const root=fileURLToPath(new URL('../../../../',import.meta.url));
 const revision=execFileSync('git',['-c','core.fsmonitor=false','-C',root,'rev-parse','--verify','HEAD'],{encoding:'utf8',env:{...process.env,GIT_NO_REPLACE_OBJECTS:'1',GIT_OPTIONAL_LOCKS:'0'}}).trim();
 if(!/^[a-f0-9]{40}$/u.test(revision))throw Error('Exact site build checkout revision required');
 const repository='https://github.com/Xpotato1024/xpotato-site';
 return {revision,sourceUrl:repository+'/tree/'+revision,offerUrl:repository+'/blob/'+revision+'/SITE_SOURCE_OFFER.md',archiveUrl:repository+'/archive/'+revision+'.zip'};
}
