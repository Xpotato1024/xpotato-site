// Existing deployed bytes are a verification subject, never a deployment input
// authorized by this adapter. No Wrangler adapter or deployment process is used.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readPublicTargets} from './manual-deployment.mjs';
import {validateSelection} from './deployment-policy.mjs';

const execute=promisify(execFile),handles=new WeakMap();
const repositoryRoot=fileURLToPath(new URL('../../../',import.meta.url));
const fail=()=>{throw Error('READBACK_ARTIFACT_UNVERIFIED');};
class ArtifactUnavailable extends Error{}
export const readbackArtifactFailure=error=>error instanceof ArtifactUnavailable?'READBACK_ARTIFACT_UNAVAILABLE':null;
function handle(kind,selection,load){
  validateSelection(selection);
  const safeLoad=async()=>{try{return await load();}catch{throw new ArtifactUnavailable('READBACK_ARTIFACT_UNAVAILABLE');}};
  const value=Object.freeze({});handles.set(value,Object.freeze({kind,selection:Object.freeze(structuredClone(selection)),load:safeLoad}));return value;
}
export function openCanonicalReadbackArtifact({operationRoot,selection,githubCredential}){
  validateSelection(selection);
  if(typeof operationRoot!=='string'||resolve(operationRoot)!==operationRoot||typeof githubCredential!=='function')fail();
  const root=resolve(operationRoot),selected=structuredClone(selection);
  return handle('canonical-consumer',selected,async()=>{
    // The original source's held IDs come from its immutable Git object, not a
    // caller-supplied target list or historical public observations.
    const manifest=JSON.parse((await execute('git',['show',selected.sourceSha+':docs/migration/content-materialization-v1.json'],
      {cwd:repositoryRoot,encoding:'utf8',maxBuffer:1048576,windowsHide:true})).stdout);
    const held=manifest.records?.filter(row=>row.collection==='blog');
    if(manifest.schemaVersion!==1||manifest.materializationVersion!=='legacy-content-materialization-v1'||held?.length!==44
      ||held.some(row=>row.targetDraft!==true||JSON.stringify(row.publicationHoldReasons)!=='["blog_media_registry"]'))fail();
    const credential=await githubCredential();if(typeof credential!=='string'||!credential)fail();
    const env={};for(const key of ['SystemRoot','SYSTEMROOT','WINDIR','PATH','Path','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA'])
      if(typeof process.env[key]==='string')env[key]=process.env[key];
    if(process.platform!=='win32'||!env.SystemRoot)fail();
    env.GITHUB_TOKEN=credential;
    const script=fileURLToPath(new URL('../artifact/Read-ManualArtifactHandoff.ps1',import.meta.url));
    const args=['-NoProfile','-NonInteractive','-File',script,'-OperationRoot',root,'-ArtifactId',selected.artifactId,
      '-RunId',selected.runId,'-RunAttempt',String(selected.runAttempt),'-ExpectedDigest',selected.digest,'-SourceSha',selected.sourceSha];
    const result=await execute(join(env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),args,
      {env,encoding:'utf8',timeout:180000,maxBuffer:1048576,windowsHide:true});
    const handoff=JSON.parse(result.stdout.trim());
    if(handoff.mode!=='Production'||handoff.sourceSha!==selected.sourceSha||handoff.artifactId!==selected.artifactId||handoff.digest!==selected.digest)fail();
    const plan=await readPublicTargets(join(root,'staging'),selected,held.map(row=>row.vNextContentId));
    return {handoff,plan};
  });
}
export async function acquireCanonicalReadbackArtifact({operationRoot,selection,githubCredential}){
  // No caller-selected executable, script or environment is accepted.
  const artifact=openCanonicalReadbackArtifact({operationRoot,selection,githubCredential});
  try{
    if(process.platform!=='win32'||!process.env.SystemRoot)fail();
    const token=await githubCredential();if(typeof token!=='string'||!token)fail();
    const env={};for(const key of ['SystemRoot','SYSTEMROOT','WINDIR','PATH','Path','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA'])
      if(typeof process.env[key]==='string')env[key]=process.env[key];env.GITHUB_TOKEN=token;
    const args=['-NoProfile','-NonInteractive','-File',fileURLToPath(new URL('../artifact/Get-ReleaseArtifact.ps1',import.meta.url)),
      '-Mode','Production','-OperationRoot',operationRoot,'-ArtifactId',selection.artifactId,'-RunId',selection.runId,
      '-RunAttempt',String(selection.runAttempt),'-ExpectedDigest',selection.digest,'-SourceSha',selection.sourceSha];
    await execute(join(env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),args,
      {env,encoding:'utf8',timeout:180000,maxBuffer:1048576,windowsHide:true});return artifact;
  }catch{throw new ArtifactUnavailable('READBACK_ARTIFACT_UNAVAILABLE');}
}
// Explicitly synthetic and unforgeably branded as such, even if used with the
// default network transport. No injected receipt can promote this into live proof.
export function createSyntheticReadbackArtifact({selection,load}){
  if(typeof load!=='function')fail();return handle('synthetic',selection,load);
}
export function readbackArtifact(handleValue){
  const entry=handles.get(handleValue);if(!entry)fail();return entry;
}
export async function currentVerifierRevision(){
  const options={cwd:repositoryRoot,encoding:'utf8',maxBuffer:1048576,windowsHide:true};
  const head=(await execute('git',['rev-parse','HEAD'],options)).stdout.trim();
  const dirty=(await execute('git',['status','--porcelain=v1','--untracked-files=normal'],options)).stdout;
  if(dirty||!/^[a-f0-9]{40}$/.test(head))throw Error('READBACK_VERIFIER_REVISION');return head;
}
