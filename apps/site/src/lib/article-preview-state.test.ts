import {describe,it,expect} from 'vitest';
// @ts-ignore Plain-JS preview helper, no runtime dependency.
import {previewHeroOptions,assertPreviewExportable} from '../../../../scripts/article-preview-state.mjs';
describe('article final hero boundary',()=>{
 it('rejects a missing final hero',()=>expect(()=>previewHeroOptions([],{})).toThrow('PREVIEW_HERO_REQUIRED'));
 it('allows only explicit placeholder fixtures',()=>expect(previewHeroOptions(['--composition-only'],{})).toEqual({heroPath:'',compositionOnly:true}));
 it('accepts the supplied path without publishing it',()=>expect(previewHeroOptions([],{ARTICLE_PREVIEW_HERO:'/tmp/hero.png'}).heroPath).toBe('/tmp/hero.png'));
 it('rejects ambiguous modes',()=>expect(()=>previewHeroOptions(['--composition-only'],{ARTICLE_PREVIEW_HERO:'/tmp/hero.png'})).toThrow('AMBIGUOUS'));
 it('does not export a placeholder as final',()=>expect(()=>assertPreviewExportable({productionEligible:false,heroState:'internal-composition-slot-not-final'})).toThrow('FINAL_HERO_MISSING'));
 it('labels composition-only exports accurately',()=>expect(assertPreviewExportable({productionEligible:false,heroState:'internal-composition-slot-not-final'},true)).toBe('composition-only'));
 it('binds the hero to the candidate identity',()=>expect(()=>assertPreviewExportable({productionEligible:false,heroState:'provided-hero',heroSha256:'a',identity:{hero:{sha256:'b'}}})).toThrow('BINDING_MISMATCH'));
 it('accepts a bound private final preview',()=>expect(assertPreviewExportable({productionEligible:false,heroState:'provided-hero',heroSha256:'a',identity:{hero:{sha256:'a'}}})).toBe('final-review'));
 it('does not accept production records',()=>expect(()=>assertPreviewExportable({productionEligible:true})).toThrow('NOT_PRIVATE'));
});
