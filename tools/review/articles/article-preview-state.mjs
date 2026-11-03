/** Preview assets are local inputs, never publication approval. */
export function previewHeroOptions(argv, env = {}) {
 const heroPath = typeof env.ARTICLE_PREVIEW_HERO === 'string' ? env.ARTICLE_PREVIEW_HERO.trim() : '';
 const compositionOnly = argv.includes('--composition-only');
 if (heroPath && compositionOnly) throw Error('PREVIEW_MODE_AMBIGUOUS');
 if (!heroPath && !compositionOnly) throw Error('PREVIEW_HERO_REQUIRED: set ARTICLE_PREVIEW_HERO to the final local image');
 return {heroPath, compositionOnly};
}
export function assertPreviewExportable(record, compositionOnly = false) {
 if (record.productionEligible !== false) throw Error('PREVIEW_NOT_PRIVATE');
 if (record.heroState === 'provided-hero') {
  if (!record.identity?.hero || record.identity.hero.sha256 !== record.heroSha256) throw Error('PREVIEW_HERO_BINDING_MISMATCH');
  return 'final-review';
 }
 if (compositionOnly && record.heroState === 'internal-composition-slot-not-final') return 'composition-only';
 throw Error('PREVIEW_FINAL_HERO_MISSING');
}
