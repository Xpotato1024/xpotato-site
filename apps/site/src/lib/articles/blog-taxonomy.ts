import type { TaxonomyRegistry } from '@xpotato/content-contracts';

type Category = TaxonomyRegistry['blogCategories'][number];
export const categoryArchiveRoute = (category: Category) => `/articles/category/${category.slug}/`;

/** Stable IDs own the tree; ancestry never becomes part of an article or archive URL. */
export function categoryLineage(id: string, taxonomy: TaxonomyRegistry): Category[] {
  const path: Category[] = [];
  let current: string | undefined = id;
  while (current) {
    const term = taxonomy.blogCategories.find(record => record.id === current && record.status === 'active');
    if (!term || path.some(record => record.id === term.id) || path.length >= 3) throw Error('INVALID_BLOG_CATEGORY_HIERARCHY');
    path.unshift(term);
    current = term.parentId;
  }
  return path;
}

export function blogBreadcrumbs(input: { categoryId: string; title: string; canonical: string; origin: string; taxonomy: TaxonomyRegistry }) {
  return [
    { name: 'Articles', url: new URL('/articles/', input.origin).href },
    ...categoryLineage(input.categoryId, input.taxonomy).map(term => ({ name: term.label, url: new URL(categoryArchiveRoute(term), input.origin).href })),
    { name: input.title, url: input.canonical },
  ];
}

export function blogTags(ids: readonly string[], taxonomy: TaxonomyRegistry, linkable: boolean) {
  return [...new Set(ids)].map(id => {
    const term = taxonomy.tags.find(record => record.id === id && record.status === 'active');
    if (!term) throw Error(`UNKNOWN_BLOG_TAG: ${id}`);
    return { id, label: term.label, kind:term.kind, href: linkable && term.archive ? `/articles/tag/${term.slug}/` : undefined };
  });
}
