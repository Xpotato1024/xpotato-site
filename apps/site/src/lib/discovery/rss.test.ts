import { describe, expect, it } from "vitest";
import type { ContentDiscoveryRecord } from "@xpotato/content-contracts";
import { taxonomyRegistry } from "../../content-registry/taxonomy/index.js";
import { renderRssFeed } from "./rss.js";

const record = (id: string, overrides: Partial<ContentDiscoveryRecord> = {}): ContentDiscoveryRecord => ({
  contentId: id,
  collection: "blog",
  route: `/blog/${id}/`,
  title: `Article ${id}`,
  description: "Summary only",
  pubDate: "2026-09-20",
  categoryId: "software",
  tagIds: ["astro"],
  featured: false,
  siteSearchEligible: true,
  webIndexable: true,
  ...overrides,
});

const site = {
  canonicalOrigin: "https://xpotato.net/",
  name: "Xpotato",
  description: "Site summary",
};

describe("summary RSS renderer", () => {
  it("emits at most 20 public writing items in stable date and ContentId order", () => {
    const records = Array.from({ length: 25 }, (_, index) =>
      record(`content-${String(index).padStart(2, "0")}`, {
        pubDate: index < 2 ? "2026-09-21" : "2026-09-20",
      }),
    ).reverse();
    records.push(
      record("noindex", { webIndexable: false, siteSearchEligible: false }),
      record("private-note", { collection: "notes", route: "/notes/private-note/", webIndexable:false, siteSearchEligible:false }),
      record("site-search-excluded", {
        pubDate: "2026-09-22",
        siteSearchEligible: false,
      }),
    );

    const xml = renderRssFeed(records, taxonomyRegistry, site);
    const ids = [...xml.matchAll(/<guid isPermaLink="false">https:\/\/xpotato\.net\/#([^<]+)<\/guid>/gu)].map((match) => match[1]);

    expect(ids).toHaveLength(20);
    expect(ids.slice(0, 3)).toEqual(["site-search-excluded", "content-00", "content-01"]);
    expect(ids).not.toContain("noindex");
    expect(ids).not.toContain("private-note");
    expect(ids).toContain("site-search-excluded");
    expect(xml).toContain("<link>https://xpotato.net/blog/content-00/</link>");
    expect(xml).toContain("<category>ソフトウェア</category>");
    expect(xml).toContain("<category>Astro</category>");
    expect(xml).not.toContain("full body text");
  });

  it('uses the same GUID, summary, date ordering and exclusion rules for memos and articles',()=>{
    const xml=renderRssFeed([
      record('memo',{collection:'notes',feed:true,route:'/notes/today/',categoryId:undefined,subjectId:'everyday',tagIds:[],pubDate:'2026-11-04',title:'日常 <メモ>',description:'思いつき & 記録'}),
      record('article'),record('tool',{collection:'tools'}),
      record('noindex-memo',{collection:'notes',feed:true,webIndexable:false}),
    ],taxonomyRegistry,site);
    expect(xml.match(/<item>/gu)).toHaveLength(2);
    expect(xml.indexOf('#memo')).toBeLessThan(xml.indexOf('#article'));
    expect(xml).toContain('<guid isPermaLink="false">https://xpotato.net/#memo</guid>');
    expect(xml).toContain('<link>https://xpotato.net/notes/today/</link>');
    expect(xml).toContain('<category>日々のこと</category>');
    expect(xml).toContain('<description>思いつき &amp; 記録</description>');
    expect(xml).not.toContain('#tool');expect(xml).not.toContain('#noindex-memo');
  });

  it("keeps the GUID stable when the canonical route is renamed and escapes summary text", () => {
    const original = renderRssFeed([record("stable-content", { title: "A <title>", description: "A & B" })], taxonomyRegistry, site);
    const renamed = renderRssFeed(
      [record("stable-content", { route: "/blog/renamed-route/", title: "A <title>", description: "A & B" })],
      taxonomyRegistry,
      site,
    );
    const guid = (xml: string) => xml.match(/<guid isPermaLink="false">([^<]+)<\/guid>/u)?.[1];

    expect(guid(original)).toBe("https://xpotato.net/#stable-content");
    expect(guid(renamed)).toBe(guid(original));
    expect(renamed).toContain("<title>A &lt;title&gt;</title>");
    expect(renamed).toContain("<description>A &amp; B</description>");
    expect(renamed).toContain("<link>https://xpotato.net/blog/renamed-route/</link>");
  });
});
