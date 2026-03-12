export const siteConfig = {
  name: "Xpotato",
  url: "https://xpotato.net",
  assetsUrl: "https://assets.xpotato.net",
  title: "Xpotato",
  description:
    "Astro と MDX を軸に、技術メモ、制作記録、実験的な小規模アプリをまとめる個人サイト。",
  locale: "ja_JP",
  author: "miyut",
  tagline: "技術メモ、制作記録、小さな実験を積み上げるサイト",
  social: {
    github: "https://github.com/xpotato1024"
  },
  navigation: [
    { href: "/", label: "Home" },
    { href: "/about/", label: "About" },
    { href: "/pages/", label: "Pages" },
    { href: "/blog/", label: "Blog" },
    { href: "/notes/", label: "Notes" },
    { href: "/projects/", label: "Projects" }
  ]
} as const;

export function absoluteUrl(pathname: string) {
  return new URL(pathname, siteConfig.url).toString();
}

export function resolveMediaUrl(pathname?: string) {
  if (!pathname) {
    return undefined;
  }

  if (/^https?:\/\//.test(pathname)) {
    return pathname;
  }

  if (pathname.startsWith("r2:/")) {
    const normalizedPath = pathname.slice(4).replace(/^\/+/, "");
    return new URL(normalizedPath, `${siteConfig.assetsUrl}/`).toString();
  }

  return absoluteUrl(pathname);
}
