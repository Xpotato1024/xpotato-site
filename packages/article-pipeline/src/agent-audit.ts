import {join} from 'node:path';
import {agentAuditExecutionSchema,sha256Schema} from '@xpotato/content-contracts';
import {fingerprint,sha256} from './canonical.js';
import {fail,safeRead} from './private-files.js';

export const auditSkillId=(stage:'content'|'visual')=>stage==='content'?'independent-article-audit' as const:'independent-visual-audit' as const;
export async function readAuditSkill(directory:string,stage:'content'|'visual'){
 const skillId=auditSkillId(stage),text=await safeRead(join(directory,'base',skillId+'.skill.md'));
 return {skillId,skillSha256:sha256(text)};
}
/** This is an executor observation of a real hosted fresh-context review. It is
 * not a provider SemanticExecutionReceipt, human approval or storage receipt.
 * The caller must retain the actual task/response evidence; hashes alone do not
 * prove that the review occurred or that its factual judgment is correct. */
export function validateAgentAuditObservation(audit:{reviewer:{kind:string;principalId:string;execution?:unknown};requestSha256:string;reviewedAt:string},
 request:{requestSha256:string;skill?:{skillId:string;skillSha256:string}|undefined},stage:'content'|'visual'){
 if(audit.reviewer.kind!=='agent'||!request.skill)fail('AGENT_AUDIT_EXECUTION_REQUIRED');
 const e=agentAuditExecutionSchema.parse(audit.reviewer.execution);
 const context=e.contextRef.slice('codex-thread:'.length);
 const {execution:_execution,...reviewer}=audit.reviewer;
 const projected={...audit,reviewer};
 if(e.stage!==stage||e.skillId!==auditSkillId(stage)||e.skillId!==request.skill.skillId
  ||e.skillSha256!==request.skill.skillSha256||e.requestSha256!==request.requestSha256
  ||e.responseSha256!==fingerprint(projected)||audit.reviewer.principalId!=='agent-'+context
  ||e.completedAt!==audit.reviewedAt||Date.parse(e.completedAt)>Date.now())fail('AGENT_AUDIT_EXECUTION_BINDING_INVALID');
 sha256Schema.parse(e.responseSha256);
 // A self-consistent observation is not trusted execution evidence. The live
 // runner must validate exact-set disclosure and retain its actual request,
 // process/task response and successful journal receipt before this gate opens.
 // No JSON import or fixture receipt can supply that authority.
 return fail('AGENT_AUDIT_TRUSTED_EXECUTION_REQUIRED',3);
}
