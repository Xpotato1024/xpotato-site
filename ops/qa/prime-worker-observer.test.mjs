import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preparePrimeWorkerObserver} from './prime-worker-observer.mjs';

test('all independent observation commands start before any ACK and resume only after all ACKs', async()=>{
 const calls=[],pending=[];
 const send=(method,params,session)=>{calls.push({method,params,session});return new Promise((resolve,reject)=>pending.push({resolve,reject}));};
 const done=preparePrimeWorkerObserver(send,'worker-1');
 assert.deepEqual(calls.map(x=>x.method),['Network.enable','Network.setCacheDisabled','Runtime.enable']);
 assert.ok(calls.every(x=>x.session==='worker-1'));assert.deepEqual(calls[1].params,{cacheDisabled:true});
 pending[2].resolve();pending[0].resolve();await Promise.resolve();
 assert.equal(calls.length,3,'No execution with partially configured observation');
 pending[1].resolve();await new Promise(r=>setImmediate(r));
 assert.equal(calls[3].method,'Runtime.runIfWaitingForDebugger');
 assert.equal(calls[3].session,'worker-1');pending[3].resolve();await done;
});
for(const failed of [0,1,2])test('observer setup failure never resumes a blind Worker: '+failed,async()=>{
 const calls=[];await assert.rejects(preparePrimeWorkerObserver((method)=>{
   const i=calls.push(method)-1;return i===failed?Promise.reject(Error('setup failed')):Promise.resolve();
 },'worker'),/setup failed/);
 assert.equal(calls.includes('Runtime.runIfWaitingForDebugger'),false);
});
