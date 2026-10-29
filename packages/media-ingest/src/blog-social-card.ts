import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {contentIdSchema} from '@xpotato/content-contracts';
import {layoutSocialTitle,validateSocialTitleLines} from '@xpotato/content-contracts/social-title-layout';
import {fingerprint,sha256} from '@xpotato/content-contracts/canonical';
import {bundledOutlineFont,escapeSvgText} from './bundled-outline-font.js';
import {sharpToolchainSha256} from './sharp-runtime.js';

// Selected C. Hero and legacy migration templates are deliberately separate profiles.
export const blogSocialCardProfile=Object.freeze({
 id:'xpotato-blog-social-c-v1',width:1200,height:630,outlineOnly:true,fontkit:'2.0.4',shapingNormalization:'NFC',
 colors:Object.freeze({paper:'#faf9f7',ink:'#15141d',accent:'#745399',muted:'#625e6e',border:'#d8d4dc'}),
 title:Object.freeze({x:330,top:203,width:540,height:291,lineHeight:1.25,minSize:48,maxSize:54,maxLines:4}),
 category:Object.freeze({baseline:171,size:22,width:540}),
 brand:Object.freeze({top:71,logoWidth:68,logoHeight:48,gap:16,size:28,baseline:107}),
 footer:Object.freeze({text:'技術とものづくりの記録',size:20,tracking:1.6,baseline:571,dividerY:506}),
 logoSha256:'2077b22f57d03199fd709df1d317704cd90ab9477dc1d3fd997d9c44aacc1e69',
});
export interface BlogSocialCardInput {
 repositoryRoot:string;contentId:string;title:string;categoryLabel:string;cardDisplay?:{lines?:readonly string[]|undefined}|undefined;
}
export const blogSocialCardAlt=(title:string)=>title+' | Xpotato.net';
export async function deterministicBlogSocialCard(input:BlogSocialCardInput){
 const {repositoryRoot,title,categoryLabel,cardDisplay}=input,contentId=contentIdSchema.parse(input.contentId);
 if(cardDisplay!==undefined&&(!cardDisplay||Array.isArray(cardDisplay)||typeof cardDisplay!=='object'||Object.keys(cardDisplay).some(k=>k!=='lines')))throw Error('CARD_DISPLAY_INVALID');
 validateSocialTitleLines(title,cardDisplay?.lines);
 if(typeof categoryLabel!=='string'||!categoryLabel.trim()||categoryLabel!==categoryLabel.trim()
  ||/[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/u.test(categoryLabel)||[...new Intl.Segmenter('ja',{granularity:'grapheme'}).segment(categoryLabel)].length>60)throw Error('CARD_CATEGORY_INVALID');
 const serif=bundledOutlineFont(repositoryRoot,{family:'Noto Serif JP',weight:400});
 const zen=bundledOutlineFont(repositoryRoot,{family:'Zen Kaku Gothic New',weight:500});
 const footer=bundledOutlineFont(repositoryRoot,{family:'Zen Kaku Gothic New',weight:400});
 const profile=blogSocialCardProfile,c=profile.colors;
 const {width,height,lineHeight,minSize,maxSize,maxLines}=profile.title;
 const layout=layoutSocialTitle(title,{width,height,lineHeight,minSize,maxSize,maxLines,lines:cardDisplay?.lines},serif.shapedWidth);
 const categoryWidth=zen.shapedWidth(categoryLabel,profile.category.size);
 if(categoryWidth>profile.category.width)throw Error('CARD_CATEGORY_CANNOT_FIT');
 const labelBounds=zen.inkBounds(categoryLabel,profile.category.size);
 if(profile.category.baseline+labelBounds.maxY>profile.title.top-12)throw Error('CARD_CATEGORY_CANNOT_FIT');
 const logo=(await readFile(join(repositoryRoot,'apps/site/public/xpotato-logo.svg'),'utf8')).replace(/\r\n?/gu,'\n');
 if(sha256(logo)!==profile.logoSha256)throw Error('CARD_LOGO_CHANGED_REVIEW_REQUIRED');
 const logoPaths=logo.match(/<path\b[^>]*\/>/gu);
 if(!logoPaths?.length)throw Error('CARD_LOGO_INVALID');
 const brandText='Xpotato.net',brandWidth=zen.shapedWidth(brandText,profile.brand.size),brandX=(1200-(68+16+brandWidth))/2;
 const base=serif.baseline(layout.lines[0]!,layout.fontSize,layout.lineHeight);
 const positions=layout.lines.map((text,index)=>{
  const ink=serif.inkBounds(text,layout.fontSize),x=600-ink.width/2,y=profile.title.top+base+index*layout.fontSize*layout.lineHeight;
  if(x+ink.minX<profile.title.x||x+ink.maxX>profile.title.x+profile.title.width
   ||y+ink.minY<profile.title.top-1||y+ink.maxY>profile.footer.dividerY-12)throw Error('CARD_TITLE_INK_CANNOT_FIT');
  return {text,x,y,ink};
 });
 // CSS letter-spacing includes the trailing spacing in the centered footer box.
 const footerChars=Array.from(profile.footer.text),footerWidth=footer.shapedWidth(profile.footer.text,20)+footerChars.length*profile.footer.tracking;
 let footerX=(1200-footerWidth)/2;
 const footerPaths=footerChars.map(char=>{const path=footer.shapedPaths(char,footerX,profile.footer.baseline,20,c.muted);footerX+=footer.shapedWidth(char,20)+profile.footer.tracking;return path;}).join('');
 const art='<rect width="1200" height="630" fill="'+c.paper+'"/>'
  +'<rect x=".5" y=".5" width="1199" height="629" fill="none" stroke="'+c.border+'"/>'
  +'<path d="M0 0H1200V22H0ZM0 608H1200V630H0Z" fill="'+c.accent+'"/>'
  +'<svg x="'+brandX+'" y="71" width="68" height="48" viewBox="370 440 553.5 375">'+logoPaths.join('')+'</svg>'
  +zen.shapedPaths(brandText,brandX+84,107,28,c.ink)
  +zen.shapedPaths(categoryLabel,(1200-categoryWidth)/2,171,22,c.accent)
  +positions.map(p=>serif.shapedPaths(p.text,p.x,p.y,layout.fontSize,c.ink)).join('')
  +'<rect x="560" y="506" width="80" height="3" fill="'+c.accent+'"/>'+footerPaths;
 const alt=blogSocialCardAlt(title);
 const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img"><title>'+escapeSvgText(alt)+'</title>'+art+'</svg>\n');
 const binding={profileId:profile.id,profileSha256:fingerprint(profile),contentId,titleSha256:sha256(title),categoryLabel,
  cardDisplay:cardDisplay??null,layout,positions,fonts:{title:serif.binding,brand:zen.binding,footer:footer.binding},logoSha256:sha256(logo),
  implementationSha256:sha256(await readFile(new URL('./blog-social-card.ts',import.meta.url))),
  fontImplementationSha256:sha256(await readFile(new URL('./bundled-outline-font.ts',import.meta.url))),
  layoutImplementationSha256:sha256(await readFile(new URL('../../content-contracts/src/social-title-layout.mjs',import.meta.url))),
  toolchain:{node:process.versions.node,icu:process.versions.icu,unicode:process.versions.unicode,fontkit:profile.fontkit,sharp:sharpToolchainSha256()}};
 return {svg,alt,binding,derivationSha256:fingerprint(binding)};
}
