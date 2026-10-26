import {admit} from './baseline.mjs';
import {inspect} from './inspect.mjs';
import {REASONS,LIMITS,canonical,createBudget,exact,hash,parseJson,utf8} from './runtime.mjs';
export const STATE_KEY='xpotato-site-monitor-v1';
const kinds=['NORMAL','PUBLIC_FAILURE','CONFIG_DRIFT','UNKNOWN'];
const stamp=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(Date.parse(v)).toISOString()===v;
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const reasons=v=>Array.isArray(v)&&v.length<=REASONS.length&&v.every(x=>REASONS.includes(x))&&new Set(v).size===v.length&&[...v].sort().join('|')===v.join('|');
function observation(v) {
  return exact(v,['kind','configuration','publicStatus','reasons','at'])&&kinds.includes(v.kind)&&['PASS','DRIFT','UNKNOWN'].includes(v.configuration)
    &&['PASS','FAIL','UNKNOWN'].includes(v.publicStatus)&&reasons(v.reasons)&&stamp(v.at)
    &&(v.kind==='NORMAL'?v.reasons.length===0:v.reasons.length>0)
    &&v.kind===(v.publicStatus==='FAIL'?'PUBLIC_FAILURE':v.configuration==='DRIFT'?'CONFIG_DRIFT':v.configuration==='UNKNOWN'||v.publicStatus==='UNKNOWN'?'UNKNOWN':'NORMAL');
}
export function validateState(state,scope,now) {
  if(!exact(state,['schemaVersion','scope','lastSlot','lastObserved','retainedIncident','lastAttempt'])||state.schemaVersion!==1||state.scope!==scope
    ||!Number.isSafeInteger(state.lastSlot)||state.lastSlot<0||state.lastSlot>Math.floor(now/3600000)||!observation(state.lastObserved)||Date.parse(state.lastObserved.at)>now)throw Error('STATE_INVALID');
  const incident=state.retainedIncident;
  if(incident!==null&&(!exact(incident,['firstAt','firstReasons','latestAt','latestReasons'])||!stamp(incident.firstAt)||!stamp(incident.latestAt)
    ||!reasons(incident.firstReasons)||!incident.firstReasons.length||!reasons(incident.latestReasons)||!incident.latestReasons.length
    ||Date.parse(incident.firstAt)>Date.parse(incident.latestAt)||Date.parse(incident.latestAt)>Date.parse(state.lastObserved.at)))throw Error('INCIDENT_INVALID');
  if(state.lastObserved.kind!=='NORMAL'&&incident===null)throw Error('INCIDENT_MISSING');
  const attempt=state.lastAttempt;
  if(attempt!==null&&incident===null)throw Error('ATTEMPT_WITHOUT_INCIDENT');
  if(attempt!==null&&(!exact(attempt,['signature','at','status'])||!digest(attempt.signature)||!stamp(attempt.at)||Date.parse(attempt.at)>Date.parse(state.lastObserved.at)
    ||!['RESERVED','ACCEPTED','UNCONFIRMED'].includes(attempt.status)))throw Error('ATTEMPT_INVALID');
  return state;
}
function nextState(previous,scope,slot,result,at) {
  let retained=previous?.retainedIncident??null;
  if(result.kind!=='NORMAL'){
    retained=retained?{...retained,latestAt:at,latestReasons:result.reasons}:{firstAt:at,firstReasons:result.reasons,latestAt:at,latestReasons:result.reasons};
  }
  return {schemaVersion:1,scope,lastSlot:slot,lastObserved:{...result,at},retainedIncident:retained,lastAttempt:previous?.lastAttempt??null};
}
const important=result=>canonical({kind:result.kind,configuration:result.configuration,publicStatus:result.publicStatus,reasons:result.reasons});
export const needsAlert=(previous,result)=>result.kind!=='NORMAL'&&(!previous?.lastAttempt||previous.lastAttempt.status==='ACCEPTED')&&(!previous||important(previous.lastObserved)!==important(result));
const labels={PUBLIC_FAILURE:'公開応答の異常',CONFIG_DRIFT:'公開基準との設定不一致',UNKNOWN:'監視で確認できない項目があります'};
export function message(result,at) {
  // Only fixed enums and the observation time are permitted; never exception/provider text.
  if(!kinds.includes(result.kind)||result.kind==='NORMAL'||!reasons(result.reasons)||!stamp(at))throw Error('MESSAGE_INVALID');
  const text='xpotato.net: '+labels[result.kind]+'\n観測日時: '+at+'\n理由: '+result.reasons.join(', ')+'\n確認が必要です。過去incidentは自動解除していません。';
  if(utf8(text).length>4096)throw Error('MESSAGE_TOO_LARGE');
  return {subject:'xpotato.net 監視: '+labels[result.kind],text};
}
export async function runScheduled(controller,env,{fetchImpl=fetch,clock=Date.now}={}) {
  const budget=createBudget(clock);
  const receipt=(status,more={})=>({status,counts:{...budget.counts},cpuAcceptance:'NOT_MEASURED_IN_CLOUDFLARE',recoveryNotifications:false,...more});
  let admission;
  try{admission=await admit(env,controller,clock());budget.check();}catch{return receipt('CONFIGURATION_NOT_READY');}
  if(!admission)return receipt('INACTIVE_OR_STALE');
  const {baseline,scope,slot}=admission;let previous;
  try{
    budget.spend('kvRead');
    const raw=await budget.wait(()=>env.MONITOR_STATE.get(STATE_KEY));
    if(raw!==null)previous=validateState(parseJson(raw,LIMITS.state),scope,clock());
  }catch{return receipt('STATE_UNKNOWN_NO_SIDE_EFFECTS');}
  if(previous&&slot<=previous.lastSlot)return receipt('DUPLICATE_OR_OLDER_NO_SIDE_EFFECTS',{incidentRetained:previous.retainedIncident!==null});
  const result=await inspect(baseline,budget,fetchImpl,()=>env.SITE_READ_TOKEN);
  const at=new Date(clock()).toISOString(),state=nextState(previous,scope,slot,result,at),wanted=needsAlert(previous,result);
  if(wanted)state.lastAttempt={signature:await hash(utf8(important(result))),at,status:'RESERVED'};
  const save=async()=>{
    const text=JSON.stringify(state);validateState(state,scope,clock());
    if(utf8(text).length>LIMITS.state)throw Error('STATE_TOO_LARGE');
    budget.spend('kvWrite');await budget.wait(()=>env.MONITOR_STATE.put(STATE_KEY,text));budget.check();
  };
  // Reserve the incident/attempt before mail. Ambiguous mail/crash is never automatically replayed.
  try{await save();}catch{return receipt('STATE_WRITE_UNCONFIRMED_MAIL_BLOCKED',{observation:result,incidentRetained:Boolean(previous?.retainedIncident)});}
  if(!wanted)return receipt(result.kind!=='NORMAL'&&state.lastAttempt&&state.lastAttempt.status!=='ACCEPTED'?'OBSERVED_MAIL_BLOCKED_BY_UNCONFIRMED_ATTEMPT':'OBSERVED_NO_MAIL',{observation:result,incidentRetained:state.retainedIncident!==null});
  try{
    const body=message(result,at);budget.spend('mail');
    const accepted=await budget.wait(()=>env.NOTIFY_OWNER.send({from:env.NOTIFY_FROM,to:env.NOTIFY_TO,...body}));
    if(!accepted||typeof accepted.messageId!=='string'||!accepted.messageId)throw Error('MAIL_ACCEPTANCE_UNKNOWN');
    budget.check();state.lastAttempt.status='ACCEPTED';
  }catch{state.lastAttempt.status='UNCONFIRMED';}
  try{await save();}catch{return receipt('MAIL_OR_STATE_UNCONFIRMED',{observation:result,incidentRetained:true});}
  return receipt(state.lastAttempt.status==='ACCEPTED'?'MAIL_ACCEPTED_NOT_INBOX_PROOF':'MAIL_UNCONFIRMED_NO_AUTOMATIC_RETRY',{observation:result,incidentRetained:true});
}
export default {
  async scheduled(controller,env) {
    let result;try{result=await runScheduled(controller,env);}catch{throw Error('MONITOR_EXECUTION_UNCONFIRMED');}
    if(!['OBSERVED_NO_MAIL','MAIL_ACCEPTED_NOT_INBOX_PROOF','INACTIVE_OR_STALE','DUPLICATE_OR_OLDER_NO_SIDE_EFFECTS'].includes(result.status))throw Error(result.status);
  }
};
