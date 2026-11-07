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
    { id: "blog", label: "記事", href: "/articles/", order: 10, location: ["header", "footer"], status: "active" },
    { id: "education", label: "教育資料", href: "/education/", order: 15, location: ["header", "footer"], status: "active" },
    { id: "projects", label: "制作物", href: "/projects/", order: 20, location: ["header", "footer"], status: "active" },
    { id: "tools", label: "ツール", href: "/tools/", order: 30, location: ["header", "footer"], status: "active" },
    { id: "about", label: "サイト紹介", href: "/about/", order: 40, location: ["header", "footer"], status: "active" },
    { id: "contact", label: "問い合わせ", href: "/contact/", order: 45, location: ["header", "footer"], status: "active" },
    { id: "search", label: "検索", href: "/search/", order: 50, location: ["header"], status: "active" },
    { id: "notes", label: "メモ", href: "/notes/", order: 12, location: ["header", "footer"], status: "active" },
  ],
  socialLinks: [
    { id: "instagram", label: "Instagram", href: "https://www.instagram.com/miyu_to_x/", rel: ["me", "noopener", "noreferrer"], status: "active" },
    { id: "x", label: "X", href: "https://twitter.com/bael_fps", rel: ["me", "noopener", "noreferrer"], status: "active" },
    { id: "github", label: "GitHub", href: "https://github.com/Xpotato1024", rel: ["me", "noopener", "noreferrer"], status: "active" },
  ],
  discovery: { rssPath: "/rss.xml", searchPath: "/search/" },
});

/** Shared section order; search and RSS keep their dedicated controls. */
export const getSectionNavigation = (location: "header" | "footer", entries = siteConfig.navigation) =>
  entries.filter(item => item.status === "active" && item.id !== "search" && item.location.includes(location))
    .sort((left, right) => left.order - right.order);
