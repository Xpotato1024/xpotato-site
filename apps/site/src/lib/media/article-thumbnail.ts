import type { ContentMediaRegistry } from '@xpotato/content-contracts';
import { renderRegistryPicture } from '@xpotato/portable-content/media-picture';
import { contentMediaContext } from './media-context.js';
type Asset = ContentMediaRegistry['assets'][number];
export const selectArticleHeroAsset = (assets: readonly Pick<Asset,'assetId'|'role'|'status'>[]) =>
  assets.find(asset => asset.role === 'hero' && asset.status === 'active')?.assetId;

/** Cards and search use the same registered active hero and delivery validator. */
export function articleThumbnailPicture(contentId: string, sizes: string): string | undefined {
  const context = contentMediaContext(contentId);
  const assetId = context && selectArticleHeroAsset(context.registry.assets);
  return context && assetId ? renderRegistryPicture({registry:context.registry,urlFor:context.urlFor,assetId,sizes}) : undefined;
}
