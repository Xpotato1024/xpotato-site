import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const source = (path: string) => readFileSync(`apps/site/src/${path}`, 'utf8');
describe('home introduction and internal link presentation', () => {
  const home = source('pages/index.astro');
  it('keeps the English headline followed by a small catch without hero controls', () => {
    const hero = home.slice(home.indexOf('<section class="intro'), home.indexOf('<section class="home-projects"'));
    const sections = hero.split('<section class="home-introduction"');
    expect(sections).toHaveLength(2);
    expect(sections[0]).not.toContain('class="home-brand"');
    expect(sections[0]).toContain('class="home-title-static" lang="en"');
    expect(sections[0]).toContain('<span>Think.</span><span>Build.</span><span>Run.</span>');
    expect(sections[0]).not.toContain('home-title-japanese');
    expect(sections[0]).not.toContain('pause-home-title');
    expect(sections[0]).not.toContain('aria-live');
    expect(sections[0]).not.toMatch(/<(?:a|button)\b/);
    expect(sections[0]).toMatch(/<\/h1>\s*<p class="home-catch">ものづくり、プログラミング、日々の試行錯誤<\/p>/);
    expect(home).toContain('description="Xpotatoの技術とものづくりの記録。ロボティクスやプログラミングの試行錯誤、制作物、教育資料、ブラウザで使える小さなツールをまとめています。"');
    expect(home.indexOf('class="home-projects"')).toBeLessThan(home.indexOf('id="tools-heading"'));
    expect(home.indexOf('id="tools-heading"')).toBeLessThan(home.indexOf('id="records-heading"'));
    expect(sections[0]).not.toContain('href="/about/"');
    expect(sections[0]).not.toContain('href="/contact/"');
    expect(sections[0]).not.toContain('ものづくり、プログラミング、日々の試行錯誤。');
    expect(sections[1]).not.toContain('home-topics');
    for (const path of ['/projects/', '/tools/', '/articles/']) expect(sections[1]).not.toContain(`href="${path}"`);
    expect(sections[1]).toContain('href="/about/"');
    expect(home).toContain('<BaseLayout image={workshopAsset?.socialImage}');
  });
  it('keeps the hero static and scopes the glass header to the homepage', () => {
    const css = source('styles/home.css');
    expect(css).not.toContain('@keyframes home-title');
    expect(css).not.toContain('button-glass');
    expect(css).toContain('.home-header-layout .header-band');
    expect(css).toContain('data-home-header-state="top"');
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(source('components/SiteFooter.astro')).not.toContain('reduce-home-motion');
    expect(source('layouts/BaseLayout.astro')).toContain('Astro.props.homeHeader && <script');
    expect(home).toContain(' homeHeader title=');
    expect(home).not.toContain('home-primary-link');
    expect(css).toContain('.home-catch');
    expect(css).toMatch(/backdrop-filter\s+\.7s ease-in-out/);
    const headerRule=css.match(/\.home-header-layout \.header-band \{([^}]+)\}/)?.[1];
    expect(headerRule).toBeDefined();
    const transition=headerRule!.match(/transition:([^;]+)/)?.[1];
    expect(transition).toBeDefined();
    expect(transition).toMatch(/background-color\s+\.7s ease-in-out/);
    expect(css).toContain('transition: color .35s ease-in-out .175s');
    expect(css).toContain('transition: filter .35s ease-in-out .175s');
  });
  it('gives both homepage menu paths the same glass and an opaque unsupported-filter fallback',()=>{
    const css=source('styles/home.css');
    const rules=[...css.matchAll(/\.home-header-layout :is\(\.mobile-menu-panel, \.mobile-menu-fallback nav\) \{([^}]+)\}/g)].map(match=>match[1]);
    expect(rules).toHaveLength(2);
    expect(rules[0]).toContain('background: #faf9f7;');
    expect(rules[0]).not.toContain('backdrop-filter');
    expect(rules[1]).toContain('background: #faf9f7c7;');
    expect(rules[1]).toContain('backdrop-filter: blur(18px) saturate(145%)');
    expect(css).toMatch(/\.header-band:has\(\.mobile-menu-panel:popover-open, \.mobile-menu-fallback\[open\]\) \{[^}]*border-bottom-color: transparent/);
  });
  it('uses the closing block for contact without repeating the introduction', () => {
    const closing = home.slice(home.indexOf('<section class="home-contact"'));
    expect(closing).toContain('href="/contact/"');
    expect(closing).not.toContain('href="/about/"');
    expect(home).not.toContain('考えたことを、つくって確かめる。');
  });
  it('uses right arrows for content routes while retaining external indicators', () => {
    for (const file of ['components/ProjectCarousel.astro', 'components/content/ArticleCard.astro', 'components/content/ArchivePage.astro', 'pages/projects/index.astro', 'pages/tools/index.astro']) {
      expect(source(file)).not.toContain('↗');
      expect(source(file)).toContain('aria-hidden="true">');
      expect(source(file)).toContain('→');
    }
    expect(source('components/SocialLinks.astro')).toContain('↗');
    expect(source('pages/projects/[...slug].astro')).toContain('↗');
  });
});
