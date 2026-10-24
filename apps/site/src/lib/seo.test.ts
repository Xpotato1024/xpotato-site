import { describe, expect, it } from "vitest";
import { deriveContentSeo, deriveArticleSeo, deriveToolBreadcrumbs, deriveBreadcrumbList, serializeJsonLd } from "./seo.js";

describe("content SEO derivation", () => {
  it("derives normal metadata from editorial content and route", () => {
    expect(deriveContentSeo({
      title: "Editorial title",
      description: "Editorial description",
      route: "/notes/example/",
      canonicalOrigin: "https://xpotato.net/",
    })).toEqual({
      title: "Editorial title",
      description: "Editorial description",
      canonical: "https://xpotato.net/notes/example/",
      noindex: false,
    });
  });

  it("applies exception-only metadata overrides without changing editorial values", () => {
    const editorial = { title: "Visible editorial title", description: "Visible editorial description" };
    const metadata = deriveContentSeo({
      ...editorial,
      route: "/notes/example/",
      canonicalOrigin: "https://xpotato.net/",
      seo: {
        canonicalOverride: "https://xpotato.net/canonical-example/",
        titleOverride: "SEO title",
        descriptionOverride: "SEO description",
        noindex: true,
      },
    });
    expect(metadata).toEqual({
      title: "SEO title",
      description: "SEO description",
      canonical: "https://xpotato.net/canonical-example/",
      noindex: true,
    });
    expect(editorial.title).toBe("Visible editorial title");
    expect(editorial.description).toBe("Visible editorial description");
  });
});

describe('visible tool navigation metadata', () => {
  it('uses the same collection and current title in canonical breadcrumb URLs', () => {
    const items = deriveToolBreadcrumbs({ collection: 'tools', title: '素因数分解機', canonical: 'https://xpotato.net/tools/prime-factorizer/', canonicalOrigin: 'https://xpotato.net/' });
    expect(deriveBreadcrumbList(items)).toEqual({
      '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Tools', item: 'https://xpotato.net/tools/' },
        { '@type': 'ListItem', position: 2, name: '素因数分解機', item: 'https://xpotato.net/tools/prime-factorizer/' },
      ],
    });
    expect(items).toHaveLength(2);
  });
  it('does not label unrelated collections as tools or invent application ratings', () => {
    const items = deriveToolBreadcrumbs({ collection: 'blog', title: 'Article', canonical: 'https://xpotato.net/blog/article/', canonicalOrigin: 'https://xpotato.net/' });
    expect(items).toEqual([]);
    expect(deriveBreadcrumbList(items)).toBeUndefined();
  });
});

describe('publication-safe article metadata', () => {
  const input = { collection:'blog', title:'実際の見出し', description:'説明', canonical:'https://xpotato.net/blog/safe/', pubDate:'2026-10-06', author:{name:'Xpotato',url:'https://xpotato.net/about/'},draft:false,noindex:false };
  it('derives dates and author without invented update or image', () => {
    const result=deriveArticleSeo(input)!;
    expect(result['@type']).toBe('BlogPosting'); expect(result.author.name).toBe('Xpotato');
    expect(result).not.toHaveProperty('dateModified'); expect(result).not.toHaveProperty('image');
    expect(deriveArticleSeo({...input,collection:'notes',updatedDate:'2026-10-07'})?.dateModified).toBe('2026-10-07');
  });
  it('suppresses held, noindex, preview and non-article types', () => {
    for(const overrides of [{draft:true},{noindex:true},{preview:true},{collection:'projects'}]) expect(deriveArticleSeo({...input,...overrides})).toBeUndefined();
  });
  it('escapes script-closing editorial text while preserving JSON values', () => {
    const title='</script><script>alert(1)</script>\u2028'; const output=serializeJsonLd({title});
    expect(output).not.toContain('<'); expect(JSON.parse(output)).toEqual({title});
  });
});
