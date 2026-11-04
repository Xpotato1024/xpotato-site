import {z} from "zod";
import {sha256Schema,contentIdSchema,isoDateTimeSchema,stableIdSchema} from "@xpotato/content-contracts";

export const mockDecisionSchema=z.object({
 protocol:z.literal("xpotato-private-mock-decision-v1"),scope:z.literal("synthetic_fixture"),
 candidateSha256:sha256Schema,contentId:contentIdSchema,decision:z.literal("approve_simulation"),
 reviewer:z.literal("fixture-reviewer"),decidedAt:isoDateTimeSchema,isHumanApproval:z.literal(false),
 productionEligible:z.literal(false),decisionSha256:sha256Schema,
}).strict();
export const publicationHeadSchema=z.object({
 protocol:z.literal("xpotato-private-publication-v1"),mode:z.enum(["mock","human"]),candidateSha256:sha256Schema,
 inputSha256:sha256Schema,attemptId:stableIdSchema,approvalSha256:sha256Schema,
 state:z.enum(["HUMAN_APPROVED","MEDIA_SOURCE_STORED","MEDIA_PUBLISHED","MEDIA_PROTECTED","EXPORTED"]),
 sources:sha256Schema.nullable(),publication:sha256Schema.nullable(),protection:sha256Schema.nullable(),
 export:sha256Schema.nullable(),productionEligible:z.literal(false),
}).strict();
export const operationIntentSchema=z.object({
 protocol:z.literal("xpotato-private-media-operation-v1"),mode:z.literal("mock"),candidateSha256:sha256Schema,
 approvalSha256:sha256Schema,attemptId:stableIdSchema,inputSha256:sha256Schema,policySha256:sha256Schema,plane:z.enum(["source","public","protected"]),key:z.string().min(1),
 objectSha256:sha256Schema,metadataSha256:sha256Schema,status:z.enum(["pending","verified"]),
}).strict();
export type PublicationHead=z.infer<typeof publicationHeadSchema>;
export type MockDecision=z.infer<typeof mockDecisionSchema>;
export type Plane="source"|"public"|"protected";
export type StoredObject={bytes:Buffer;contentType:string;cacheControl:string;policySha256:string;protectedRef:string|null};
export type ObjectRead={status:"absent";authoritative:true}|{status:"unknown"}|{status:"found";object:StoredObject};
export interface PublicationPort{
 readonly mode:"mock";readonly capabilities:Readonly<Record<Plane,boolean>>;readonly policySha256:string;
 read(plane:Plane,key:string):Promise<ObjectRead>;
 putIfAbsent(plane:Plane,key:string,object:StoredObject):Promise<"written"|"reused"|"unknown">;
}
