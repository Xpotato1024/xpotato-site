export const siteConfig = {
  name: "Xpotato",
  url: "https://xpotato.net",
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
    { href: "/blog/", label: "Blog" },
    { href: "/notes/", label: "Notes" },
    { href: "/projects/", label: "Projects" }
  ]
} as const;

export function absoluteUrl(pathname: string) {
  return new URL(pathname, siteConfig.url).toString();
}
