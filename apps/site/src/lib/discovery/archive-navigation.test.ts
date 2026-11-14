import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {taxonomyRegistry} from '../../content-registry/taxonomy/index.js';
import {groupArchiveTags} from './archive-navigation.js';
import type {DirectoryTag} from './tag-directory.js';

const tag = (id:string, count=1):DirectoryTag => ({id, count, label:id, aliases:[], route:`/articles/tag/${id}/`});
describe('archive navigation', () => {
  it('keeps all seven singleton links and separates purpose without changing counts or routes', () => {
    const tags=['mujoco','simulation','control','modern-control','embedded','software-development','explanation'].map(id=>tag(id));
    const groups=groupArchiveTags(tags,taxonomyRegistry);
    expect(groups.map(group=>group.tags.length)).toEqual([6,1]);
    expect(groups[1]).toEqual({label:'記事の目的から探す',tags:[tags[6]]});
    expect(groups.flatMap(group=>group.tags)).toEqual(tags);
  });
  it('does not truncate growing directories or hide singleton topics among popular ones', () => {
    const tags=[tag('explanation',3),tag('mujoco',10),...Array.from({length:30},(_,i)=>tag(`topic-${i}`))];
    const actual=groupArchiveTags(tags,taxonomyRegistry).flatMap(group=>group.tags);
    expect(actual).toHaveLength(tags.length);
    expect(new Set(actual)).toEqual(new Set(tags));
  });
  it('omits empty groups and respects registry kind rather than a hardcoded label', () => {
    expect(groupArchiveTags([],taxonomyRegistry)).toEqual([]);
    const taxonomy={...taxonomyRegistry,tags:taxonomyRegistry.tags.map(term=>term.id==='mujoco'?{...term,kind:'purpose' as const}:term)};
    expect(groupArchiveTags([tag('mujoco')],taxonomy)).toEqual([{label:'記事の目的から探す',tags:[tag('mujoco')]}]);
  });
  it('keeps disclosures closed, renders complete groups, and retains the selected category inside the switcher', () => {
    const source=readFileSync(new URL('../../components/content/BlogArchiveNavigation.astro',import.meta.url),'utf8');
    expect(source).not.toMatch(/<details[^>]*\sopen(?:[\s=>])/u);
    expect(source).not.toContain('archive-selection');
    expect(source).not.toContain('previewTags');
    expect(source).toContain('tags={group.tags}');
    expect(source).toContain("scope===currentScope?'page':undefined");
    expect(source).toContain('href="/articles/tags/"');
    expect(source).toContain('href="/search/#tags"');
  });
});
