import {mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {z} from 'zod';
import {contentIdSchema,repositoryRelativePathSchema,sha256Schema,stableIdSchema} from '@xpotato/content-contracts';
import {canonicalJson,fingerprint,sha256} from './canonical.js';
import {containsHardDenyMaterial} from './disclosure.js';
import {fail,immutable,immutableBytes,inside,noLinks,privateRoot,safeRead,safeReadBytes} from './private-files.js';

const artifactSchema=z.object({
 id:stableIdSchema,role:z.enum(['manuscript','hero','inline','research','extract','lineage','rights']),
 path:repositoryRelativePathSchema,sha256:sha256Schema,sizeBytes:z.number().int().positive().max(8*1024*1024),
 origin:z.enum(['ai_generated','deterministic','source_snapshot','user_supplied']),
 lineageIds:z.array(stableIdSchema).max(20),
}).strict();
/** Historical input is received, never reconstructed as a successful semantic
 * invocation, human draft, audit, publication approval or storage receipt.
 */
export const existingArticleInputSchema=z.object({
 schemaVersion:z.literal(1),protocol:z.literal('xpotato-existing-article-input-v1'),
 contentId:contentIdSchema,baseCommit:z.string().regex(/^[a-f0-9]{40}$/u),
 artifacts:z.array(artifactSchema).min(3).max(128),
}).strict().superRefine((value,ctx)=>{
 const ids=new Set(value.artifacts.map(a=>a.id));
 const issue=(message:string)=>ctx.addIssue({code:'custom',message});
 if(ids.size!==value.artifacts.length)issue('Duplicate existing artifact identity');
 for(const role of ['manuscript','hero'])if(value.artifacts.filter(a=>a.role===role).length!==1)issue('Exactly one '+role+' required');
 if(value.artifacts.reduce((n,a)=>n+a.sizeBytes,0)>32*1024*1024)issue('Existing input total byte limit');
 for(const a of value.artifacts){
  if(a.origin==='ai_generated'&&!a.lineageIds.length)issue('AI origin requires observed lineage bytes');
  if(new Set(a.lineageIds).size!==a.lineageIds.length)issue('Duplicate lineage identity');
  for(const id of a.lineageIds){const ref=value.artifacts.find(x=>x.id===id);
   if(!ref||ref.role!=='lineage'||id===a.id)issue('Lineage must reference a separate lineage artifact');
  }
 }
});
export type ExistingArticleInput=z.infer<typeof existingArticleInputSchema>;
const authority=Object.freeze({formalJobCreated:false as const,semanticExecutionVerified:false as const,
 humanApproval:false as const,rightsAdmitted:false as const,productionEligible:false as const});
const deniedPath=(path:string)=>path.split(/[\\/]/u).some(part=>/^(?:\.\.|\.git|\.ssh|\.aws|\.codex|\.env.*|node_modules|credentials(?:\..*)?|secrets?(?:\..*)?)$/iu.test(part));
const secretBytes=(bytes:Uint8Array)=>containsHardDenyMaterial(bytes)
 ||/\b(?:OPENAI_API_KEY|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|GITHUB_TOKEN|CLOUDFLARE_API_TOKEN)\s*[:=]\s*\S+|\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}|\bgh[pousr]_[A-Za-z0-9]{20,}|[?&](?:X-Amz-Signature|X-Goog-Signature|CloudFront-Signature|signature|sig|token)=/iu.test(new TextDecoder().decode(bytes));
const receiptSchema=z.object({schemaVersion:z.literal(1),protocol:z.literal('xpotato-existing-article-intake-v1'),
 input:existingArticleInputSchema,inputSha256:sha256Schema,
 authority:z.object({formalJobCreated:z.literal(false),semanticExecutionVerified:z.literal(false),humanApproval:z.literal(false),
  rightsAdmitted:z.literal(false),productionEligible:z.literal(false)}).strict(),
}).strict();

/** Local immutable intake only. No provider, credentials, publication registry,
 * Article Job state or human-only journal is read or mutated by this operation.
 */
export async function stageExistingArticleInput(repositoryRoot:string,sourceRoot:string,input:unknown){
 const parsed=existingArticleInputSchema.parse(input),source=resolve(sourceRoot),buffers:Buffer[]=[];
 const allowed=resolve(repositoryRoot,'.local','existing-article-sources');
 if(deniedPath(source)||source!==allowed&&!inside(allowed,source))fail('EXISTING_INPUT_SOURCE_ROOT_DENIED');
 await noLinks(source);
 // Validate the entire set before persisting any intake object. Origin and
 // history remain unreviewed input; this does not certify their truth.
 for(const a of parsed.artifacts){
  if(deniedPath(a.path))fail('EXISTING_INPUT_PATH_DENIED');
  const path=resolve(source,a.path);if(!inside(source,path))fail('EXISTING_INPUT_PATH_ESCAPE');
  const bytes=await safeReadBytes(path,8*1024*1024);
  if(bytes.length!==a.sizeBytes||sha256(bytes)!==a.sha256)fail('EXISTING_INPUT_BYTES_MISMATCH');
  if(secretBytes(bytes))fail('EXISTING_INPUT_SECRET_DENIED');
  buffers.push(bytes);
 }
 const root=await privateRoot(repositoryRoot),hash=fingerprint(parsed),directory=join(root,'existing-inputs',hash);
 await noLinks(directory);await mkdir(join(directory,'objects'),{recursive:true,mode:0o700});await noLinks(directory);
 for(let i=0;i<parsed.artifacts.length;i++)await immutableBytes(join(directory,'objects',parsed.artifacts[i]!.sha256),buffers[i]!);
 const receipt=receiptSchema.parse({schemaVersion:1,protocol:'xpotato-existing-article-intake-v1',input:parsed,inputSha256:hash,authority});
 await immutable(join(directory,'intake.json'),canonicalJson(receipt)+'\n');
 return readExistingArticleInput(directory,parsed.contentId,hash);
}

export async function readExistingArticleInput(directory:string,contentId:string,inputSha256:string){
 if(deniedPath(directory))fail('EXISTING_INPUT_PATH_DENIED');
 const record=receiptSchema.parse(JSON.parse(await safeRead(join(directory,'intake.json'))));
 if(record.input.contentId!==contentId||record.inputSha256!==inputSha256||fingerprint(record.input)!==inputSha256)
  fail('EXISTING_INPUT_BINDING_INVALID');
 for(const a of record.input.artifacts){
  if(deniedPath(a.path))fail('EXISTING_INPUT_PATH_DENIED');
  const bytes=await safeReadBytes(join(directory,'objects',a.sha256),8*1024*1024);
  if(bytes.length!==a.sizeBytes||sha256(bytes)!==a.sha256)fail('EXISTING_INPUT_BYTES_MISMATCH');
  if(secretBytes(bytes))fail('EXISTING_INPUT_SECRET_DENIED');
 }
 return {directory,inputSha256,contentId:record.input.contentId,artifacts:record.input.artifacts,authority:record.authority};
}
