import {expect,it} from 'vitest';
import {searchThumbnailSchema} from '@xpotato/content-contracts';
import {thumbnailFromPicture,withSearchThumbnail} from './search-thumbnail.js';
import {selectArticleHeroAsset} from '../src/lib/media/article-thumbnail.js';

it('uses the first active hero rather than inactive heroes or social images',()=>{
 expect(selectArticleHeroAsset([{assetId:'old',role:'hero',status:'retired'},{assetId:'social',role:'social_card',status:'active'},{assetId:'current',role:'hero',status:'active'}] as never)).toBe('current');
 expect(selectArticleHeroAsset([])).toBeUndefined();
});
it('extracts responsive dimensions and rejects unsafe image metadata',()=>{
 const result=thumbnailFromPicture('<picture><source type="image/webp" srcset="https://media.example/a.webp 320w, https://media.example/b.webp 640w"><img src="https://media.example/a.jpg" width="640" height="360"></picture>');
 expect(result.sources[0]?.candidates.map(c=>c.width)).toEqual([320,640]);
 expect(result).toMatchObject({width:640,height:360});
 expect(()=>thumbnailFromPicture('<picture><img src="javascript:alert(1)" width="640" height="360"></picture>')).toThrow();
 expect(()=>searchThumbnailSchema.parse({...result,width:0})).toThrow();
});
it('leaves non-article documents and articles without a registered hero unchanged',()=>{
 const doc={id:'b6834c4a-447f-4fe9-8879-222222222222',collection:'pages'} as never;
 expect(withSearchThumbnail(doc)).toBe(doc);
 const article={...doc as object,collection:'blog'} as never;
 expect(withSearchThumbnail(article)).toBe(article);
});
