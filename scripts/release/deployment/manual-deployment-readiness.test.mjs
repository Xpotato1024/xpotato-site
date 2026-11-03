import test from 'node:test';
import assert from 'node:assert/strict';
import {assessManualDeploymentSetup} from './manual-deployment-readiness.mjs';
const fixture=()=>({repository:'Xpotato1024/xpotato-site',repositorySecretNames:['CLOUDFLARE_SITE_MONITOR_READ_TOKEN','SITE_MONITOR_APPROVED_BASELINE_JSON'],environment:'site-production',environmentSecretNames:[],environmentVariableNames:[],environmentBranches:['main'],reviewers:['Xpotato1024'],adminBypass:false,workflowEvents:['workflow_dispatch'],productionJobEnabled:false,deploymentWired:false,monitorStatus:'PROPOSED'});
test('current metadata identifies missing wiring without demanding per-deploy token creation',()=>{
 const result=assessManualDeploymentSetup(fixture());
 assert.deepEqual(result.blockers,['ENVIRONMENT_DEPLOY_SECRET_MISSING','DEPLOY_CONTEXT_METADATA_MISSING','PRODUCTION_JOB_DISABLED','DEPLOYMENT_NOT_WIRED','CONTINUOUS_MONITORING_NOT_ACTIVE']);
 assert.equal(result.perOperationTokenCreation,false);assert.equal(result.perOperationRevoke,false);assert.equal(result.deployAllowed,false);
});
test('secret presence alone never establishes validity or deploy permission',()=>{
 const input=fixture();Object.assign(input,{environmentSecretNames:['CLOUDFLARE_SITE_API_TOKEN'],environmentVariableNames:['CLOUDFLARE_SITE_DEPLOY_CONTEXT_JSON'],productionJobEnabled:true,deploymentWired:true,monitorStatus:'ACTIVE'});
 const result=assessManualDeploymentSetup(input);assert.equal(result.status,'METADATA_PRESENT_LIVE_VALIDATION_REQUIRED');assert.equal(result.credentialValidity,'UNVERIFIED');assert.equal(result.deployAllowed,false);
});
test('monitor secret cannot substitute for the Environment deploy secret',()=>{
 const input=fixture();input.environmentSecretNames=['CLOUDFLARE_SITE_MONITOR_READ_TOKEN'];assert.ok(assessManualDeploymentSetup(input).blockers.includes('ENVIRONMENT_DEPLOY_SECRET_MISSING'));
});
test('automatic events and a broader environment cannot pass setup metadata',()=>{
 const input=fixture();Object.assign(input,{workflowEvents:['workflow_dispatch','push'],environmentBranches:['main','preview'],adminBypass:true});const result=assessManualDeploymentSetup(input);assert.ok(result.blockers.includes('MANUAL_ONLY_EVENT_NOT_VERIFIED'));assert.ok(result.blockers.includes('ENVIRONMENT_NOT_VERIFIED'));
});
test('repository-wide deploy secret is diagnosed as an unaccepted location',()=>{
 const input=fixture();input.repositorySecretNames.push('CLOUDFLARE_SITE_API_TOKEN');assert.ok(assessManualDeploymentSetup(input).blockers.includes('DEPLOY_SECRET_LOCATION_NOT_ACCEPTED'));
});
test('secret values and unknown input fields are rejected',()=>{
 assert.throws(()=>assessManualDeploymentSetup({...fixture(),secretValue:'synthetic-unusable'}),/METADATA_ONLY_FIELDS_REQUIRED/);
});
test('approved initial sequence does not require the next monitor to exist before Site deployment',()=>{
 const input=fixture();input.deploymentPhase='INITIAL_SITE_BEFORE_NEW_MONITOR';const result=assessManualDeploymentSetup(input);
 assert.ok(!result.blockers.includes('CONTINUOUS_MONITORING_NOT_ACTIVE'));assert.equal(result.monitoringAdmission,'INITIAL_MANUAL_ADMISSION_REVIEW_REQUIRED');assert.equal(result.providerPreflight,'NOT_RUN');assert.equal(result.deployAllowed,false);
});
