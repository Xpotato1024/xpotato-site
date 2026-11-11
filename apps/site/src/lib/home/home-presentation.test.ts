import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const source = (path: string) => readFileSync(`apps/site/src/${path}`, 'utf8');
describe('home introduction and internal link presentation', () => {
  const home = source('pages/index.astro');
  it('keeps the English headline followed by a small catch without hero controls', () => {
    const hero = home.slice(home.indexOf('<section class="intro'), home.indexOf('</section>') + '</section>'.length);
    expect(home).not.toContain('home-introduction');
    expect(home).not.toContain('home-contact');
    expect(hero).not.toContain('class="home-brand"');
    expect(hero).toContain('class="home-title-static" lang="en"');
    expect(hero).toContain('<span>Think.</span><span>Build.</span><span>Run.</span>');
    expect(hero).not.toContain('home-title-japanese');
    expect(hero).not.toContain('pause-home-title');
    expect(hero).not.toContain('aria-live');
    expect(hero).not.toMatch(/<(?:a|button)\b/);
    expect(hero).toMatch(/<\/h1>\s*<p class="home-catch">ものづくり、プログラミング、日々の試行錯誤<\/p>/);
    expect(home).toContain('description="Xpotatoの技術とものづくりの記録。ロボティクスやプログラミングの試行錯誤、制作物、教育資料、ブラウザで使える小さなツールをまとめています。"');
    expect(home.indexOf('id="updates-heading"')).toBeLessThan(home.indexOf('id="records-heading"'));
    expect(home.indexOf('id="records-heading"')).toBeLessThan(home.indexOf('id="tools-heading"'));
    expect(home.indexOf('id="tools-heading"')).toBeLessThan(home.indexOf('id="projects-heading"'));
    expect(hero).not.toContain('href="/about/"');
    expect(hero).not.toContain('href="/contact/"');
    expect(hero).not.toContain('ものづくり、プログラミング、日々の試行錯誤。');
    expect(home).toContain('<BaseLayout image={workshopAsset?.socialImage}');
  });
  it('keeps the hero static and scopes only photo fusion to the homepage', () => {
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
    expect(css).toContain('--header-glass-motion: .7s ease-in-out');
    expect(css).toContain('--header-ink-motion: .35s ease-in-out .175s');
    expect(css).not.toContain('.home-header-layout .header-band::before {');
    expect(css).not.toContain('data-menu-surface');
    const shared=source('styles/global.css');
    const headerRule=shared.match(/\.header-band::before \{([^}]+)\}/)?.[1];
    expect(headerRule).toContain('transition: var(--header-glass-motion, .2s ease)');
    expect(headerRule).toContain('transition-property: background-color, border-color, box-shadow, -webkit-backdrop-filter, backdrop-filter');
    expect(shared).toContain('transition: color var(--header-ink-motion, .2s ease)');
    expect(shared).toContain('transition: filter var(--header-ink-motion, .2s ease)');
    expect(shared).toContain('--header-glass-motion: .2s ease; --header-ink-motion: .2s ease');
  });
  it('shares one header/menu material plane across all routes',()=>{
    const css=source('styles/global.css');
    expect(css).not.toContain('home-header-layout');
    const planes=[...css.matchAll(/\.header-band::before \{([^}]+)\}/g)].map(match=>match[1] ?? '');
    const base=planes.find(rule=>rule.includes('content:'));
    expect(base).toContain('background: #faf9f7;');expect(base).toContain('--site-glass-height');
    expect(base).toContain('pointer-events: none');
    const glass=planes.find(rule=>rule.includes('background: #faf9f7c7;'));
    expect(glass).toContain('backdrop-filter: blur(18px) saturate(145%)');
    const fallback=css.match(/:is\(\.mobile-menu-panel, \.mobile-menu-fallback nav\) \{ (background:[^}]+)\}/)?.[1];
    expect(fallback).toContain('background: #faf9f7;');
    const menu=css.match(/\.header-band\[data-menu-surface="shared"\] :is\(\.mobile-menu-panel, \.mobile-menu-fallback nav\) \{([^}]+)\}/)?.[1];
    for(const declaration of ['background: transparent','border-color: transparent','box-shadow: none','backdrop-filter: none','inset: var(--site-header-bottom) 0 auto'])expect(menu).toContain(declaration);
  });
  it('uses only the immediate panel fade for labels and disables reduced motion',()=>{
    const css=source('styles/global.css');
    expect(css).toContain('transition: opacity .2s, display .2s allow-discrete, overlay .2s allow-discrete');
    expect(css).not.toMatch(/data-menu-surface[^{}]+> ul/);
    expect(css).not.toContain('transition: opacity .2s ease .35s');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[^}]*\.header-band \*[^}]*transition: none !important/);
  });
  it('keeps about and contact in shared header/menu/footer rather than standalone home bands', () => {
    expect(home).not.toContain('home-introduction');expect(home).not.toContain('home-contact');
    const config=source('lib/site-config.ts');
    for(const path of ['/about/','/contact/'])expect(config.split('\n').find(line=>line.includes('href: "'+path+'"'))).toContain('location: ["header", "footer"]');
    expect(source('components/SiteFooter.astro')).toContain("getSectionNavigation('footer')");
    expect(source('layouts/BaseLayout.astro')).toContain('getSectionNavigation("header")');
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
