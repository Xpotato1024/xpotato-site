import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { carouselFixture } from './project-carousel-interaction.mjs';
import { parse } from 'parse5';

describe('carousel group markup', () => {
  it('uses generic containers compatible with aria-allowed-role while retaining slide names', () => {
    const source = readFileSync('apps/site/src/components/ProjectCarousel.astro', 'utf8');
    expect(source).toContain('<div class="project-track">');
    expect(source).toContain('<div class="project-slide" role="group" aria-roledescription="スライド" aria-label=');
    expect(source).not.toMatch(/<li[^>]*role="group"/);
  });
  it.each([0, 1, 2])('keeps the %i-slide browser fixture representative', count => {
    const html = '<div data-project-carousel><div class="project-track">' + Array.from({length: 6}, (_, i) => `<div class="project-slide" role="group" aria-label="${i+1} / 6"><article>Project ${i+1}</article></div>`).join('') + '</div></div>';
    const walk = (node: any): any[] => [node, ...(node.childNodes ?? []).flatMap(walk)];
    const nodes = walk(parse(carouselFixture(html, count)));
    const slides = nodes.filter(n => n.attrs?.some((a: any) => a.name === 'class' && a.value === 'project-slide'));
    expect(slides).toHaveLength(count);
    expect(slides.map(n => n.attrs.find((a: any) => a.name === 'aria-label').value)).toEqual(Array.from({length: count}, (_, i) => `${i+1} / ${count}`));
  });
});
