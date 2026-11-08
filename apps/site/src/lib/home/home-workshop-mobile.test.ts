import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { homeWorkshopMobileProfile, homeWorkshopMobilePicture, validateHomeWorkshopMobileDelivery } from './home-workshop-mobile.js';
const reviewed=JSON.parse(readFileSync('apps/site/source-inputs/home-workshop/reviewed-recipe.json','utf8'));
describe('bounded homepage mobile delivery',()=>{
  it('keeps the original vertical resolution and 58% horizontal composition',()=>{
    const profile=homeWorkshopMobileProfile;
    expect(profile.crop).toEqual({left:464,top:0,width:1600,height:1350});
    expect(profile.crop.left).toBeCloseTo((2400-profile.crop.width)*.58);
    expect(profile.widths.map(width=>width*27/32)).toEqual([540,810,1080]);
    expect(profile.media).toBe('(max-width: 430px)');
    const css=readFileSync('apps/site/src/styles/home.css','utf8');
    expect(css).toContain('object-position: 58% center');
    const picture=homeWorkshopMobilePicture(reviewed.mobileDelivery);
    expect(picture.sources.map(source=>source.type)).toEqual(['image/avif','image/webp','image/jpeg']);
    for(const source of picture.sources)expect(source.srcset.split(', ').map(item=>item.split(' ')[1])).toEqual(['640w','960w','1280w']);
  });
  it('rejects changed profiles, dimensions, incomplete sets and object identities',()=>{
    for(const change of [
      (x:any)=>{x.profileId='other';},(x:any)=>{x.profileSha256='0'.repeat(64);},
      (x:any)=>{x.objects.pop();},(x:any)=>{x.objects[0].height=1;},
      (x:any)=>{x.objects[0].objectKey=x.objects[0].objectKey.replace(x.objects[0].sha256,'0'.repeat(64));},
      (x:any)=>{x.objects[0]=x.objects[1];},
    ]){const value=structuredClone(reviewed.mobileDelivery);change(value);expect(()=>validateHomeWorkshopMobileDelivery(value)).toThrow();}
  });
  it('reduces high-density AVIF bytes while preserving the desktop recipe',()=>{
    const original=reviewed.registryCandidate.assets[0].delivery.variants.find((x:any)=>x.format==='avif'&&x.width===1920);
    const mobile=reviewed.mobileDelivery.objects.find((x:any)=>x.format==='avif'&&x.width===1280);
    expect(original.sha256).toBe('c48d2217b96b9db0d1e12133273ce0b7971ec23f1be30ddf8459dace7cbb6763');
    expect(mobile.height).toBe(original.height);
    expect(mobile.sizeBytes).toBeLessThan(original.sizeBytes*.8);
  });
});
