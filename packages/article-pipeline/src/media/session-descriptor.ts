/** Read-only legacy descriptor inspection. This format grants no live capability. */
import {z} from "zod";
import {articleMediaTargets} from "@xpotato/content-contracts/article-media-targets";
import {sha256Schema,stableIdSchema} from "@xpotato/content-contracts";

const objectSchema=z.object({plane:z.enum(["source","public","protected"]),key:z.string().max(256),sha256:sha256Schema,
 sizeBytes:z.number().int().positive().max(24*1024*1024),contentType:z.string().max(64),cacheControl:z.string().max(128)}).strict();
export const mediaWriteSessionDescriptorSchema=z.object({schemaVersion:z.literal(1),sessionId:stableIdSchema.max(120),
 authorityRevision:z.string().regex(/^[a-f0-9]{40}$/u),expiresAt:z.iso.datetime({offset:true}),
 binding:z.object({jobId:stableIdSchema,jobFingerprint:sha256Schema,candidateSha256:sha256Schema,approvalSha256:sha256Schema,attemptId:stableIdSchema,
  inputSha256:sha256Schema,policySha256:sha256Schema}).strict(),
 objects:z.array(objectSchema).min(1).max(512)}).strict();
export type MediaWriteSessionDescriptor=z.infer<typeof mediaWriteSessionDescriptorSchema>;
export type MediaWriteObject=z.infer<typeof objectSchema>;
const keyPattern=/^(source|media)\/v1\/objects\/sha256\/([a-f0-9]{2})\/([a-f0-9]{64})\.(webp|svg|png|jpg|jpeg|avif)$/u;
export function inspectMediaWriteSession(input:unknown,now=Date.now()){
 const d=mediaWriteSessionDescriptorSchema.parse(input),expires=Date.parse(d.expiresAt);
 if(d.authorityRevision!==articleMediaTargets.authority.revision||!Number.isFinite(now)||expires<=now||expires-now>900000)throw Error("MEDIA_WRITE_SESSION_INVALID");
 const keys=new Set<string>();
 for(const o of d.objects){
  const m=keyPattern.exec(o.key),id=o.plane+":"+o.key;
  if(!m||m[2]!==o.sha256.slice(0,2)||m[3]!==o.sha256||m[1]!==(o.plane==="source"?"source":"media")
   ||o.plane==="source"&&!["webp","svg"].includes(m[4]!))throw Error("MEDIA_WRITE_KEY_INVALID");
  const format=m[4]==="jpg"?"jpeg":m[4],mime=format==="svg"?"image/svg+xml":"image/"+format;
  if(o.contentType!==mime||o.cacheControl!==(o.plane==="public"?articleMediaTargets.public.cacheControl:"private, no-store")||keys.has(id))throw Error("MEDIA_WRITE_OBJECT_SET_INVALID");
  keys.add(id);
 }
 return d;
}

