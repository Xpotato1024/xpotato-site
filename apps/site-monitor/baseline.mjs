import {homeWorkshopPublicObjects} from '../../scripts/release/home-workshop-public-objects.mjs';
import {canonical,exact,hash,parseJson,utf8} from './runtime.mjs';
export const RELEASE=Object.freeze({
  sourceSha:'1c6091e81d732c0c92356742e18f2a6905fc7795',runId:'38485145014',runAttempt:1,
  artifactId:'11859965419',digest:'sha256:38fd7b058e369ccff9b728b1902a700306e0dafdeddb3b2734d7a76c28afdf3e',
  productionRunId:'38485905907'
});
export const PHOTOS=homeWorkshopPublicObjects;
export const PHOTO_SET_SHA256='534e8c93df658cc6f517dbfbe5e96d76ce6069fb45d5ac1d2dbfb0f3e466b3a2';
const id=v=>typeof v==='string'&&/^[a-f0-9]{32}$/.test(v);
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const email=v=>typeof v==='string'&&v.length<=254&&/^[a-zA-Z0-9.!#$%&'*+/=?^_{}|~-]+@[a-zA-Z0-9.-]+$/.test(v);
export async function admit(env,controller,now) {
  if(env.MONITOR_ENABLED!=='true')return null;
  if(controller?.cron!=='0 * * * *'||!Number.isSafeInteger(controller.scheduledTime)||controller.scheduledTime>now||now-controller.scheduledTime>=3600000)return null;
  const b=parseJson(env.APPROVED_BASELINE_JSON,4096);
  if(!exact(b,['schemaVersion','status','release','provider','home','notification'])||b.schemaVersion!==1||b.status!=='OWNER_APPROVED')throw Error('BASELINE_NOT_APPROVED');
  if(canonical(b.release)!==canonical(RELEASE))throw Error('DEPLOYED_RELEASE_REQUIRED');
  const p=b.provider;
  if(!exact(p,['accountId','workerTag','credentialId','deploymentId','versionId','zoneId','settingsSha256','scriptSettingsSha256','versionResourcesSha256','accountSubdomainSha256'])
    ||![p.accountId,p.workerTag,p.credentialId,p.zoneId].every(id)||![p.deploymentId,p.versionId].every(uuid)
    ||![p.settingsSha256,p.scriptSettingsSha256,p.versionResourcesSha256,p.accountSubdomainSha256].every(sha))throw Error('PRIVATE_BASELINE_REQUIRED');
  if(!exact(b.home,['bytes','sha256'])||!sha(b.home.sha256)||!Number.isSafeInteger(b.home.bytes)||b.home.bytes<1||b.home.bytes>1048576)throw Error('PUBLIC_BASELINE_REQUIRED');
  if(PHOTOS.length!==13||PHOTOS.reduce((n,row)=>n+row.bytes,0)!==2804363
    ||await hash(utf8(JSON.stringify(PHOTOS)))!==PHOTO_SET_SHA256)throw Error('PHOTO_SCOPE_CHANGED');
  const n=b.notification;
  if(!exact(n,['toSha256','fromSha256','routingDomain','recoveryApproved'])||![n.toSha256,n.fromSha256].every(sha)||n.recoveryApproved!==false
    ||typeof n.routingDomain!=='string'||!n.routingDomain.split('.').every(label=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))||n.routingDomain.length>253)throw Error('NOTIFICATION_POLICY');
  if(!email(env.NOTIFY_TO)||!email(env.NOTIFY_FROM)||env.NOTIFY_FROM.split('@')[1]!==n.routingDomain
    ||await hash(utf8(env.NOTIFY_TO))!==n.toSha256||await hash(utf8(env.NOTIFY_FROM))!==n.fromSha256)throw Error('FIXED_DESTINATION_REQUIRED');
  if(typeof env.MONITOR_STATE?.get!=='function'||typeof env.MONITOR_STATE?.put!=='function'||typeof env.NOTIFY_OWNER?.send!=='function')throw Error('APPROVED_BINDINGS_REQUIRED');
  return {baseline:b,scope:await hash(utf8(canonical(b))),slot:Math.floor(controller.scheduledTime/3600000)};
}
