import type { PublishedMediaEvidence } from '../../lib/compact-social-image.js';
import { publicationProvenanceRecordSchema, mediaRightsRecordSchema } from '@xpotato/content-contracts';
import articleProvenance from '../provenance/blog/e7562440-e0bf-42a9-8a90-d66f4e1a4eb8.json';
import articleRights from '../media-rights/blog/e7562440-e0bf-42a9-8a90-d66f4e1a4eb8.json';

// Only reviewed, cleanup-safe provenance and public-safe rights records belong here.
// These records were exported only after the protected publication CI verified A/B/C.
// Never populate this catalog from mock exports.
export const publishedMediaEvidence: Readonly<Record<string, PublishedMediaEvidence>> = Object.freeze({
  [articleProvenance.contentId]: {
    provenance: publicationProvenanceRecordSchema.parse(articleProvenance),
    rights: articleRights.map(record => mediaRightsRecordSchema.parse(record)),
  },
});
