import {fingerprint,sha256} from './canonical.js';
import type {CodexAuditProfile} from './codex-audit.js';
/** A deliberately narrow local-parser failure, not a provider readback or a
 * generic retry permit. Exact official-executable/process/input/hash binding
 * is required by the caller before this observation may be recorded.
 */
export function codexConfigRejectedBeforeDispatch(input:{plan:any;prior:any;snapshot:any;profile:CodexAuditProfile;
 processInput:any;processRecord:any;stdout:Uint8Array;stderr:Uint8Array;prompt:string;schemaSha256:string}){
 const {plan,prior,snapshot,profile,processInput:p,processRecord:r,stdout,stderr,prompt,schemaSha256}=input;
 const duration=Date.parse(r.finishedAt)-Date.parse(r.startedAt);
 const diagnostic='Error loading config.toml: unknown configuration field `tools.view_image` in -c/--config override\n';
 if(prior.state!=='unknown'||prior.planSha256!==fingerprint(plan)
  ||plan.operationId!=='audit-'+snapshot.request.requestId||plan.stage!==snapshot.request.stage
  ||fingerprint({request:snapshot.request,profile:snapshot.profile,transport:profile})!==plan.contextSha256
  ||p.protocol!=='xpotato-codex-audit-process-v1'||r.protocol!==p.protocol
  ||p.executable!==profile.executable||p.executableSha256!==profile.executableSha256||r.executableSha256!==profile.executableSha256
  ||p.model!==profile.model||r.model!==profile.model||p.prompt!==prompt||sha256(prompt)!==r.promptSha256
  ||sha256(p.schema)!==schemaSha256||r.schemaSha256!==schemaSha256
  ||r.exitCode!==1||r.stopped!==false||r.containmentFailed!==false||r.freshContext!==true
  ||r.toolPolicy!=='no-shell-apps-web-image-tools-v1'||!Number.isSafeInteger(r.processId)||r.processId<1
  ||!Number.isFinite(duration)||duration<0||duration>5000||Date.parse(r.finishedAt)>Date.now()
  ||stdout.byteLength!==0||r.stdoutSha256!==sha256(stdout)||r.stderrSha256!==sha256(stderr)
  ||new TextDecoder('utf-8',{fatal:true}).decode(stderr).replaceAll('\r\n','\n')!==diagnostic
  ||fingerprint(p.images.map((i:any)=>i.sha256))!==fingerprint(r.imageSha256s))throw Error('CODEX_AUDIT_PREDISPATCH_NOT_PROVEN');
 return {protocol:'xpotato-private-codex-audit-predispatch-v1',planSha256:fingerprint(plan),priorResultSha256:prior.resultSha256,
  invocationSha256:fingerprint(snapshot),processSha256:fingerprint(r),processInputSha256:fingerprint(p),
  reason:'local_cli_config_rejected_before_turn',modelInvoked:false,formalReceipt:false,productionEligible:false};
}
