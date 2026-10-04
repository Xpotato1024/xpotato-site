import { siteConfigSchema } from "@xpotato/content-contracts";

export const siteConfig = siteConfigSchema.parse({
  site: {
    name: "Xpotato",
    shortName: "Xpotato",
    canonicalOrigin: "https://xpotato.net/",
    locale: "ja-JP",
    language: "ja",
    timezone: "Asia/Tokyo",
    defaultDescription: "技術とものづくりの記録",
  },
  publisher: { displayName: "Xpotato" },
  navigation: [
    { id: "blog", label: "Blog", href: "/blog/", order: 10, location: ["header", "footer"], status: "active" },
    { id: "projects", label: "制作物", href: "/projects/", order: 20, location: ["header", "footer"], status: "active" },
    { id: "tools", label: "ツール", href: "/tools/", order: 30, location: ["header", "footer"], status: "active" },
    { id: "about", label: "About", href: "/about/", order: 40, location: ["header", "footer"], status: "active" },
    { id: "search", label: "検索", href: "/search/", order: 50, location: ["header"], status: "active" },
    { id: "notes", label: "Notes", href: "/notes/", order: 60, location: ["footer"], status: "active" },
  ],
  socialLinks: [],
  discovery: { rssPath: "/rss.xml", searchPath: "/search/" },
});
