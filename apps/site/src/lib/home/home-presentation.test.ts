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
    expect(sections[0]).toContain('class="home-title-accessible"');
    expect(sections[0]?.match(/class="home-title-row" aria-hidden="true"/g)).toHaveLength(3);
    expect(sections[0]).toContain('name="pause-home-title"');
    expect(sections[0]).not.toContain('aria-live');
    expect(sections[0]).toContain('href="/projects/"');
    expect(sections[0]).not.toContain('href="/about/"');
    expect(sections[0]).not.toContain('href="/contact/"');
    expect(sections[0]).toContain('ものづくり、プログラミング、日々の試行錯誤。');
    expect(sections[1]).not.toContain('home-topics');
    for (const path of ['/projects/', '/tools/', '/articles/']) expect(sections[1]).not.toContain(`href="${path}"`);
    expect(sections[1]).toContain('href="/about/"');
    expect(home).toContain('<BaseLayout image={workshopAsset?.socialImage}');
  });
  it('reserves both languages and offers pause and a static reduced-motion version', () => {
    const css = source('styles/home.css');
    expect(css).toContain('grid-area: 1 / 1');
    expect(css).toContain(':has([name="pause-home-title"]:checked) .home-title-japanese { animation: none; opacity: 1; }');
    expect(css).toContain('.home-title-japanese { animation: none; opacity: 1; }');
    expect(css).toContain('.home-motion-toggle { display: none; }');
    expect(css).not.toContain('#bda0dc');
    expect(css).not.toContain('.home-topics');
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
