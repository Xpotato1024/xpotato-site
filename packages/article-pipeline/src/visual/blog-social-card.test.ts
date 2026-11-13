import {it,expect} from 'vitest';
import {resolve} from 'node:path';
import {deterministicCover,deterministicBlogSocialCard} from '@xpotato/media-ingest';
import {coverForPlan} from './visual-media-runtime.js';
import {sha256} from '../canonical.js';
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

it('binds private social lines without changing article frontmatter, title, or hero',async()=>{
 const repositoryRoot=resolve('.'),categoryLabel='ロボティクス';
 const frontmatter={id:'00000000-0000-4000-8000-000000000001',title:'MuJoCo 4.0の新機能を画像で見る',pubDate:'2026-11-12'};
 const before=JSON.stringify(frontmatter),display={titleSha256:sha256(frontmatter.title),lines:['MuJoCo 4.0の新機能を','画像で見る']};
 const actual=await coverForPlan(repositoryRoot,frontmatter,categoryLabel,display);
 const legacy=await coverForPlan(repositoryRoot,frontmatter,categoryLabel);
 const direct=await deterministicBlogSocialCard({repositoryRoot,contentId:frontmatter.id,title:frontmatter.title,categoryLabel,cardDisplay:{lines:display.lines}});
 expect(actual.social.equals(direct.svg)).toBe(true);expect(actual.hero.equals(legacy.hero)).toBe(true);
 expect(actual.binding.social.layout).toMatchObject({title:frontmatter.title,lines:display.lines,mode:'manual'});
 expect(actual.derivationSha256).not.toBe(legacy.derivationSha256);expect(JSON.stringify(frontmatter)).toBe(before);
 expect(frontmatter).not.toHaveProperty('cardDisplay');
},30000);
it.each([
 {titleSha256:'e'.repeat(64),lines:['安全な設計を','小さく試す']},
 {titleSha256:sha256('安全な設計を小さく試す'),lines:['安全な設計を','大きく試す']},
 {titleSha256:sha256('安全な設計を小さく試す'),lines:['安全な設計を','小さく試す'],title:'置換タイトル'},
 {titleSha256:sha256('安全な設計を小さく試す'),lines:['安全','な','設計','を','小さく試す']},
 {titleSha256:sha256('安全な設計を小さく試す'),lines:['安全な設計を','小さく試す'],style:{fontSize:1}},
])('rejects stale title, changed text, unknown overrides and excessive lines: %j',async(display)=>{
 await expect(coverForPlan(resolve('.'),{id:'00000000-0000-4000-8000-000000000001',title:'安全な設計を小さく試す',pubDate:'2026-11-12'},'ソフトウェア',display)).rejects.toThrow();
});
it('rejects conflicting display metadata instead of silently overriding it',async()=>{
 const fm={id:'00000000-0000-4000-8000-000000000001',title:'安全な設計を小さく試す',pubDate:'2026-11-12',cardDisplay:{lines:['安全な設計を','小さく試す']}};
 await expect(coverForPlan(resolve('.'),fm,'ソフトウェア',{titleSha256:sha256(fm.title),lines:['安全な設計を小さく','試す']})).rejects.toThrow('DISPLAY_CONFLICT');
 const matching=await coverForPlan(resolve('.'),fm,'ソフトウェア',{titleSha256:sha256(fm.title),lines:fm.cardDisplay.lines});
 const old=await coverForPlan(resolve('.'),fm,'ソフトウェア');expect(matching.social.equals(old.social)).toBe(true);expect(matching.derivationSha256).toBe(old.derivationSha256);
},30000);

it.each([
 {title:'安全な設計を小さく試す',lines:['安全な設計を\n','小さく試す']},
 {title:'安全な設計を小さく試す',lines:['安全な設計を\u200b','小さく試す']},
 {title:'Node.jsを試す',lines:['Node.','jsを試す']},
 {title:'安全な設計を小さく試す',lines:['小さく試す','安全な設計を']},
])('rejects injected controls or invalid title segmentation: %j',async({title,lines})=>{
 await expect(coverForPlan(resolve('.'),{id:'00000000-0000-4000-8000-000000000001',title,pubDate:'2026-11-12'},'ソフトウェア',{titleSha256:sha256(title),lines})).rejects.toThrow();
});
