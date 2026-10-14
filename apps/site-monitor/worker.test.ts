import {afterEach,describe,expect,it,vi} from 'vitest';
import {PHOTOS,RELEASE,admit} from './baseline.mjs';
import {canonical,createBudget,hash,LIMITS,parseJson,readBytes,utf8} from './runtime.mjs';
import {runScheduled,STATE_KEY,validateState,message} from './worker.mjs';
afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers();});
const originalDigest=crypto.subtle.digest.bind(crypto.subtle);
const hex=(s:string)=>Uint8Array.from(s.match(/../g)!,x=>parseInt(x,16)).buffer;
async function fixture() {
  const settings={bindings:[]},scriptSettings={compatibility_date:'2026-10-14'},resources={bindings:{}},accountDomain={subdomain:'synthetic-account'};
  const fingerprint=async(v:any)=>hash(utf8(canonical(v)));
  const p={accountId:'a'.repeat(32),workerTag:'b'.repeat(32),credentialId:'c'.repeat(32),zoneId:'d'.repeat(32),
    deploymentId:'11111111-1111-1111-1111-111111111111',versionId:'22222222-2222-2222-2222-222222222222',
    settingsSha256:await fingerprint(settings),scriptSettingsSha256:await fingerprint(scriptSettings),
    versionResourcesSha256:await fingerprint(resources),accountSubdomainSha256:await fingerprint(accountDomain)};
  const home=utf8('<html>SYNTHETIC</html>');
  const baseline={schemaVersion:1,status:'OWNER_APPROVED',release:RELEASE,provider:p,home:{bytes:home.length,sha256:await hash(home)},
    notification:{toSha256:await hash(utf8('owner@example.test')),fromSha256:await hash(utf8('monitor@example.test')),routingDomain:'example.test',recoveryApproved:false}};
  // Synthetic bytes model descriptor matching; this does not verify real photo SHA or decoding.
  const original=originalDigest;
  vi.spyOn(crypto.subtle,'digest').mockImplementation(async(algorithm:any,data:any)=>{
    const bytes=new Uint8Array(data.buffer??data,data.byteOffset??0,data.byteLength);
    const photo=PHOTOS.find((row:any,i:number)=>bytes.length===row.bytes&&bytes[0]===i+1&&bytes[1]===99);
    return photo?hex(photo.sha256):original(algorithm,data);
  });
  let raw:string|null=null,now=Date.parse('2026-10-14T10:00:01Z'),writes=0,tokenReads=0;
  const mode:any={homeBad:false,photoBad:false,photoOversize:false,omitRouteMetadata:false,providerStatus:200,pages:1,routes:[],bindings:false,malformedBindings:false,mailFail:false,writeFail:0,readFail:false,partial:false};
  const calls:any[]=[],mails:any[]=[];
  const env:any={MONITOR_ENABLED:'true',APPROVED_BASELINE_JSON:JSON.stringify(baseline),NOTIFY_TO:'owner@example.test',NOTIFY_FROM:'monitor@example.test',
    MONITOR_STATE:{get:async(key:string)=>{expect(key).toBe(STATE_KEY);if(mode.readFail)throw Error('RAW_SECRET');return raw;},
      put:async(key:string,value:string)=>{writes++;if(mode.writeFail===writes)throw Error('RAW_SECRET');raw=value;}},
    NOTIFY_OWNER:{send:async(mail:any)=>{mails.push(mail);if(mode.mailFail)throw Error('RAW_SECRET');return {messageId:'SYNTHETIC_ACCEPTANCE'};}}};
  Object.defineProperty(env,'SITE_READ_TOKEN',{get(){tokenReads++;return 'SYNTHETIC_READ_TOKEN_NOT_A_CREDENTIAL';}});
  const envelope=(result:any,count?:number)=>({success:true,errors:[],result,...(count===undefined?{}:{result_info:{page:1,per_page:1000,count,total_count:count,total_pages:1}})});
  const active={id:p.deploymentId,strategy:'percentage',versions:[{version_id:p.versionId,percentage:100}]};
  const fetchImpl=async(url:string,options:any)=>{
    calls.push({url,method:options.method,redirect:options.redirect});
    const u=new URL(url);
    if(u.hostname!=='api.cloudflare.com'){
      if(u.hostname.endsWith('.workers.dev'))return new Response('closed',{status:404});
      if(u.pathname==='/')return new Response(home,{status:mode.homeBad?500:200});
      const index=PHOTOS.findIndex((row:any)=>row.path===u.pathname);
      if(index<0)throw Error('UNEXPECTED_TARGET');
      const body=new Uint8Array(mode.photoOversize?LIMITS.body+1:PHOTOS[index].bytes);body[0]=index+1;body[1]=99;
      return new Response(body,{status:mode.photoBad?500:200});
    }
    if(mode.providerStatus!==200)return new Response('RAW_SECRET',{status:mode.providerStatus});
    let body:any,path=u.pathname;
    if(path.endsWith('/tokens/verify'))body=envelope({id:p.credentialId,status:'active'});
    else if(path.endsWith('/workers/scripts'))body=envelope([{id:'xpotato-site',tag:p.workerTag}],1);
    else if(path.endsWith('/deployments')){
      const page=Number(u.searchParams.get('page')),total=mode.pages===1?1:mode.pages*100;
      const rows=Array.from({length:total===1?1:100},(_,i)=>page===1&&i===0?active:{...active,id:'synthetic-'+((page-1)*100+i)});
      body={...envelope({deployments:rows}),result_info:{page,per_page:100,count:rows.length,total_count:mode.partial?801:total,total_pages:mode.pages}};
    }else if(path.endsWith('/script-settings'))body=envelope(scriptSettings);
    else if(path.endsWith('/settings'))body=envelope(mode.malformedBindings?{bindings:null}:mode.bindings?{bindings:[{type:'kv_namespace',name:'UNEXPECTED'}]}:settings);
    else if(path.includes('/versions/'))body=envelope({id:p.versionId,resources});
    else if(path.endsWith('/workers/subdomain'))body=envelope(accountDomain);
    else if(path.endsWith('/subdomain'))body=envelope({enabled:false,previews_enabled:false});
    else if(path.endsWith('/workers/domains'))body=envelope([{id:'synthetic-domain',service:'xpotato-site',hostname:'xpotato.net',environment:'production',zone_id:p.zoneId}],1);
    else if(path.endsWith('/workers/routes'))body=envelope(mode.routes,mode.omitRouteMetadata?undefined:mode.routes.length);
    else throw Error('UNEXPECTED_PROVIDER_TARGET');
    return new Response(JSON.stringify(body));
  };
  const run=()=>runScheduled({cron:'0 * * * *',scheduledTime:Math.floor(now/3600000)*3600000},env,{fetchImpl,clock:()=>now});
  return {mode,env,calls,mails,run,baseline,getRaw:()=>raw,setRaw:(v:string|null)=>{raw=v;},advance:()=>{now+=3600000;},clock:()=>now,tokenReads:()=>tokenReads,writes:()=>writes};
}
describe('offline Worker end-to-end',()=>{
  it('checks home, all thirteen photos, closed alternate endpoints; normal is silent',async()=>{
    const f=await fixture(),r=await f.run();expect(r.status).toBe('OBSERVED_NO_MAIL');expect(r.observation.kind).toBe('NORMAL');
    expect(r.counts).toEqual({provider:14,public:16,kvRead:1,kvWrite:1,mail:0});expect(f.mails).toHaveLength(0);
    expect(f.calls.every(x=>x.method==='GET'&&x.redirect==='manual')).toBe(true);
    expect(JSON.parse(f.getRaw()!).retainedIncident).toBeNull();expect(r.cpuAcceptance).toBe('NOT_MEASURED_IN_CLOUDFLARE');
  });
  it('first fault and important reason change notify once; recovery preserves incident and stays silent',async()=>{
    const f=await fixture();f.mode.homeBad=true;expect((await f.run()).status).toBe('MAIL_ACCEPTED_NOT_INBOX_PROOF');
    const first=JSON.parse(f.getRaw()!).retainedIncident.firstAt;f.advance();await f.run();expect(f.mails).toHaveLength(1);
    f.mode.photoBad=true;f.advance();await f.run();expect(f.mails).toHaveLength(2);
    f.mode.homeBad=false;f.mode.photoBad=false;f.advance();const good=await f.run();expect(good.observation.kind).toBe('NORMAL');
    expect(f.mails).toHaveLength(2);expect(JSON.parse(f.getRaw()!).retainedIncident.firstAt).toBe(first);
    expect(JSON.stringify(f.mails)).not.toContain('RAW_SECRET');
  });
  it('UNKNOWN is distinct from public PASS and cannot clear old incident',async()=>{
    const f=await fixture();f.mode.providerStatus=403;const r=await f.run();
    expect(r.observation).toEqual({kind:'UNKNOWN',configuration:'UNKNOWN',publicStatus:'PASS',reasons:['API_ACCESS_DENIED']});
    expect(r.counts.provider).toBe(1);f.advance();await f.run();expect(f.mails).toHaveLength(1);
  });
  it('detects positive bindings and wildcard route drift',async()=>{
    const f=await fixture();f.mode.bindings=true;expect((await f.run()).observation.reasons).toContain('CONFIG_BINDINGS');
    f.mode.bindings=false;f.mode.routes=[{id:'synthetic-route',pattern:'*/*',script:null}];f.advance();
    expect((await f.run()).observation.reasons).toContain('CONFIG_ROUTE');
  });
  it('complete eight-page history fits the conservative aggregate bound',async()=>{
    const f=await fixture();f.mode.pages=8;const r=await f.run();expect(r.observation.kind).toBe('NORMAL');
    expect(r.counts.provider).toBe(28);expect(Object.values(r.counts).reduce((a:any,b:any)=>a+b,0)).toBe(46);
    f.advance();f.mode.partial=true;expect((await f.run()).observation.kind).toBe('UNKNOWN');
  });
  it('rejects inactive, delayed, old-release, and recipient mismatch before credential or KV access',async()=>{
    const f=await fixture();f.env.MONITOR_ENABLED='false';expect((await f.run()).counts.kvRead).toBe(0);
    f.env.MONITOR_ENABLED='true';f.baseline.release={...RELEASE,sourceSha:'0'.repeat(40)};f.env.APPROVED_BASELINE_JSON=JSON.stringify(f.baseline);
    expect((await f.run()).status).toBe('CONFIGURATION_NOT_READY');expect(f.tokenReads()).toBe(0);
    const g=await fixture();g.env.NOTIFY_TO='other@example.test';expect((await g.run()).counts.kvRead).toBe(0);
    const r=await runScheduled({cron:'0 * * * *',scheduledTime:g.clock()-3600000},g.env,{clock:g.clock});expect(r.status).toBe('INACTIVE_OR_STALE');
  });
  it('invalid or unavailable state causes zero provider and mail side effects',async()=>{
    const f=await fixture();f.setRaw('{"scope":"RAW_SECRET"}');expect((await f.run()).status).toBe('STATE_UNKNOWN_NO_SIDE_EFFECTS');
    f.setRaw(null);f.mode.readFail=true;await f.run();expect(f.calls).toHaveLength(0);expect(f.mails).toHaveLength(0);expect(f.tokenReads()).toBe(0);
  });
  it('duplicate slot stops before credential reference',async()=>{
    const f=await fixture();await f.run();const count=f.tokenReads();const r=await f.run();
    expect(r.status).toBe('DUPLICATE_OR_OLDER_NO_SIDE_EFFECTS');expect(r.counts.provider).toBe(0);expect(f.tokenReads()).toBe(count);
  });
  it('reserves before mail and never replays an ambiguous send',async()=>{
    const f=await fixture();f.mode.homeBad=true;f.mode.mailFail=true;const r=await f.run();
    expect(r.status).toBe('MAIL_UNCONFIRMED_NO_AUTOMATIC_RETRY');expect(JSON.parse(f.getRaw()!).lastAttempt.status).toBe('UNCONFIRMED');
    f.advance();f.mode.mailFail=false;await f.run();expect(f.mails).toHaveLength(1);
    const g=await fixture();g.mode.homeBad=true;g.mode.writeFail=2;expect((await g.run()).status).toBe('MAIL_OR_STATE_UNCONFIRMED');
    expect(JSON.parse(g.getRaw()!).lastAttempt.status).toBe('RESERVED');g.advance();await g.run();expect(g.mails).toHaveLength(1);
  });
  it('failed reservation blocks mail',async()=>{
    const f=await fixture();f.mode.homeBad=true;f.mode.writeFail=1;const r=await f.run();
    expect(r.status).toBe('STATE_WRITE_UNCONFIRMED_MAIL_BLOCKED');expect(r.incidentRetained).toBe(false);expect(f.mails).toHaveLength(0);
  });
  it('KV eventual consistency is not an atomic duplicate fence',async()=>{
    const f=await fixture();f.mode.homeBad=true;await f.run();f.setRaw(null);await f.run();
    expect(f.mails).toHaveLength(2); // documented live limitation, not an exactly-once guarantee
  });
});
describe('finite and sanitized transport',()=>{
  it.each(['{"x":1,"x":2}','1e999','['.repeat(34)+'0'+']'.repeat(34),'[1,]','{"x":NaN}'])('rejects malformed or unbounded JSON %s',(raw)=>expect(()=>parseJson(raw)).toThrow());
  it('uses a null-prototype object and a real known SHA vector',async()=>{
    expect(Object.getPrototypeOf(parseJson('{"__proto__":{}}'))).toBeNull();
    expect(await hash(utf8('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('enforces request and elapsed budgets before starting more work',()=>{
    let now=0;const b=createBudget(()=>now);for(let i=0;i<LIMITS.provider;i++)b.spend('provider');
    expect(()=>b.spend('provider')).toThrow('BUDGET_EXCEEDED');now=120000;expect(()=>b.spend('public')).toThrow('BUDGET_EXCEEDED');
  });
  it('rejects oversize, redirects and raw failures without retry',async()=>{
    const b=createBudget(Date.now),fetcher=vi.fn(async()=>new Response(new Uint8Array(LIMITS.body+1)));
    await expect(readBytes('https://example.test',{},'provider',b,fetcher)).rejects.toThrow('BUDGET_EXCEEDED');expect(fetcher).toHaveBeenCalledTimes(1);
    await expect(readBytes('https://example.test',{},'provider',b,async()=>new Response('raw',{status:302}))).rejects.toThrow('API_UNAVAILABLE');
  });
  it('limits a hanging fetch to ten seconds and does not wait for cancellation',async()=>{
    vi.useFakeTimers();const b=createBudget(Date.now),request=readBytes('https://example.test',{},'provider',b,()=>new Promise(()=>{}));
    const check=expect(request).rejects.toThrow('API_TIMEOUT');await vi.advanceTimersByTimeAsync(10000);await check;
  });
  it('rejects injected mail reason and inconsistent state',()=>{
    expect(()=>message({kind:'UNKNOWN',reasons:['RAW_SECRET']},'2026-10-14T00:00:00.000Z')).toThrow('MESSAGE_INVALID');
    expect(()=>validateState({schemaVersion:1},'x',0)).toThrow('STATE_INVALID');
  });
});
describe('additional fail-closed boundaries',()=>{
  it('malformed binding is UNKNOWN and explicit recovery policy cannot enable sending',async()=>{
    const f=await fixture();f.mode.malformedBindings=true;expect((await f.run()).observation.kind).toBe('UNKNOWN');
    f.advance();f.baseline.notification.recoveryApproved=true;f.env.APPROVED_BASELINE_JSON=JSON.stringify(f.baseline);
    expect((await f.run()).status).toBe('CONFIGURATION_NOT_READY');
  });
  it('future slot and inconsistent observation state are rejected before credential access',async()=>{
    const f=await fixture();await f.run();const state=JSON.parse(f.getRaw()!),reads=f.tokenReads();
    state.lastSlot+=100;f.setRaw(JSON.stringify(state));f.advance();expect((await f.run()).status).toBe('STATE_UNKNOWN_NO_SIDE_EFFECTS');
    state.lastSlot-=100;state.lastObserved.kind='UNKNOWN';state.lastObserved.reasons=['API_UNAVAILABLE'];f.setRaw(JSON.stringify(state));
    await f.run();expect(f.tokenReads()).toBe(reads);
  });
  it('rejects more than the bounded JSON node count',()=>expect(()=>parseJson('['+Array(32768).fill('0').join(',')+']')).toThrow('API_JSON_INVALID'));
  it('a hanging body with hanging cancel still terminates',async()=>{
    vi.useFakeTimers();const budget=createBudget(Date.now);
    const request=readBytes('https://example.test',{},'provider',budget,async()=>({status:200,body:{getReader:()=>({
      read:()=>new Promise(()=>{}),cancel:()=>new Promise(()=>{}),releaseLock:()=>{}})}}));
    const check=expect(request).rejects.toThrow('API_TIMEOUT');await vi.advanceTimersByTimeAsync(10000);await check;
    expect(budget.counts.provider).toBe(1);
  });
});
describe('independent review regressions',()=>{
  it('ambiguous attempt blocks recurrence and changed reasons after NORMAL',async()=>{
    const f=await fixture();f.mode.homeBad=true;f.mode.mailFail=true;await f.run();
    f.mode.homeBad=false;f.mode.mailFail=false;f.advance();await f.run();f.mode.homeBad=true;f.advance();
    expect((await f.run()).status).toBe('OBSERVED_MAIL_BLOCKED_BY_UNCONFIRMED_ATTEMPT');
    f.mode.photoBad=true;f.advance();await f.run();expect(f.mails).toHaveLength(1);
  });
  it('attempt without incident and future attempt time cannot be used as state',async()=>{
    const f=await fixture();f.mode.homeBad=true;await f.run();const state=JSON.parse(f.getRaw()!);
    state.lastObserved={kind:'NORMAL',configuration:'PASS',publicStatus:'PASS',reasons:[],at:state.lastObserved.at};
    state.retainedIncident=null;expect(()=>validateState(state,state.scope,f.clock())).toThrow('ATTEMPT_WITHOUT_INCIDENT');
  });
  it('expired inspector stops before the lazy credential callback',async()=>{
    const f=await fixture();let now=f.clock();const budget=createBudget(()=>now);now+=120000;
    const {inspect}=await import('./inspect.mjs');const credential=vi.fn(()=>{throw Error('RAW_SECRET');});
    const result=await inspect(f.baseline,budget,async()=>{throw Error('GET_FORBIDDEN');},credential);
    expect(result.kind).toBe('UNKNOWN');expect(credential).not.toHaveBeenCalled();expect(budget.counts.provider).toBe(0);
  });
});
describe('known endpoint and accumulated failure',()=>{
  it('accepts omitted metadata only for the reviewed routes SinglePage contract',async()=>{
    const f=await fixture();f.mode.omitRouteMetadata=true;expect((await f.run()).observation.kind).toBe('NORMAL');
  });
  it('later unreadable photo never erases a positive public failure',async()=>{
    const f=await fixture();f.mode.homeBad=true;f.mode.photoOversize=true;const r=await f.run();
    expect(r.observation.publicStatus).toBe('FAIL');expect(r.observation.kind).toBe('PUBLIC_FAILURE');
    expect(r.observation.reasons).toEqual(['BUDGET_EXCEEDED','PUBLIC_RESPONSE']);
  });
});
