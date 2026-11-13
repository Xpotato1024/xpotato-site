import { mediaRightsRecordSchema, publicationProvenanceRecordSchema, type ContentMediaRegistry } from '@xpotato/content-contracts';
import { fingerprint } from '@xpotato/content-contracts/canonical';
import { assertCompactRegistryMedia } from '@xpotato/portable-content/compact-media';
import type { PublishedMediaEvidence } from './compact-social-image.js';

/** Join only durable Git exports. This validates evidence; it does not issue approval or receipts. */
export function buildPublishedMediaEvidence(input: {
  records: Readonly<Record<string, unknown>>;
  ledger: readonly { contentId: string; provenanceSha256: string }[];
  rights: Readonly<Record<string, readonly unknown[]>>;
  registries: readonly ContentMediaRegistry[];
}): Readonly<Record<string, PublishedMediaEvidence>> {
  const result: Record<string, PublishedMediaEvidence> = Object.create(null);
  const keys = Object.keys(input.records);
  if (new Set(input.ledger.map(row => row.contentId)).size !== input.ledger.length
      || keys.length !== input.ledger.length
      || input.ledger.some(row => !Object.hasOwn(input.records, row.contentId))) {
    throw Error('PUBLICATION_EVIDENCE_EXACT_LEDGER_REQUIRED');
  }
  for (const [contentId, record] of Object.entries(input.records)) {
    const provenance = publicationProvenanceRecordSchema.parse(record);
    const row = input.ledger.find(entry => entry.contentId === contentId)!;
    if (provenance.contentId !== contentId || fingerprint(provenance) !== row.provenanceSha256) {
      throw Error('PUBLICATION_EVIDENCE_PROVENANCE_HASH_MISMATCH');
    }
    const rightsInput = input.rights[contentId];
    if (!rightsInput) throw Error('PUBLICATION_EVIDENCE_RIGHTS_REQUIRED');
    const rights = rightsInput.map(value => mediaRightsRecordSchema.parse(value));
    const matches = input.registries.filter(registry => registry.contentId === contentId);
    if (matches.length !== 1) throw Error('PUBLICATION_EVIDENCE_REGISTRY_REQUIRED');
    assertCompactRegistryMedia({ registry: matches[0]!, provenance, rights });
    result[contentId] = Object.freeze({ provenance, rights: Object.freeze(rights) });
  }
  return Object.freeze(result);
}
