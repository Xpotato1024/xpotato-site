import { describe, expect, it } from "vitest";
import { deriveContentSeo, deriveArticleSeo, serializeJsonLd } from "./seo.js";

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
