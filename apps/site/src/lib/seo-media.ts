import { contentMediaRegistrySchema, mediaRightsRecordSchema, type ContentMediaRegistry, type MediaRightsRecord, type MediaPublicationManifest, type MediaProtectionReceipt } from '@xpotato/content-contracts';
import { deriveCompactMediaRecoveryBinding } from '../../../../packages/article-pipeline/src/media-persistence.js';
import type { PublishedSeoImage } from './seo.js';

/** Build-only foundation. No delivery origin/receipt is enabled in the current site. */
export const resolvePublishedSeoImage = (input: {
  contentId: string; contentPublished: boolean; publicOrigin?: string | undefined;
  registry?: ContentMediaRegistry | undefined; rights?: readonly MediaRightsRecord[] | undefined;
  publication?: MediaPublicationManifest | undefined; protection?: MediaProtectionReceipt | undefined;
}): PublishedSeoImage | undefined => {
  if (!input.contentPublished || !input.publicOrigin || !input.registry || !input.publication || !input.protection) return undefined;
  const origin = new URL(input.publicOrigin);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') throw Error('SEO media needs a configured public HTTPS origin');
  const registry = contentMediaRegistrySchema.parse(input.registry);
  if (registry.contentId !== input.contentId) throw Error('SEO media ContentId mismatch');
  // Reuse the existing exact publication/protection/hash verification; no new persistence path.
  const recovery = deriveCompactMediaRecoveryBinding(input.publication, input.protection);
  for (const role of ['social_card', 'hero']) {
    const asset = registry.assets.find(a => a.status === 'active' && a.role === role);
    if (!asset) continue;
    const rights = input.rights?.find(r => r.rightsId === asset.rightsRef);
    if (!rights || !mediaRightsRecordSchema.parse(rights).publicationAuthorized) throw Error('SEO media publication rights missing');
    const master = asset.delivery.master;
    if (!master.width || !master.height) throw Error('SEO media dimensions missing');
    const mediaSet = input.publication.mediaSets.find(s => s.assetId === asset.assetId && s.rightsRef === asset.rightsRef);
    if (!mediaSet?.objects.some(o => o.purpose === 'master' && o.sha256 === master.sha256 && o.objectKey === master.objectKey && o.verifiedSizeBytes === master.sizeBytes && o.format === master.format)) throw Error('SEO image is absent from exact publication');
    if (!recovery.objects.some(o => o.sha256 === master.sha256 && o.publicObjectKey === master.objectKey && o.verifiedSizeBytes === master.sizeBytes)) throw Error('SEO image is not protected');
    return { url: new URL(master.objectKey, origin).href, width:master.width, height:master.height, alt:asset.decorative ? undefined : asset.defaultAlt };
  }
  return undefined;
};
