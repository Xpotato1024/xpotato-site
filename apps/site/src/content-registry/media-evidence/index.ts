import { buildPublishedMediaEvidence } from '../../lib/media/published-media-evidence.js';
import { publicationProvenanceRecords, publicationProvenanceRegistry } from '../provenance/index.js';
import { articleMediaRights } from '../media-rights/index.js';
import { mediaRegistries } from '../media/index.js';

// Consume the formal exporter indexes, not a separately maintained article allowlist.
// Compact validation retains rights, review and exact source/public/protected lineage checks.
export const publishedMediaEvidence = buildPublishedMediaEvidence({
  records: publicationProvenanceRecords,
  ledger: publicationProvenanceRegistry,
  rights: articleMediaRights,
  registries: mediaRegistries,
});
