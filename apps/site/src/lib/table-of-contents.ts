export interface ContentHeading { depth: number; slug: string; text: string }
/** Use Astro's actual heading IDs; do not invent a second slugging implementation. */
export const selectTableOfContents = (headings: readonly ContentHeading[], body: string): readonly ContentHeading[] => {
  const sections = headings.filter(h => h.depth === 2 || h.depth === 3);
  const text = body.replace(/```[\s\S]*?```/gu, '').replace(/\s/gu, '');
  return text.length >= 1200 && sections.filter(h => h.depth === 2).length >= 3 ? sections : [];
};
