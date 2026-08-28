import { describe, expect, it } from "vitest";
import { deriveContentSeo } from "./seo.js";

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
