export interface ContentHeading { depth: number; slug: string; text: string }
/** Use Astro's actual heading IDs; do not invent a second slugging implementation. */
export const selectTableOfContents = (headings: readonly ContentHeading[], body: string): readonly ContentHeading[] => {
  const sections = headings.filter(h => h.depth === 2 || h.depth === 3);
  const text = body.replace(/```[\s\S]*?```/gu, '').replace(/\s/gu, '');
  return text.length >= 1200 && sections.filter(h => h.depth === 2).length >= 3 ? sections : [];
};

export interface TableOfContentsSection extends ContentHeading { children: ContentHeading[] }
/** Keep the reading order and the H2/H3 relationship. An orphan H3 stays a root. */
export function groupTableOfContents(headings: readonly ContentHeading[]): TableOfContentsSection[] {
  const sections: TableOfContentsSection[] = [];
  let parent: TableOfContentsSection | undefined;
  for (const heading of headings) {
    if (heading.depth === 2) {
      parent = { ...heading, children: [] };
      sections.push(parent);
    } else if (heading.depth === 3) {
      if (parent) parent.children.push({ ...heading });
      else sections.push({ ...heading, children: [] });
    }
  }
  return sections;
}
