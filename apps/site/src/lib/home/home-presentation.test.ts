import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const source = (path: string) => readFileSync(`apps/site/src/${path}`, 'utf8');
describe('home introduction and internal link presentation', () => {
  const home = source('pages/index.astro');
  it('keeps a single hero action and moves explanatory copy into its own next section', () => {
    const hero = home.slice(home.indexOf('<section class="intro'), home.indexOf('<section class="home-projects"'));
    const sections = hero.split('<section class="home-introduction"');
    expect(sections).toHaveLength(2);
    expect(sections[0]).not.toContain('class="home-brand"');
    expect(sections[0]).toContain('<span>Think.</span> <span>Build.</span> <span>Run.</span>');
    expect(sections[0]).toContain('href="/projects/"');
    expect(sections[0]).not.toContain('href="/about/"');
    expect(sections[0]).not.toContain('href="/contact/"');
    expect(sections[0]).not.toContain('日々の試行錯誤。');
    expect(sections[1]).toContain('aria-label="ものづくり、プログラミング、日々の試行錯誤。"');
    for (const path of ['/projects/', '/tools/', '/articles/']) expect(sections[1]).toContain(`href="${path}"`);
    expect(sections[1]).toContain('class="home-topic-title"');
    expect(sections[1]).toContain('class="home-topic-destination"');
    expect(sections[1]).not.toContain('</a>。');
    expect(sections[1]).toContain('href="/about/"');
    expect(home).toContain('<BaseLayout image={workshopAsset?.socialImage}');
  });
  it('uses open typographic navigation without card surfaces or decorative gradients', () => {
    const css = source('styles/home.css');
    const introduction = css.slice(css.indexOf('/* An unboxed index'));
    expect(introduction).not.toMatch(/gradient\(|box-shadow:|border-radius:/);
    expect(introduction).toContain('border-bottom: 1px solid var(--border)');
    expect(introduction).toContain('min-height: 48px');
    expect(introduction).toContain('text-underline-offset: .3em');
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
