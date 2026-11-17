import {z} from 'zod';
import {repositoryRelativePathSchema} from '../common.js';
import {publicationProvenanceRecordSchema} from '../provenance.js';
/** Current non-article content evidence, independent of retired migration snapshots. */
export const editorialProvenanceRegistrySchema=z.object({schemaVersion:z.literal(1),records:z.array(z.object({path:repositoryRelativePathSchema.regex(/^content\/(notes|projects|tools|pages)\/[^/]+\.mdx$/u),provenance:publicationProvenanceRecordSchema.refine(record=>record.origin==='manual','manual origin required')}).strict())}).strict().superRefine((value,context)=>{for(const key of ['path','contentId']as const){const values=value.records.map(row=>key==='path'?row.path:row.provenance.contentId);if(new Set(values).size!==values.length)context.addIssue({code:'custom',message:'Duplicate editorial '+key});}});
