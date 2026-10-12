// Draft: metadata-only setup diagnostics; never reads secret values or deploys.
import {persistentPolicy} from './deployment-persistent-policy.mjs';
export function assessManualDeploymentSetup(metadata) {
  const permitted=['repository','repositorySecretNames','environment','environmentSecretNames','environmentVariableNames','environmentBranches','reviewers','adminBypass','workflowEvents','productionJobEnabled','deploymentWired','monitorStatus','deploymentPhase'];
  if (!metadata || Object.keys(metadata).some(key=>!permitted.includes(key))) throw Error('METADATA_ONLY_FIELDS_REQUIRED');
  const names=key=>Array.isArray(metadata[key]) && metadata[key].every(value=>typeof value==='string') ? metadata[key] : [];
  const blockers=[];
  if (metadata.repository!=='Xpotato1024/xpotato-site') blockers.push('REPOSITORY_NOT_VERIFIED');
  if (metadata.environment!==persistentPolicy.environment || JSON.stringify(names('environmentBranches'))!=='["main"]' || JSON.stringify(names('reviewers'))!=='["Xpotato1024"]' || metadata.adminBypass!==false) blockers.push('ENVIRONMENT_NOT_VERIFIED');
  if (!names('environmentSecretNames').includes(persistentPolicy.secretName)) blockers.push('ENVIRONMENT_DEPLOY_SECRET_MISSING');
  const contextNames=['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_SITE_TOKEN_ID','CLOUDFLARE_SITE_WORKER_TAG','CLOUDFLARE_SITE_EDITOR_PERMISSION_ID'];
  if (!contextNames.every(name=>names('environmentVariableNames').includes(name))) blockers.push('DEPLOY_CONTEXT_METADATA_MISSING');
  if (names('repositorySecretNames').includes(persistentPolicy.secretName)) blockers.push('DEPLOY_SECRET_LOCATION_NOT_ACCEPTED');
  if (JSON.stringify(names('workflowEvents'))!=='["workflow_dispatch"]') blockers.push('MANUAL_ONLY_EVENT_NOT_VERIFIED');
  if (metadata.productionJobEnabled!==true) blockers.push('PRODUCTION_JOB_DISABLED');
  if (metadata.deploymentWired!==true) blockers.push('DEPLOYMENT_NOT_WIRED');
  const initial=metadata.deploymentPhase==='INITIAL_SITE_BEFORE_NEW_MONITOR';
  if (!initial && metadata.monitorStatus!=='ACTIVE') blockers.push('CONTINUOUS_MONITORING_NOT_ACTIVE');
  return Object.freeze({status: blockers.length ? 'SETUP_INCOMPLETE' : 'METADATA_PRESENT_LIVE_VALIDATION_REQUIRED', blockers, secretName:persistentPolicy.secretName, environment:persistentPolicy.environment, perOperationTokenCreation:false, perOperationRevoke:false, credentialValidity:'UNVERIFIED', monitoringAdmission:initial?'INITIAL_MANUAL_ADMISSION_REVIEW_REQUIRED':'CONTINUOUS_MONITOR_REQUIRED', providerPreflight:'NOT_RUN', deployAllowed:false, deployExecuted:false});
}
