import { describe, expect, it } from 'vitest';
import { siteConfig, getSectionNavigation } from './site-config.js';

describe('public section navigation', () => {
  it('shares one Japanese section order across header, mobile and footer', () => {
    const expected = [
      { id:'blog', label:'記事', href:'/articles/' },
      { id:'notes', label:'メモ', href:'/notes/' },
      { id:'education', label:'教育資料', href:'/education/' },
      { id:'projects', label:'制作物', href:'/projects/' },
      { id:'tools', label:'ツール', href:'/tools/' },
      { id:'about', label:'サイト紹介', href:'/about/' },
      { id:'contact', label:'問い合わせ', href:'/contact/' },
    ];
    for(const location of ['header','footer'] as const)
      expect(getSectionNavigation(location).map(({id,label,href})=>({id,label,href}))).toEqual(expected);
    expect(siteConfig.navigation.find(item=>item.id==='search')?.href).toBe('/search/');
  });
  it('can append a future site page without a special memo bucket or mutating public links', () => {
    const future = [...siteConfig.navigation, {id:'future',label:'追加ページ',href:'/future/',order:46,location:['header','footer'] as ('header'|'footer')[],status:'active' as const}];
    for(const location of ['header','footer'] as const){
      const items=getSectionNavigation(location,future);
      expect(items.map(item=>item.id)).toEqual(['blog','notes','education','projects','tools','about','contact','future']);
    }
    expect(getSectionNavigation('header').some(item=>item.id==='future')).toBe(false);
    expect(getSectionNavigation('header',[...future,{...future[0]!,id:'retired',status:'retired'}]).some(item=>item.id==='retired')).toBe(false);
  });
});
