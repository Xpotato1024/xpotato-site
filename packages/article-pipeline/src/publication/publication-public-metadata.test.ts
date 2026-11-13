import {describe,it,expect} from 'vitest';
import {assertPublicPublicationMetadata} from './publication-public-metadata.js';

const summary=(value:string)=>({materialClaims:[{evidence:[{propositionSummary:value}]}]});
const gallery='<Gallery label="比較" layout="diagrams">\n<Figure asset="walls-a" title="外周2周" />\n</Gallery>';
describe('public metadata Gallery closing-token handling',()=>{
 it('accepts the exact Gallery closing token in compact claim summaries without changing evidence',()=>{
  const value=summary(gallery),before=structuredClone(value);
  expect(()=>assertPublicPublicationMetadata(value)).not.toThrow();
  expect(value).toEqual(before);
 });
 it.each([
  '/home/owner/source.json','C:/Users/owner/source.json','C:\\Users\\owner\\source.json','\\\\server\\private\\source.json',
  '<Gallery source="/home/owner/source.json"></Gallery>',
  '<Gallery> /home/owner/source.json </Gallery>',
  '</Gallery>/home/owner/source.json',
  '</Gallery/private>','</Gallery >','</Other>',
 ])('continues rejecting private or unrecognized locators: %s',(value)=>{
  expect(()=>assertPublicPublicationMetadata(summary(value))).toThrow('EXPORT_PRIVATE_LOCATOR_DENIED');
 });
 it('does not relax unrelated metadata fields',()=>{
  expect(()=>assertPublicPublicationMetadata({title:'</Gallery>'})).toThrow('EXPORT_PRIVATE_LOCATOR_DENIED');
 });
 it.each([['https://example.com/image?token=hidden','EXPORT_SECRET_METADATA_DENIED'],['http://example.com/image','EXPORT_CAPABILITY_OR_UNSAFE_URL_DENIED']])('retains URL checks alongside the Gallery token: %s',(url,code)=>{
  expect(()=>assertPublicPublicationMetadata(summary(gallery+' '+url))).toThrow(code);
 });
});
