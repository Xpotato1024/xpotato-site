import {generatedSchemaRegistry} from './schema-registry.js';
// Artifact ownership only. Names and serialized JSON schema identities are unchanged.
export const generatedSchemaGroups={
 "content": ["blog-frontmatter","content-discovery-record","content-module-record","discovery-profile","note-frontmatter","page-frontmatter","project-frontmatter","search-document","site-config","taxonomy-registry","tool-frontmatter"],
 "interactive": ["browser-tool-manifest","browser-tool-pin","browser-tool-review","interactive-module-record","tool-binding-record"],
 "article": ["article-candidate-artifact","article-claim-record","article-job-spec","article-review-bundle-manifest","article-stage-receipt","article-visual-input","article-visual-masters","article-visual-media","article-visual-plan","candidate-build-input","candidate-media-plan-confirmation","candidate-preview-receipt","content-audit-record","draft-preview-manifest","evidence-record","existing-ai-content-audit-response","existing-ai-visual-audit-response","human-approval-record","human-draft-artifact","human-draft-input","local-evidence-bundle","local-source-bundle","local-visual-audit-request","local-visual-audit","manual-editorial-revision-ledger","semantic-request-envelope","semantic-response-envelope","source-record","visual-audit-record","visual-plan-set"],
 "media": ["canonical-source-storage-receipt","compact-media-recovery-binding","content-media-registry","media-ingest-profile","media-ingest-request","media-ingest-result","media-protection-receipt","media-publication-manifest","media-rights-record","media-variant-manifest","media-variant-profile"],
 "disclosure": ["external-ai-admission-provenance","external-ai-disclosure-manifest","external-ai-disclosure-policy-profile","external-ai-disclosure-record","external-ai-input-policy-binding"],
 "examples": ["example-verification-receipt","example-verification-request","example-verifier-trust-record","technical-example-record","technical-example-verification-result"],
 "migration": ["legacy-freeze-baseline","migration-inventory","phase4-content-candidate-manifest","phase4-content-identity-map","phase4-content-materialization-manifest","phase5-taxonomy-materialization-manifest","phase5-taxonomy-raw-inventory","phase5-taxonomy-review-manifest","phase6-media-local-processing-manifest","phase6-media-raw-inventory","phase6-media-repository-candidate-manifest","phase6-media-review-proposal","phase7-interactive-readiness-manifest"],
 "publication": ["publication-candidate-manifest","publication-provenance"],
} as const satisfies Readonly<Record<string,readonly(keyof typeof generatedSchemaRegistry)[]>>;
export function generatedSchemaPaths():ReadonlyMap<string,string>{
 const paths=new Map<string,string>();
 for(const [family,names] of Object.entries(generatedSchemaGroups))for(const name of names){
  if(paths.has(name)||!(name in generatedSchemaRegistry))throw Error('Duplicate/unknown schema ownership: '+name);
  paths.set(name,family+'/'+name+'.schema.json');
 }
 if(paths.size!==Object.keys(generatedSchemaRegistry).length)throw Error('Generated schema ownership is incomplete');
 return paths;
}
