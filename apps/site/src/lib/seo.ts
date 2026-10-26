import type { SeoOverride } from "@xpotato/content-contracts";

export interface ContentSeoInput {
  readonly title: string;
  readonly description: string;
  readonly route: string;
  readonly canonicalOrigin: string;
  readonly seo?: SeoOverride | undefined;
}

export interface DerivedContentSeo {
  readonly title: string;
  readonly description: string;
  readonly canonical: string;
  readonly noindex: boolean;
}

export const deriveContentSeo = (input: ContentSeoInput): DerivedContentSeo => ({
  title: input.seo?.titleOverride ?? input.title,
  description: input.seo?.descriptionOverride ?? input.description,
  canonical: input.seo?.canonicalOverride ?? new URL(input.route, input.canonicalOrigin).href,
  noindex: input.seo?.noindex ?? false,
});

export interface ContentBreadcrumb { readonly name: string; readonly url: string }

/** The tool collection and current page are also rendered as visible navigation. */
export const deriveToolBreadcrumbs = (input: { collection: string; title: string; canonical: string; canonicalOrigin: string }): readonly ContentBreadcrumb[] =>
  input.collection === 'tools' ? [
    { name: 'Tools', url: new URL('/tools/', input.canonicalOrigin).href },
    { name: input.title, url: input.canonical },
  ] : [];

export const deriveBreadcrumbList = (items: readonly ContentBreadcrumb[]) => items.length ? ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: item.url })),
}) : undefined;

/** JSON inside a script element must not be able to close the HTML element. */
export const serializeJsonLd = (value: unknown): string => JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');

export interface PublishedSeoImage { readonly url: string; readonly width: number; readonly height: number; readonly alt?: string | undefined }
export const deriveArticleSeo = (input: {
  collection: string; title: string; description: string; canonical: string;
  pubDate: string; updatedDate?: string | undefined; author: { name: string; url: string };
  draft: boolean; noindex: boolean; preview?: boolean | undefined; image?: PublishedSeoImage | undefined;
}) => {
  if (!['blog', 'notes'].includes(input.collection) || input.draft || input.noindex || input.preview) return undefined;
  return {
    '@context': 'https://schema.org', '@type': input.collection === 'blog' ? 'BlogPosting' : 'Article',
    headline: input.title, description: input.description, url: input.canonical,
    mainEntityOfPage: { '@type': 'WebPage', '@id': input.canonical },
    datePublished: input.pubDate, ...(input.updatedDate ? { dateModified: input.updatedDate } : {}),
    author: { '@type': 'Person', name: input.author.name, url: input.author.url },
    inLanguage: 'ja-JP', ...(input.image ? { image: { '@type': 'ImageObject', contentUrl: input.image.url, width: input.image.width, height: input.image.height } } : {}),
  };
};
