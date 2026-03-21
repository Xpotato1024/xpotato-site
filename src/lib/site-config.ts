export const siteConfig = {
  name: "Xpotato",
  title: "Xpotato",
  url: "https://xpotato.net",
  assetsUrl: "https://assets.xpotato.net",
  description:
    "ブログ、制作物、学習資料、ツールを横断して案内する Xpotato の個人サイト。",
  locale: "ja_JP",
  author: "miyut",
  tagline:
    "複数ジャンルの更新をまとめて辿れる、Xpotato の総合入口サイト。",
  social: {
    github: "https://github.com/xpotato1024"
  },
  navigation: [
    { href: "/", label: "Home" },
    { href: "/blog/", label: "Blog" },
    { href: "/projects/", label: "制作物" },
    { href: "/notes/", label: "学習資料" },
    { href: "/tools/", label: "ツール" }
  ],
  footerNavigation: [
    { href: "/", label: "Home" },
    { href: "/blog/", label: "Blog" },
    { href: "/projects/", label: "制作物" },
    { href: "/notes/", label: "学習資料" },
    { href: "/tools/", label: "ツール" },
    { href: "/about/", label: "About" }
  ]
} as const;

export function absoluteUrl(pathname: string) {
  return new URL(pathname, siteConfig.url).toString();
}

interface ResolveMediaUrlOptions {
  absolute?: boolean;
}

export function resolveMediaUrl(pathname?: string, options: ResolveMediaUrlOptions = {}) {
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

  if (options.absolute) {
    return absoluteUrl(pathname);
  }

  return pathname;
}
