import type { ContentMediaRegistry, MediaRightsRecord, PublicationProvenanceRecord } from '@xpotato/content-contracts';
import { assertCompactRegistryMedia } from '@xpotato/portable-content/compact-media';
import type { PublishedSeoImage } from './seo.js';

export interface PublishedMediaEvidence {
  readonly provenance: PublicationProvenanceRecord;
  readonly rights: readonly MediaRightsRecord[];
}

/** Uses cleanup-safe Git lineage only. Never reads a job, credential or full operational receipt. */
export function compactSocialImage(input: { registry: ContentMediaRegistry; evidence: PublishedMediaEvidence; publicOrigin: string }): PublishedSeoImage {
  const registry = assertCompactRegistryMedia({ registry: input.registry, ...input.evidence });
  const origin = new URL(input.publicOrigin);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw Error('SOCIAL_PUBLIC_ORIGIN_REQUIRED');
  const cards = registry.assets.filter(asset => asset.role === 'social_card' && asset.status === 'active');
  if (cards.length !== 1) throw Error('SOCIAL_CARD_REQUIRED');
  const card = cards[0]!;
  const object = card.delivery.master;
  if (object.width!==1200 || object.height!==630 || object.format!=='png' || card.decorative===true || !card.defaultAlt?.trim()) throw Error('SOCIAL_CARD_DIMENSIONS_AND_ALT_REQUIRED');
  const url = new URL(object.objectKey, origin);
  if (url.origin !== origin.origin || !object.objectKey.startsWith('media/v1/objects/sha256/')) throw Error('SOCIAL_OBJECT_KEY_INVALID');
  return { url: url.href, width: object.width, height: object.height, alt: card.defaultAlt };
}
