import {stop} from './manual-deployment-provider.mjs';
// 本人承認済みの旧Git工作台写真1枚。一般raster許可へ広げない。
// source SHA256: 1daf2c4eb0519c2f04bec3a549b9f1711d9be1f1ca572d73c6352ea975fb00ca
export const homeWorkshopPublicObjects=Object.freeze([
  Object.freeze({"path":"/media/v1/objects/sha256/19/1998c41e9ecbe6f50abffec04fee309fbd718e118dbedd7117ee9ba1cc9acd04.jpg","bytes":812340,"sha256":"1998c41e9ecbe6f50abffec04fee309fbd718e118dbedd7117ee9ba1cc9acd04"}),
  Object.freeze({"path":"/media/v1/objects/sha256/a7/a79f47cd6a97e516e5ae3a8c88c8ba9a1345360774c93b180d21c837d3e7d3fb.avif","bytes":28724,"sha256":"a79f47cd6a97e516e5ae3a8c88c8ba9a1345360774c93b180d21c837d3e7d3fb"}),
  Object.freeze({"path":"/media/v1/objects/sha256/aa/aa27a45b7cda1a998b1df61ef2692a7ed867a9a5eb8f5b280aa3d1e88f275ed0.webp","bytes":52146,"sha256":"aa27a45b7cda1a998b1df61ef2692a7ed867a9a5eb8f5b280aa3d1e88f275ed0"}),
  Object.freeze({"path":"/media/v1/objects/sha256/65/65432636094adc4a06f0412a88cf31f249491243e2f9a019420f22783c50791a.jpg","bytes":72001,"sha256":"65432636094adc4a06f0412a88cf31f249491243e2f9a019420f22783c50791a"}),
  Object.freeze({"path":"/media/v1/objects/sha256/63/633d3dbf49668c8377bceb81403f9fea371c1865611a4d934a24ee123f8f3e28.avif","bytes":56525,"sha256":"633d3dbf49668c8377bceb81403f9fea371c1865611a4d934a24ee123f8f3e28"}),
  Object.freeze({"path":"/media/v1/objects/sha256/84/84c6aa1b4c81fb29f7ce559f379ba1f35bc25e2ea6e5bdf27e3094e7fbfccc66.webp","bytes":102086,"sha256":"84c6aa1b4c81fb29f7ce559f379ba1f35bc25e2ea6e5bdf27e3094e7fbfccc66"}),
  Object.freeze({"path":"/media/v1/objects/sha256/b8/b80cec96eef9cb5eef07b27be9f3eb68d945e258bcf0d9a8712f5752f1914643.jpg","bytes":144940,"sha256":"b80cec96eef9cb5eef07b27be9f3eb68d945e258bcf0d9a8712f5752f1914643"}),
  Object.freeze({"path":"/media/v1/objects/sha256/e9/e9563490c9d3a901937330636b429d8a90fae5ede6f66cd717d913ff189b4dfb.avif","bytes":110418,"sha256":"e9563490c9d3a901937330636b429d8a90fae5ede6f66cd717d913ff189b4dfb"}),
  Object.freeze({"path":"/media/v1/objects/sha256/c3/c3999902fb94d183128def9b72eb59f19ffad9fb4a011713cd39a81fb12e938d.webp","bytes":197262,"sha256":"c3999902fb94d183128def9b72eb59f19ffad9fb4a011713cd39a81fb12e938d"}),
  Object.freeze({"path":"/media/v1/objects/sha256/88/888dacb7d0a0be727279d7134b1eadd40f4b03d1141fc4c40c65e864e1c652bd.jpg","bytes":289253,"sha256":"888dacb7d0a0be727279d7134b1eadd40f4b03d1141fc4c40c65e864e1c652bd"}),
  Object.freeze({"path":"/media/v1/objects/sha256/c4/c48d2217b96b9db0d1e12133273ce0b7971ec23f1be30ddf8459dace7cbb6763.avif","bytes":177423,"sha256":"c48d2217b96b9db0d1e12133273ce0b7971ec23f1be30ddf8459dace7cbb6763"}),
  Object.freeze({"path":"/media/v1/objects/sha256/9a/9a3e33e2197fbd15ab1e8a3148861659f2b9ae54b032dcda7a71c3dbad477796.webp","bytes":299286,"sha256":"9a3e33e2197fbd15ab1e8a3148861659f2b9ae54b032dcda7a71c3dbad477796"}),
  Object.freeze({"path":"/media/v1/objects/sha256/00/008c0933767e9a4cb31ebacfb53dba65c0c913cb694dff5063c22f4ce396681a.jpg","bytes":461959,"sha256":"008c0933767e9a4cb31ebacfb53dba65c0c913cb694dff5063c22f4ce396681a"}),
]);
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
