import { describe, expect, it } from 'vitest';
import { mediaRegistries } from '../content-registry/media/index.js';
import { contentMediaContext } from './media-context.js';

describe('published media catalog integration', () => {
  it('connects every published social card to its rights and protected lineage', () => {
    const registries = mediaRegistries.filter(registry =>
      registry.assets.some(asset => asset.role === 'social_card' && asset.status === 'active'));
    expect(registries.length).toBeGreaterThan(0);
    for (const registry of registries) {
      const context = contentMediaContext(registry.contentId);
      const card = registry.assets.find(asset => asset.role === 'social_card' && asset.status === 'active')!;
      expect(context?.candidate).toBe(false);
      expect(context?.image).toMatchObject({
        url: `https://assets.xpotato.net/${card.delivery.master.objectKey}`,
        width: 1200,
        height: 630,
        alt: card.defaultAlt,
      });
    }
  });
});
