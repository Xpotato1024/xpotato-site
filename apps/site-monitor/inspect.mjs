import {completeDomainInventory,domainSetMatches,emptySettingsBindings,emptyVersionBindings,readablePageInfo,record,successfulCloudflareEnvelope,dnsLabel} from '../../scripts/release/cloudflare-response-shapes.mjs';
import {Fault,canonical,fail,hash,parseJson,readBytes,utf8} from './runtime.mjs';
import {PHOTOS} from './baseline.mjs';
const worker='xpotato-site',hostname='xpotato.net';
const unknown=()=>fail('UNKNOWN','API_SHAPE_UNKNOWN');
const drift=reason=>fail('CONFIG_DRIFT',reason);
export async function inspect(baseline,budget,fetchImpl,credentialProvider) {
  const p=baseline.provider;let credential,subdomain;
  const reasons=new Set();let configuration='PASS',publicStatus='PASS';
  const account='/client/v4/accounts/'+p.accountId,script=account+'/workers/scripts/'+worker;
  const singles=new Set([account+'/tokens/verify',account+'/workers/scripts',script+'/settings',script+'/script-settings',script+'/versions/'+p.versionId,script+'/subdomain',account+'/workers/subdomain','/client/v4/zones/'+p.zoneId+'/workers/routes',account+'/workers/domains']);
  async function get(path,endpoint) {
    const parsed=new URL('https://api.cloudflare.com'+path);
    if(!singles.has(parsed.pathname)&&parsed.pathname!==script+'/deployments')unknown();
    if(parsed.pathname===script+'/deployments'){
      if(parsed.searchParams.size!==2||parsed.searchParams.get('per_page')!=='100'||!/^[1-8]$/.test(parsed.searchParams.get('page')))unknown();
    }else if(parsed.search)unknown();
    budget.check();
    if(credential===undefined){credential=credentialProvider();if(typeof credential!=='string'||!credential||/[\r\n]/.test(credential))fail('UNKNOWN','CREDENTIAL_UNUSABLE');}
    const bytes=await readBytes(parsed.href,{headers:{Authorization:'Bearer '+credential}},'provider',budget,fetchImpl);
    let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail('UNKNOWN','API_JSON_INVALID');}
    const body=parseJson(text);
    if(!successfulCloudflareEnvelope(body,endpoint)||!Object.hasOwn(body,'result'))unknown();
    return body;
  }
  const fingerprint=async value=>{const result=await hash(utf8(canonical(value)));budget.check();return result;};
  async function list() {
    const rows=[],seen=new Set();let total;
    for(let page=1;page<=8;page++){
      const body=await get(script+'/deployments?page='+page+'&per_page=100'),items=body.result?.deployments,i=body.result_info;
      if(!Array.isArray(items)||!items.every(record)||!record(i)||i.page!==page||i.per_page!==100||i.count!==items.length
        ||!Number.isSafeInteger(i.total_count)||i.total_count<0||i.total_count>800||items.length>100
        ||i.total_pages!==undefined&&i.total_pages!==Math.max(1,Math.ceil(i.total_count/100)))unknown();
      total??=i.total_count;if(total!==i.total_count)unknown();
      for(const item of items){if(typeof item.id!=='string'||seen.has(item.id))unknown();seen.add(item.id);rows.push(item);}
      if(rows.length===total)return rows;if(!items.length||rows.length>total)unknown();
    }unknown();
  }
  function inventory(body,singlePageContract=false) {
    if(!Array.isArray(body.result)||!body.result.every(record)||!singlePageContract&&(!record(body.result_info)||body.result_info.count!==body.result.length||body.result_info.total_count!==body.result.length)||!readablePageInfo(body,body.result,{singlePage:true}))unknown();
    return body.result;
  }
  async function providerCheck() {
    const token=(await get(account+'/tokens/verify')).result;
    if(!record(token)||typeof token.id!=='string'||typeof token.status!=='string')unknown();
    if(token.id!==p.credentialId||token.status!=='active')fail('UNKNOWN','CREDENTIAL_UNUSABLE');
    const identities=inventory(await get(account+'/workers/scripts')),matches=identities.filter(x=>x.id===worker);
    if(matches.length!==1||matches[0].tag!==p.workerTag)drift('CONFIG_IDENTITY');
    const active=(await list())[0];
    if(!record(active)||!Array.isArray(active.versions))unknown();
    if(active.id!==p.deploymentId||active.strategy!=='percentage'||active.versions.length!==1
      ||active.versions[0]?.version_id!==p.versionId||active.versions[0]?.percentage!==100)drift('CONFIG_DEPLOYMENT');
    const settings=(await get(script+'/settings')).result,scriptSettings=(await get(script+'/script-settings')).result,version=(await get(script+'/versions/'+p.versionId)).result;
    if(!record(settings)||!record(scriptSettings)||!record(version)||!record(version.resources)||!Object.hasOwn(settings,'bindings')||!Object.hasOwn(version.resources,'bindings'))unknown();
    if(!Array.isArray(settings.bindings)||!settings.bindings.every(record)||!(record(version.resources.bindings)||Array.isArray(version.resources.bindings)&&version.resources.bindings.every(record)))unknown();
    if(!emptySettingsBindings(settings)||!emptyVersionBindings(version))drift('CONFIG_BINDINGS');
    if(version.id!==p.versionId)drift('CONFIG_IDENTITY');
    if(await fingerprint(settings)!==p.settingsSha256||await fingerprint(scriptSettings)!==p.scriptSettingsSha256||await fingerprint(version.resources)!==p.versionResourcesSha256)drift('CONFIG_SETTINGS');
    const flags=(await get(script+'/subdomain')).result;
    if(!record(flags)||typeof flags.enabled!=='boolean'||typeof flags.previews_enabled!=='boolean')unknown();
    if(flags.enabled||flags.previews_enabled)drift('CONFIG_ENDPOINTS');
    const domains=await get(account+'/workers/domains','account-worker-domains');
    if(!completeDomainInventory(domains))unknown();
    if(!domainSetMatches(domains.result,worker,hostname)||!domains.result.some(row=>row.hostname===hostname&&row.zone_id===p.zoneId))drift('CONFIG_DOMAIN');
    // Reuse the reviewed unfiltered SinglePage route contract; metadata, when present, must be consistent.
    const routes=inventory(await get('/client/v4/zones/'+p.zoneId+'/workers/routes'),true);
    const routeIds=new Set();
    for(const row of routes){
      if(typeof row.id!=='string'||routeIds.has(row.id)||typeof row.pattern!=='string'||!Object.hasOwn(row,'script')||row.script!==null&&typeof row.script!=='string')unknown();
      routeIds.add(row.id);const match=/^(?:https?:\/\/)?([a-z0-9.*-]+)(?:\/.*)?$/.exec(row.pattern);
      if(!match)unknown();
      const host=match[1],pattern=host.replace(/\./g,'\\.').replace(/\*/g,'.*');
      if(row.script===worker||host==='*'||host==='*.'+hostname||new RegExp('^'+pattern+'$').test(hostname))drift('CONFIG_ROUTE');
    }
    const accountDomain=(await get(account+'/workers/subdomain')).result;
    if(!record(accountDomain)||!dnsLabel(accountDomain.subdomain))unknown();
    if(await fingerprint(accountDomain)!==p.accountSubdomainSha256)drift('CONFIG_ENDPOINTS');
    subdomain=accountDomain.subdomain;
    const after=(await list())[0];
    if(canonical(after)!==canonical(active)||await fingerprint((await get(script+'/settings')).result)!==p.settingsSha256
      ||await fingerprint((await get(script+'/script-settings')).result)!==p.scriptSettingsSha256
      ||canonical((await get(script+'/subdomain')).result)!==canonical(flags))drift('CONFIG_CHANGED_DURING_READ');
  }
  function add(error,part) {
    const safe=error instanceof Fault?error:new Fault('UNKNOWN','API_UNAVAILABLE');
    reasons.add(safe.reason);
    if(part==='provider')configuration=safe.kind==='CONFIG_DRIFT'?'DRIFT':'UNKNOWN';
    else if(publicStatus!=='FAIL')publicStatus=safe.kind==='PUBLIC_FAILURE'?'FAIL':'UNKNOWN';
  }
  try{await providerCheck();}catch(error){add(error,'provider');}
  const targets=[{url:'https://'+hostname+'/',...baseline.home,photo:false},...PHOTOS.map(row=>({url:'https://'+hostname+row.path,bytes:row.bytes,sha256:row.sha256,photo:true}))];
  if(subdomain){
    targets.push({url:'https://'+worker+'.'+subdomain+'.workers.dev/',status:404},
      {url:'https://'+p.versionId.slice(0,8)+'-'+worker+'.'+subdomain+'.workers.dev/',status:404});
  }
  for(const target of targets) {
    try{
      const bytes=await readBytes(target.url,{expectedStatus:target.status??200,photo:target.photo,headers:{'Accept-Encoding':'identity','Cache-Control':'no-cache'}},'public',budget,fetchImpl);
      const digest=await hash(bytes);budget.check();
      if(target.sha256&&(bytes.length!==target.bytes||digest!==target.sha256))fail('PUBLIC_FAILURE',target.photo?'PHOTO_RESPONSE':'PUBLIC_RESPONSE');
      if(target.status===404&&([baseline.home.sha256,...PHOTOS.map(x=>x.sha256)].includes(digest)))fail('PUBLIC_FAILURE','PUBLIC_RESPONSE');
    }catch(error){add(error,'public');if(budget.counts.public>=16||budget.expired())break;}
  }
  return {kind:publicStatus==='FAIL'?'PUBLIC_FAILURE':configuration==='DRIFT'?'CONFIG_DRIFT':configuration==='UNKNOWN'||publicStatus==='UNKNOWN'?'UNKNOWN':'NORMAL',configuration,publicStatus,reasons:[...reasons].sort()};
}
