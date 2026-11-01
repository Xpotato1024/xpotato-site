import {z} from 'zod';
import {stableIdSchema} from './common.js';
import {contentAuditRecordSchema} from './article-review.js';
import {localVisualAuditSchema} from './article-visual.js';

// The auditor returns judgments only. Actual context, transport, timings,
// disclosure and execution receipts are supplied by the trusted executor.
export const existingAiContentAuditResponseSchema=z.object({
 protocol:z.literal('xpotato-private-existing-ai-content-audit-response-v1'),
 independentlyExtractedClaims:z.array(z.object({text:z.string().min(1),
  span:z.object({start:z.number().int().nonnegative(),end:z.number().int().positive()}).strict(),
  evidenceIds:z.array(stableIdSchema)}).strict()).max(500),
 coveredClaimIds:contentAuditRecordSchema.shape.coveredClaimIds,
 materialCoverage:contentAuditRecordSchema.shape.materialCoverage,
 findings:contentAuditRecordSchema.shape.findings,
 conclusion:contentAuditRecordSchema.shape.conclusion,
 limitations:z.array(z.string().min(1)).max(100),
}).strict();
export const existingAiVisualAuditResponseSchema=z.object({
 protocol:z.literal('xpotato-private-existing-ai-visual-audit-response-v1'),
 publicationSafetyReviewed:z.literal(true),findings:localVisualAuditSchema.shape.findings,
 records:localVisualAuditSchema.shape.records,conclusion:localVisualAuditSchema.shape.conclusion,
 limitations:z.array(z.string().min(1)).max(100),
}).strict();
