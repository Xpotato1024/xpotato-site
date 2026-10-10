// Safe, unadopted candidate only. No provider writes, baseline or comparison.
import {createJsonTransport,transportFailureCode} from './deployment-http.mjs';
import {record,dnsLabel,optionalField,successfulCloudflareEnvelope,emptySettingsBindings,emptyVersionBindings} from './cloudflare-response-shapes.mjs';
import {authority,validateSelection} from './deployment-policy.mjs';
import {fingerprint} from './site-integrity-monitor.mjs';

const id=v=>typeof v==='string'&&/^[a-f0-9]{32}$/.test(v);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const bool=v=>typeof v==='boolean';
const emptyArray=v=>Array.isArray(v)&&v.length===0;
const emptyObject=v=>record(v)&&Object.keys(v).length===0;
const nullable=check=>v=>v===null||check(v);
const oneOf=(...values)=>v=>values.includes(v);
const number=v=>Number.isSafeInteger(v)&&v>=0&&v<=1000000000;
const rate=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1;
const timestamp=v=>typeof v==='string'&&v.length<=40&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v));
const known=(value,fields,required=[])=>record(value)&&Object.keys(value).every(k=>Object.hasOwn(fields,k))&&required.every(k=>Object.hasOwn(value,k))&&Object.keys(value).every(k=>fields[k](value[k]));
const exact=(value,keys)=>record(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
const limitFields={cpu_ms:number,subrequests:number},limits=v=>known(v,limitFields);
const logFields={enabled:bool,invocation_logs:bool,persist:bool,head_sampling_rate:nullable(rate),destinations:emptyArray},logs=v=>known(v,logFields,['enabled','invocation_logs']);
const traceFields={enabled:bool,persist:bool,head_sampling_rate:nullable(rate),destinations:emptyArray,propagation_policy:nullable(oneOf('authenticated','accept'))},traces=v=>known(v,traceFields);
const issueFields={enabled:bool};
const observabilityFields={enabled:bool,redact_query_string:bool,head_sampling_rate:nullable(rate),logs:nullable(logs),traces:nullable(traces),issues:nullable(v=>known(v,issueFields))},observability=v=>known(v,observabilityFields,['enabled']);
const runtimeFields={compatibility_date:oneOf('2026-08-26'),compatibility_flags:emptyArray,usage_model:oneOf('standard','bundled','unbound'),limits};
const placementFields={mode:oneOf('smart'),status:oneOf('SUCCESS','UNSUPPORTED_APPLICATION','INSUFFICIENT_INVOCATIONS'),last_analyzed_at:timestamp};
// Exact empty JSON structure is an observation, never a disabled-state claim.
// Check own descriptors before values so unknown/hidden/accessor keys cannot
// disappear into the canonical JSON hash or be read by this policy.
const placementShape=v=>record(v)&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).every(k=>{
 const d=Object.getOwnPropertyDescriptor(v,k);return typeof k==='string'&&Object.hasOwn(placementFields,k)&&d.enumerable&&Object.hasOwn(d,'value');
});
const emptyPlacement=v=>placementShape(v)&&Reflect.ownKeys(v).length===0;
const placement=v=>placementShape(v)&&(emptyPlacement(v)||known(v,placementFields,['mode']));
const ownData=(v,k)=>{const d=record(v)&&Object.getOwnPropertyDescriptor(v,k);return d&&Object.hasOwn(d,'value')?d.value:undefined};
const placementSetting=v=>{
 if(Object.getPrototypeOf(v)!==Object.prototype)return false;
 const d=Object.getOwnPropertyDescriptor(v,'placement');return !d||d.enumerable&&Object.hasOwn(d,'value')&&placement(d.value);
};
const cacheFields={enabled:v=>v===false},cacheOptions=v=>known(v,cacheFields,['enabled']);
// Documented version annotations are metadata, not bindings or authority.
// Hash their full admitted JSON; never emit text. Keep byte budgets explicit.
const boundedText=max=>v=>typeof v==='string'&&Buffer.byteLength(v,'utf8')<=max;
const annotationFields={'workers/message':boundedText(1000),'workers/tag':boundedText(100),'workers/triggered_by':boundedText(1000)};
const annotationLabels={'workers/message':'message','workers/tag':'tag','workers/triggered_by':'triggered_by'};
const annotations=v=>known(v,annotationFields);

// Empty bindings are checked before inspecting other result fields. A nonempty
// binding/unsupported freeform container is rejected without reading values.
const settingsPolicyFields={bindings:emptyArray,...runtimeFields,placement,logpush:bool,observability,tags:nullable(emptyArray),tail_consumers:nullable(emptyArray),annotations,exports_reconciliation:emptyObject,cache_options:cacheOptions};
export const safeSettings=v=>emptySettingsBindings(v)&&placementSetting(v)&&known(v,settingsPolicyFields,['bindings']);
const scriptSettingsFields={logpush:bool,observability:nullable(observability),tags:nullable(emptyArray),tail_consumers:nullable(emptyArray)};
export const safeScriptSettings=v=>known(v,scriptSettingsFields);
const scriptResourceFields={etag:v=>typeof v==='string'&&/^(?:[a-f0-9]{32}|[a-f0-9]{64})$/.test(v),handlers:v=>Array.isArray(v)&&v.length<=1&&(v.length===0||v[0]==='fetch'),last_deployed_from:oneOf('api','wrangler','dashboard'),named_handlers:emptyArray};
const scriptRuntimeFields={...runtimeFields,exports:emptyObject,migration_tag:v=>v===''};
const resourceFields={bindings:v=>emptyObject(v)||emptyArray(v),script:v=>known(v,scriptResourceFields),script_runtime:v=>known(v,scriptRuntimeFields)};
export const safeResources=v=>emptyVersionBindings({resources:v})&&known(v,resourceFields,['bindings']);
const metadataFields={author_email:v=>v==='',author_id:v=>v==='',created_on:timestamp,modified_on:timestamp,hasPreview:bool,source:oneOf('api','wrangler','terraform','dash','cf_cli','dash_template','integration','quick_editor','playground','workersci')};
const versionFields={id:uuid,resources:safeResources,number,metadata:v=>known(v,metadataFields)};
export const safeVersion=v=>known(v,versionFields,['id','resources']);
const subdomainFields={subdomain:dnsLabel};
export const safeSubdomain=v=>known(v,subdomainFields,['subdomain']);
const pageInfo=v=>known(v,{page:number,per_page:number,count:number,total_count:number,total_pages:number});
const envelopeFields={success:v=>v===true,errors:emptyArray,result:()=>true,messages:emptyArray,result_info:pageInfo};
export const safeCandidateEnvelope=v=>successfulCloudflareEnvelope(v)&&known(v,envelopeFields,['success','errors','result']);
// Public token-create guide's success info, not a grant of token authority.
// Only this singleton tuple is admitted; unknown/additional metadata stays blocked.
const tokenMessages=v=>emptyArray(v)||Array.isArray(v)&&v.length===1&&known(v[0],{code:v=>v===10000,message:v=>v==='This API Token is valid and active',type:v=>v===null},['code','message']);
export const safeTokenEnvelope=v=>successfulCloudflareEnvelope(v)&&known(v,{...envelopeFields,messages:tokenMessages},['success','errors','result']);
const tokenFieldNames=['id','status','expires_on','not_before'];
const tokenGateKeys=['tokenEnvelope','tokenResultShape','tokenResultFields','tokenIdShape','tokenIdentity','tokenStatusShape','tokenExpiresShape','tokenNotBeforeShape'];
const tokenCheckKeys=['tokenEnvelope','tokenEnvelopeFields','tokenSuccess','tokenErrorsEmpty','tokenMessagesAllowed','tokenPageInfoShape','tokenResultShape','tokenResultFields','tokenIdShape','tokenIdentity','tokenStatusShape','tokenExpiresShape','tokenNotBeforeShape'];
const type=v=>v===undefined?'MISSING':v===null?'NULL':Array.isArray(v)?'ARRAY':({object:'OBJECT',string:'STRING',number:'NUMBER',boolean:'BOOLEAN'}[typeof v]||'OTHER');
const field=(v,k)=>record(v)&&Object.hasOwn(v,k)?type(v[k]):'MISSING';
const tokenFieldKeys=['envelope','success','errors','result','messages','result_info','id','status','expires_on','not_before','name','issued_on','modified_on'];
const transportCodes=new Set(['INVALID_TRANSPORT_CONFIGURATION','INVALID_OPERATION_CONTEXT','REQUEST_NOT_ALLOWED','AUTHENTICATION_UNAVAILABLE','REMOTE_TIMEOUT','REMOTE_REDIRECT_REJECTED','REMOTE_HTTP_401','REMOTE_HTTP_403','REMOTE_HTTP_404','REMOTE_HTTP_429','REMOTE_HTTP_FAILURE','REMOTE_CONTENT_TYPE','REMOTE_BODY_LIMIT','REMOTE_BODY_UNREADABLE','REMOTE_INVALID_JSON','REMOTE_REQUEST_FAILED']);
const unavailableTokenFields=()=>Object.fromEntries(tokenFieldKeys.map(k=>[k,'UNAVAILABLE']));
// Only fixed field types and verdicts; no response keys/values, IDs or timestamps.
// Presence of name/issued_on/modified_on is diagnostic only: it stays rejected.
export function candidateTokenDiagnostics(body,expectedId){
 const v=record(body)?body.result:undefined,own=k=>record(v)&&Object.hasOwn(v,k);
 const fields={envelope:type(body),success:field(body,'success'),errors:field(body,'errors'),result:field(body,'result'),messages:field(body,'messages'),result_info:field(body,'result_info'),
  id:field(v,'id'),status:field(v,'status'),expires_on:field(v,'expires_on'),not_before:field(v,'not_before'),name:field(v,'name'),issued_on:field(v,'issued_on'),modified_on:field(v,'modified_on')};
 const verdict=b=>b?'PASS':'FAIL',idShape=own('id')&&id(v.id);
 const checks={tokenEnvelope:verdict(safeTokenEnvelope(body)),
  tokenEnvelopeFields:verdict(record(body)&&Object.keys(body).every(k=>Object.hasOwn(envelopeFields,k))),
  tokenSuccess:verdict(record(body)&&Object.hasOwn(body,'success')&&body.success===true),
  tokenErrorsEmpty:verdict(record(body)&&Object.hasOwn(body,'errors')&&emptyArray(body.errors)),
  tokenMessagesAllowed:verdict(optionalField(body,'messages',tokenMessages)),tokenPageInfoShape:verdict(optionalField(body,'result_info',pageInfo)),
  tokenResultShape:verdict(record(v)),tokenResultFields:verdict(record(v)&&Object.keys(v).every(k=>tokenFieldNames.includes(k))),
  tokenIdShape:verdict(idShape),tokenIdentity:idShape?verdict(v.id===expectedId):'NOT_CHECKED',
  tokenStatusShape:verdict(own('status')&&oneOf('active','disabled','expired')(v.status)),
  tokenExpiresShape:verdict(optionalField(v,'expires_on',timestamp)),tokenNotBeforeShape:verdict(optionalField(v,'not_before',timestamp))};
 return {fields,checks};
}

// Fixed policy paths only. Never inspect binding properties or unknown values
// or copy response keys/values into diagnostic labels.
const settingsDiagnosticScopes=[
 ['',[],settingsPolicyFields,['bindings']],['limits_',['limits'],limitFields,[]],
 ['placement_',['placement'],placementFields,['mode']],['observability_',['observability'],observabilityFields,['enabled']],
 ['logs_',['observability','logs'],logFields,['enabled','invocation_logs']],['traces_',['observability','traces'],traceFields,[]],
 ['issues_',['observability','issues'],issueFields,[]],['cache_options_',['cache_options'],cacheFields,['enabled']],
 ['annotations_',['annotations'],annotationFields,[],annotationLabels]
];
const diagnosticLabel=(prefix,key,labels)=>prefix+(labels?.[key]??key);
const settingsFieldKeys=['result',...settingsDiagnosticScopes.flatMap(([prefix,,rules,,labels])=>Object.keys(rules).map(key=>diagnosticLabel(prefix,key,labels)))];
const settingsDiagnosticKeys=['safeSettings',...settingsDiagnosticScopes.flatMap(([prefix,,rules,,labels])=>[prefix+'fieldsAllowed',...Object.keys(rules).map(key=>diagnosticLabel(prefix,key,labels))])];
const unavailableSettingsDiagnostics=()=>({fields:Object.fromEntries(settingsFieldKeys.map(key=>[key,'UNAVAILABLE'])),checks:Object.fromEntries(settingsDiagnosticKeys.map(key=>[key,'NOT_CHECKED']))});
export function candidateSettingsDiagnostics(value){
 const d=unavailableSettingsDiagnostics(),verdict=v=>v?'PASS':'FAIL';d.fields.result=type(value);d.checks.safeSettings=verdict(safeSettings(value));
 for(const [prefix,path,rules,required,labels] of settingsDiagnosticScopes){
  const v=path.reduce((parent,key)=>key==='placement'?ownData(parent,key):record(parent)&&Object.hasOwn(parent,key)?parent[key]:undefined,value);
  for(const key of Object.keys(rules))d.fields[diagnosticLabel(prefix,key,labels)]=prefix==='placement_'||prefix===''&&key==='placement'?type(ownData(v,key)):field(v,key);
  if(path.length&&(v===undefined||v===null))continue;
  d.checks[prefix+'fieldsAllowed']=verdict(prefix==='placement_'?placementShape(v):record(v)&&Object.keys(v).every(key=>Object.hasOwn(rules,key)));
  if(!record(v))continue;
  if(prefix==='placement_'&&!placementShape(v))continue;
  // mode=MISSING is valid absence only for the exact empty observation.
  const requiredHere=prefix==='placement_'&&emptyPlacement(v)?[]:required;
  for(const key of Object.keys(rules))d.checks[diagnosticLabel(prefix,key,labels)]=verdict(prefix===''&&key==='placement'?placementSetting(v):requiredHere.includes(key)?Object.hasOwn(v,key)&&rules[key](v[key]):optionalField(v,key,rules[key]));
 }
 return d;
}

// The remaining three GETs use a compact fixed vocabulary. An unread endpoint
// has no fields; an observed endpoint exposes all fixed types and failed labels.
const loggingScopes=[['observability_',['observability'],observabilityFields,['enabled']],['logs_',['observability','logs'],logFields,['enabled','invocation_logs']],['traces_',['observability','traces'],traceFields,[]],['issues_',['observability','issues'],issueFields,[]]];
const endpointSpecs={
 scriptSettings:{safe:safeScriptSettings,scopes:[['',[],scriptSettingsFields,[]],...loggingScopes]},
 version:{safe:safeVersion,scopes:[['',[],versionFields,['id','resources']],['resources_',['resources'],resourceFields,['bindings']],['script_',['resources','script'],scriptResourceFields,[]],['runtime_',['resources','script_runtime'],scriptRuntimeFields,[]],['limits_',['resources','script_runtime','limits'],limitFields,[]],['metadata_',['metadata'],metadataFields,[]]]},
 accountSubdomain:{safe:safeSubdomain,scopes:[['',[],subdomainFields,['subdomain']]]}
};
const unreadEndpoint=()=>({status:'NOT_CHECKED',fieldTypes:{},failedChecks:[]});
const unreadEndpoints=()=>Object.fromEntries(Object.keys(endpointSpecs).map(key=>[key,unreadEndpoint()]));
export function candidateEndpointDiagnostics(endpoint,body,expectedVersionId){
 if(!Object.hasOwn(endpointSpecs,endpoint))throw Error('INVALID_DIAGNOSTIC_ENDPOINT');
 const spec=endpointSpecs[endpoint],value=record(body)?body.result:undefined,d={status:'PASS',fields:{envelope:type(body),result:type(value)},failedChecks:[]};
 const check=(label,pass)=>{if(!pass)d.failedChecks.push(label)};
 check('envelopeSafe',safeCandidateEnvelope(body));
 check('envelope_fieldsAllowed',record(body)&&Object.keys(body).every(k=>Object.hasOwn(envelopeFields,k)));
 for(const key of Object.keys(envelopeFields)){d.fields['envelope_'+key]=field(body,key);check('envelope_'+key,['success','errors','result'].includes(key)?record(body)&&Object.hasOwn(body,key)&&envelopeFields[key](body[key]):optionalField(body,key,envelopeFields[key]));}
 check('resultSafe',spec.safe(value));
 if(endpoint==='version')check('idMatches',record(value)&&value.id===expectedVersionId);
 for(const [prefix,path,rules,required] of spec.scopes){
  const v=path.reduce((parent,key)=>record(parent)&&Object.hasOwn(parent,key)?parent[key]:undefined,value);
  for(const key of Object.keys(rules))d.fields[prefix+key]=field(v,key);
  if(path.length&&(v===undefined||v===null))continue;
  check(prefix+'fieldsAllowed',record(v)&&Object.keys(v).every(k=>Object.hasOwn(rules,k)));
  if(!record(v))continue;
  for(const key of Object.keys(rules))check(prefix+key,required.includes(key)?Object.hasOwn(v,key)&&rules[key](v[key]):optionalField(v,key,rules[key]));
 }
 const fieldTypes={};for(const [label,kind] of Object.entries(d.fields))(fieldTypes[kind]??=[]).push(label);
 return {status:d.failedChecks.length?'FAIL':'PASS',fieldTypes,failedChecks:d.failedChecks};
}

export const seedKeys=Object.freeze(['schemaVersion','selection','accountId','credentialId','workerTag','deploymentId','versionId','zoneId','homeSha256']);
export const conditionSeed=e=>Object.fromEntries(seedKeys.map(k=>[k,e[k]]));
export function validConditionSeed(e){
 if(!exact(e,seedKeys)||e.schemaVersion!==2||![e.accountId,e.credentialId,e.workerTag,e.zoneId].every(id)||![e.deploymentId,e.versionId].every(uuid)||!hash(e.homeSha256)||!exact(e.selection,['runId','runAttempt','artifactId','sourceSha','digest']))return false;
 try{validateSelection(e.selection);return true}catch{return false}
}
const sourceValid=s=>exact(s,['sourceSha','runId','runAttempt'])&&/^[a-f0-9]{40}$/.test(s.sourceSha)&&/^[1-9][0-9]{0,19}$/.test(s.runId)&&Number.isSafeInteger(s.runAttempt)&&s.runAttempt>0;
const toggle=(parent,key)=>!record(parent)||!Object.hasOwn(parent,key)?'UNSET':parent[key]===null?'NULL':parent[key]?'ON':'OFF';
const sampling=(parent,key)=>!record(parent)||!Object.hasOwn(parent,key)?'UNSET':parent[key];
const unsetNumber=(parent,key)=>!record(parent)||!Object.hasOwn(parent,key)?'UNSET':parent[key];
const present=(parent,key)=>!record(parent)||!Object.hasOwn(parent,key)?'UNSET':parent[key]===null?'NULL':'PRESENT';
const emptyState=(parent,key)=>!record(parent)||!Object.hasOwn(parent,key)?'UNSET':parent[key]===null?'NULL':'EMPTY';
const enumValue=(parent,key)=>!record(parent)||!Object.hasOwn(parent,key)?'UNSET':parent[key];
function runtimeSummary(v){return {compatibilityDate:present(v,'compatibility_date')==='PRESENT'?'MATCH':'UNSET',compatibilityFlags:emptyState(v,'compatibility_flags'),usageModel:enumValue(v,'usage_model'),cpuLimitMs:unsetNumber(v?.limits,'cpu_ms'),subrequestLimit:unsetNumber(v?.limits,'subrequests')}}
function loggingSummary(v){
 const o=v?.observability,l=o?.logs,t=o?.traces;
 return {logpush:toggle(v,'logpush'),observability:present(v,'observability'),enabled:toggle(o,'enabled'),redactQueryString:toggle(o,'redact_query_string'),headSamplingRate:sampling(o,'head_sampling_rate'),
 logs:present(o,'logs'),logsEnabled:toggle(l,'enabled'),invocationLogs:toggle(l,'invocation_logs'),logPersistence:toggle(l,'persist'),logSamplingRate:sampling(l,'head_sampling_rate'),logDestinations:emptyState(l,'destinations'),
 traces:present(o,'traces'),tracesEnabled:toggle(t,'enabled'),tracePersistence:toggle(t,'persist'),traceSamplingRate:sampling(t,'head_sampling_rate'),tracePropagation:enumValue(t,'propagation_policy'),traceDestinations:emptyState(t,'destinations'),issues:present(o,'issues'),issuesEnabled:toggle(o?.issues,'enabled'),
 tags:emptyState(v,'tags'),tailConsumers:emptyState(v,'tail_consumers')};
}
const summaryUnavailable=()=>({bindings:'UNAVAILABLE',settings:'UNAVAILABLE',scriptSettings:'UNAVAILABLE',versionRuntime:'UNAVAILABLE',versionScript:'UNAVAILABLE',accountLabel:'UNAVAILABLE'});
function summarize(settings,script,resources){
 return {bindings:'EMPTY',
 settings:{...runtimeSummary(settings),...loggingSummary(settings),placementState:!Object.hasOwn(settings,'placement')?'MISSING':emptyPlacement(settings.placement)?'EMPTY_OBJECT':'EXPLICIT_MODE',placementMode:enumValue(settings.placement,'mode'),placementStatus:enumValue(settings.placement,'status'),placementAnalysis:present(settings.placement,'last_analyzed_at'),annotations:!Object.hasOwn(settings,'annotations')?'UNSET':Object.keys(settings.annotations).length?'KNOWN_METADATA':'EMPTY',exportsReconciliation:emptyState(settings,'exports_reconciliation'),cacheEnabled:toggle(settings.cache_options,'enabled')},
 scriptSettings:loggingSummary(script),
 versionRuntime:{...runtimeSummary(resources.script_runtime),exports:emptyState(resources.script_runtime,'exports'),migrationTag:emptyState(resources.script_runtime,'migration_tag')},
 versionScript:{etag:present(resources.script,'etag'),handlers:present(resources.script,'handlers')==='UNSET'?'UNSET':resources.script.handlers.length?'FETCH':'EMPTY',lastDeployedFrom:enumValue(resources.script,'last_deployed_from'),namedHandlers:emptyState(resources.script,'named_handlers')},
 accountLabel:'VALIDATED_UNEXPOSED'};
}
class Stop extends Error {}
const checkKeys=['configuration','boundedOperation','transport',...tokenCheckKeys,'tokenActive','tokenExpiresFuture','tokenNotBeforeElapsed','tokenTimes','settingsBindingsEmpty','settingsSafe','scriptSettingsSafe','versionIdentity','versionBindingsEmpty','resourcesSafe','accountSubdomain','candidateReady'];
export async function probeMonitorCandidate({seed,source,credentialProvider,fetchImpl,clock=Date.now,signal}={}){
 const checks=Object.fromEntries(checkKeys.map(k=>[k,'NOT_CHECKED']));
 let candidate=null,summary=summaryUnavailable(),receiptSource=null,tokenFields=unavailableTokenFields(),settingsDiagnostics=unavailableSettingsDiagnostics(),endpointDiagnostics=unreadEndpoints(),transportCode='NOT_CHECKED',timer,abort;
 const controller=new AbortController();
 const receipt=ready=>({status:ready?'CANDIDATE_REVIEW_REQUIRED':'CANDIDATE_BLOCKED',adopted:false,checks:{...checks},transportCode,tokenFields:{...tokenFields},settingsDiagnostics:{fields:{...settingsDiagnostics.fields},checks:{...settingsDiagnostics.checks}},endpointDiagnostics:structuredClone(endpointDiagnostics),summary:{...summary},candidate,source:receiptSource,deployAllowed:false,acceptance:false,providerMutations:0,baselineUpdated:false,monitorActivated:false});
 const requireCheck=(key,value)=>{checks[key]=value?'PASS':'FAIL';if(!value)throw new Stop()};
 try{
  requireCheck('configuration',validConditionSeed(seed)&&sourceValid(source)&&typeof credentialProvider==='function'&&typeof fetchImpl==='function'&&typeof clock==='function'&&(signal===undefined||signal instanceof AbortSignal));
  const e=structuredClone(seed),s=structuredClone(source),started=clock(),deadlineAt=started+60000;
  const operation=()=>{const now=clock();requireCheck('boundedOperation',Number.isFinite(started)&&Number.isFinite(now)&&now>=started&&now<deadlineAt&&!controller.signal.aborted&&!signal?.aborted);return now};
  abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});timer=setTimeout(abort,60000);operation();
  const account='/client/v4/accounts/'+e.accountId,script=account+'/workers/scripts/'+authority.worker;
  const paths=[account+'/tokens/verify',script+'/settings',script+'/script-settings',script+'/versions/'+e.versionId,account+'/workers/subdomain'];
  let credentialPromise,requests=0;
  const request=createJsonTransport({origin:'https://api.cloudflare.com',clock,credentialProvider:context=>credentialPromise??=Promise.resolve().then(()=>credentialProvider(context)),fetchImpl,allowRequest:({path,query,method,body,allow404})=>method==='GET'&&body===undefined&&!allow404&&query.size===0&&paths.includes(path)});
  async function read(index,key){
   operation();requireCheck('boundedOperation',requests<5);requests++;
   const r=await request({path:paths[index],signal:controller.signal,deadlineAt});operation();checks.transport='PASS';transportCode='OK';
   if(index>=2){const endpoint=['scriptSettings','version','accountSubdomain'][index-2];endpointDiagnostics[endpoint]=candidateEndpointDiagnostics(endpoint,r.data,e.versionId);}
   if(index===0){
    const d=candidateTokenDiagnostics(r.data,e.credentialId);tokenFields=d.fields;Object.assign(checks,d.checks);
    for(const gate of tokenGateKeys)requireCheck(gate,d.checks[gate]==='PASS');
   }else requireCheck(key,r.status===200&&safeCandidateEnvelope(r.data));
   if(index===1)settingsDiagnostics=candidateSettingsDiagnostics(r.data.result);
   return r.data.result;
  }
  const token=await read(0,'tokenEnvelope');
  requireCheck('tokenActive',token.status==='active');
  const now=operation();
  checks.tokenExpiresFuture=optionalField(token,'expires_on',v=>Date.parse(v)>now)?'PASS':'FAIL';
  checks.tokenNotBeforeElapsed=optionalField(token,'not_before',v=>Date.parse(v)<=now)?'PASS':'FAIL';
  requireCheck('tokenTimes',checks.tokenExpiresFuture==='PASS'&&checks.tokenNotBeforeElapsed==='PASS');
  const settings=await read(1,'settingsBindingsEmpty');
  requireCheck('settingsBindingsEmpty',emptySettingsBindings(settings));requireCheck('settingsSafe',safeSettings(settings));
  const scriptSettings=await read(2,'scriptSettingsSafe');requireCheck('scriptSettingsSafe',safeScriptSettings(scriptSettings));
  const version=await read(3,'versionIdentity');requireCheck('versionIdentity',record(version)&&version.id===e.versionId);
  requireCheck('versionBindingsEmpty',emptyVersionBindings(version));requireCheck('resourcesSafe',safeVersion(version));
  const subdomain=await read(4,'accountSubdomain');requireCheck('accountSubdomain',safeSubdomain(subdomain));operation();
  // Hash only after ALL five responses pass: failure never produces partial hashes.
  summary=summarize(settings,scriptSettings,version.resources);
  candidate={settingsSha256:fingerprint(settings),scriptSettingsSha256:fingerprint(scriptSettings),versionResourcesSha256:fingerprint(version.resources),accountSubdomainSha256:fingerprint(subdomain)};
  receiptSource={...s,contextSha256:fingerprint(e)};
  requireCheck('candidateReady',Buffer.byteLength(JSON.stringify(receipt(true)),'utf8')<=8192);
  operation();return receipt(true);
 }catch(error){
  candidate=null;receiptSource=null;summary=summaryUnavailable();
  if(!(error instanceof Stop)){const code=transportFailureCode(error);transportCode=transportCodes.has(code)?code:'UNCLASSIFIED';checks.transport='FAIL';if(controller.signal.aborted||signal?.aborted||transportFailureCode(error)==='REMOTE_TIMEOUT')checks.boundedOperation='FAIL'}
  return receipt(false);
 }finally{clearTimeout(timer);if(abort)signal?.removeEventListener('abort',abort);controller.abort()}
}
