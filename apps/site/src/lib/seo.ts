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
