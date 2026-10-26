import {stop} from './manual-deployment-provider.mjs';
// 本人承認済みの旧Git工作台写真1枚。一般raster許可へ広げない。
// source SHA256: 1daf2c4eb0519c2f04bec3a549b9f1711d9be1f1ca572d73c6352ea975fb00ca
import {homeWorkshopPublicObjects} from './home-workshop-public-objects.mjs';
export {homeWorkshopPublicObjects};
const approved=new Map(homeWorkshopPublicObjects.map(row=>[row.path,row]));
// Accepted shared UI control, not a general media or raster permission.
export const shareControlPublicObjects=Object.freeze([
  Object.freeze({path:'/icon-share-line.png',bytes:22239,sha256:'5e93437eb5ec0dcdece92d1562fcd435d1d521cca5c013d2d9e15b544a1d8a39'}),
]);
const controls=new Map(shareControlPublicObjects.map(row=>[row.path,row]));
export function assertShareControlPublicObject(row) {
  const expected=row&&controls.get(row.path);
  if(!expected||Object.keys(row).sort().join('|')!=='bytes|path|sha256'
    ||row.bytes!==expected.bytes||row.sha256!==expected.sha256)stop('UNAPPROVED_RASTER');
  return expected;
}
export function assertHomeWorkshopPublicObject(row) {
  const expected=row&&approved.get(row.path);
  if(!expected||Object.keys(row).sort().join('|')!=='bytes|path|sha256'
    ||row.bytes!==expected.bytes||row.sha256!==expected.sha256)stop('UNAPPROVED_RASTER');
  return expected;
}
export function assertHomeWorkshopPublicObjects(rows) {
  if(!Array.isArray(rows)||rows.length!==13||new Set(rows.map(row=>row?.path)).size!==13)stop('HOME_WORKSHOP_PHOTO_SET');
  for(const row of rows)assertHomeWorkshopPublicObject(row);
  return homeWorkshopPublicObjects;
}
export function isRasterBytes(bytes) {
  const hex=bytes.subarray(0,12).toString('hex'),brand=bytes.subarray(8,12).toString('ascii');
  return hex.startsWith('ffd8ff')||hex.startsWith('89504e470d0a1a0a')
    ||hex.startsWith('474946383761')||hex.startsWith('474946383961')||hex.startsWith('424d')
    ||hex.startsWith('49492a00')||hex.startsWith('4d4d002a')||hex.startsWith('49492b00')||hex.startsWith('4d4d002b')
    ||hex.startsWith('ff0a')||hex.startsWith('0000000c4a584c200d0a870a')
    ||bytes.subarray(0,4).toString('ascii')==='RIFF'&&brand==='WEBP'
    ||bytes.subarray(4,8).toString('ascii')==='ftyp'&&['avif','avis','heic','heix','hevc','hevx','mif1','msf1','heim','heis'].includes(brand);
}
export function assertHomeWorkshopImageReferences(text,route,assets,hostname) {
  const origin='https://'+hostname;
  const image=(value,css=false)=>{
    if(/^data:image\/svg\+xml[;,]/i.test(value))return;
    let url;try{url=new URL(value,origin+route);}catch{stop('UNAPPROVED_IMAGE_REFERENCE');}
    const control=controls.get(url.pathname),asset=assets.get(url.pathname);
    if(value.includes('\\')||url.origin!==origin||url.search||url.hash||!(approved.has(url.pathname)||control&&asset?.bytes===control.bytes&&asset.sha256===control.sha256||(css?/\.(svg|woff2?|ico)$/i.test(url.pathname):url.pathname.endsWith('.svg'))&&assets.has(url.pathname))
      ||(approved.has(url.pathname)||control)&&value!==url.pathname&&value!==origin+url.pathname)stop('UNAPPROVED_IMAGE_REFERENCE');
  };
  for(const [tag] of text.matchAll(/<(?:img|source)\b[^>]*>/gi)) {
    for(const [,attribute,double,single,bare] of tag.matchAll(/\b(src|srcset)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
      const value=double??single??bare;
      if(attribute.toLowerCase()==='src')image(value);
      else for(const entry of value.split(','))image(entry.trim().split(/\s+/)[0]);
    }
  }
  const styles=/\.css$/i.test(route)?[text]:[
    ...Array.from(text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi),m=>m[1]),
    ...Array.from(text.matchAll(/\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi),m=>m[1]??m[2]??m[3]),
  ];
  for(const css of styles) {
    if(/\b(?:-webkit-)?image-set\s*\(/i.test(css))stop('UNAPPROVED_IMAGE_REFERENCE');
    for(const [,raw] of css.matchAll(/url\(\s*([^)]+)\)/gi)) {
      const value=raw.trim().replace(/^["']|["']$/g,'');
      image(value,true);
    }
  }
}
