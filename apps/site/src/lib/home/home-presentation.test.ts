import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const source = (path: string) => readFileSync(`apps/site/src/${path}`, 'utf8');
describe('home introduction and internal link presentation', () => {
  const home = source('pages/index.astro');
  it('keeps the English headline followed by a small catch without hero controls', () => {
    const hero = home.slice(home.indexOf('<section class="intro'), home.indexOf('<section class="home-projects"'));
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
    expect(home.indexOf('class="home-projects"')).toBeLessThan(home.indexOf('id="tools-heading"'));
    expect(home.indexOf('id="tools-heading"')).toBeLessThan(home.indexOf('id="records-heading"'));
    expect(hero).not.toContain('href="/about/"');
    expect(hero).not.toContain('href="/contact/"');
    expect(hero).not.toContain('ものづくり、プログラミング、日々の試行錯誤。');
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
    const headerRule=css.match(/\.home-header-layout \.header-band::before \{([^}]+)\}/)?.[1];
    expect(headerRule).toBeDefined();
    const transition=headerRule!.match(/transition:([^;]+)/)?.[1];
    expect(transition).toBeDefined();
    expect(transition).toMatch(/background-color\s+\.7s ease-in-out/);
    expect(css).toContain('transition: color .35s ease-in-out .175s');
    expect(css).toContain('transition: filter .35s ease-in-out .175s');
  });
  it('uses one header/menu material plane while both menu paths remain transparent',()=>{
    const css=source('styles/home.css');
    const base=css.match(/\.home-header-layout \.header-band::before \{([^}]+)\}/)?.[1];
    expect(base).toContain('background: #faf9f7;');expect(base).toContain('--home-glass-height');
    expect(base).toContain('pointer-events: none');
    const glass=css.match(/\.home-header-layout \.header-band\[data-home-header-state\]::before \{([^}]+)\}/)?.[1];
    expect(glass).toContain('background: #faf9f7c7;');expect(glass).toContain('backdrop-filter: blur(18px) saturate(145%)');
    const fallback=css.match(/\.home-header-layout :is\(\.mobile-menu-panel, \.mobile-menu-fallback nav\) \{([^}]+)\}/)?.[1];
    expect(fallback).toContain('background: #faf9f7;');
    const menu=css.match(/\.home-header-layout \.header-band\[data-home-header-state\] :is\(\.mobile-menu-panel, \.mobile-menu-fallback nav\) \{([^}]+)\}/)?.[1];
    for(const declaration of ['background: transparent','border-color: transparent','box-shadow: none','backdrop-filter: none','inset: var(--home-header-height) 0 auto'])expect(menu).toContain(declaration);
  });
  it('delays only enhanced menu label entry, not closing or reduced motion',()=>{
    const css=source('styles/home.css');
    const closed=css.match(/\.home-header-layout \.header-band\[data-home-header-state\] :is\(\.mobile-menu-panel, \.mobile-menu-fallback nav\) > ul \{([^}]+)\}/)?.[1];
    expect(closed).toContain('opacity: 0');expect(closed).toContain('transition: opacity .2s ease;');expect(closed).not.toContain('transition-delay');
    const opened=css.match(/\.home-header-layout \.header-band\[data-home-header-state\] :is\(\.mobile-menu-panel:popover-open, \.mobile-menu-fallback\[open\] nav\) > ul \{([^}]+)\}/)?.[1];
    expect(opened).toContain('opacity: 1');expect(opened).toContain('transition-delay: .35s');expect(opened).toContain('@starting-style { opacity: 0');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[^}]*\.home-header-layout \.header-band \*[^}]*transition: none !important/);
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
