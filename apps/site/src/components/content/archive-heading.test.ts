import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
describe('archive heading hierarchy', () => {
  it('keeps category breadcrumbs and the page title without a duplicate collection eyebrow', () => {
    const archive = source('./ArchivePage.astro');
    expect(archive).toContain('<ToolBreadcrumbs items={breadcrumbs} />');
    expect(archive).toContain('<h1>{page.title}</h1>');
    expect(archive).not.toContain('class="eyebrow"');
    expect(archive).not.toContain('Writing /');
  });
  it('uses the same single-heading pattern for the article tag directory', () => {
    const tags = source('../../pages/articles/tags/[...page].astro');
    expect(tags).toContain('<h1>記事のタグ一覧</h1>');
    expect(tags).not.toContain('class="eyebrow"');
    expect(tags).not.toContain('Writing /');
  });
});
