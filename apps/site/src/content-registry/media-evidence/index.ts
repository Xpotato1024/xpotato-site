import type { PublishedMediaEvidence } from '../../lib/compact-social-image.js';

// Only reviewed, cleanup-safe provenance and public-safe rights records belong here.
// No production article has completed that publication flow yet. Never populate from mock exports.
export const publishedMediaEvidence: Readonly<Record<string, PublishedMediaEvidence>> = Object.freeze({});
