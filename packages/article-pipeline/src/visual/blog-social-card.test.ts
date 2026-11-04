import {it,expect} from 'vitest';
import {resolve} from 'node:path';
import {deterministicCover,deterministicBlogSocialCard} from '@xpotato/media-ingest';
import {coverForPlan} from './visual-media-runtime.js';
it('keeps hero bytes while binding selected C and display lines to the existing visual plan',async()=>{
 const repositoryRoot=resolve('.'),categoryLabel='ソフトウェア';
 const frontmatter={id:'00000000-0000-4000-8000-000000000001',title:'安全な設計を小さく試す',pubDate:'2026-10-29',cardDisplay:{lines:['安全な設計を','小さく試す']},seo:{titleOverride:'SEO向け見出し'}};
 const result=await coverForPlan(repositoryRoot,frontmatter,categoryLabel),old=await deterministicCover({repositoryRoot,...frontmatter,categoryLabel});
 const social=await deterministicBlogSocialCard({repositoryRoot,contentId:frontmatter.id,...frontmatter,categoryLabel});
 expect(result.hero.equals(old.hero)).toBe(true);expect(result.social.equals(social.svg)).toBe(true);
 expect(result.binding.social.layout.title).toBe(frontmatter.title);expect(result.binding.social.layout.title).not.toBe(frontmatter.seo.titleOverride);
 const changed=await coverForPlan(repositoryRoot,{...frontmatter,cardDisplay:undefined},categoryLabel);
 expect(changed.derivationSha256).not.toBe(result.derivationSha256);
},30000);
