import {it,expect} from 'vitest';
import {createRequire} from 'node:module';
const {assertToolQuiet}=createRequire(import.meta.url)('./browser-tool-interaction.mjs');
const origin='http://127.0.0.1:12345',source='blob:'+origin+'/owned',policy={origin,ownedWorkerSources:[source]};
const request=(url:string,resourceType='Script')=>({kind:'request',url,resourceType});
it('sync remains transport-free; bounded tools admit only their exact local Worker Script sources',()=>{
 expect(()=>assertToolQuiet([],[],'canary')).not.toThrow();
 expect(()=>assertToolQuiet([request(source)],[],'canary')).toThrow();
 expect(()=>assertToolQuiet([request(source)],[],'canary',policy)).not.toThrow();
 for(const event of [request(origin+'/asset.js'),request('blob:'+origin+'/unknown'),request(source,'Fetch'),{kind:'Runtime.exceptionThrown',url:source},{kind:'Network.webSocketCreated',url:source},{kind:'Page.windowOpen',url:source}])expect(()=>assertToolQuiet([event],[],'canary',policy)).toThrow();
 expect(()=>assertToolQuiet([],['/worker-request'], 'canary',policy)).toThrow();
});
it('owned sources cannot cross origin, acquire a query/fragment, or carry input canaries',()=>{
 for(const value of ['blob:https://foreign.invalid/owned',source+'?input=1',source+'#input',origin+'/owned'])expect(()=>assertToolQuiet([],[],'canary',{origin,ownedWorkerSources:[value]})).toThrow();
 expect(()=>assertToolQuiet([request(source+'canary')],[],'canary',{origin,ownedWorkerSources:[source+'canary']})).toThrow();
});
