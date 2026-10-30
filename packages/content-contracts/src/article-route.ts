import {contentIdSchema} from './common.js';

/** Fixed lowercase Crockford alphabet. No aliases or truncation; all UUID bits
 * survive the encoding. The first character holds only three significant bits.
 */
const alphabet='0123456789abcdefghjkmnpqrstvwxyz';
export const ARTICLES_ROOT='/articles/' as const;
export function articleUrlId(contentId:string):string {
 contentIdSchema.parse(contentId);
 let value=BigInt('0x'+contentId.replaceAll('-','')),out='';
 for(let i=0;i<26;i++){out=alphabet[Number(value&31n)]+out;value>>=5n;}
 return out;
}
export function articleContentId(urlId:string):string {
 if(!/^[0-7][0-9abcdefghjkmnpqrstvwxyz]{25}$/u.test(urlId))throw Error('ARTICLE_URL_ID_INVALID');
 let value=0n;for(const c of urlId)value=(value<<5n)|BigInt(alphabet.indexOf(c));
 const h=value.toString(16).padStart(32,'0');
 const id=[h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');
 contentIdSchema.parse(id);
 if(articleUrlId(id)!==urlId)throw Error('ARTICLE_URL_ID_NONCANONICAL');
 return id;
}
export const articleRoute=(contentId:string):string=>ARTICLES_ROOT+articleUrlId(contentId)+'/';
export function assertArticleRoute(route:string,contentId:string):void {
 if(route!==articleRoute(contentId))throw Error('ARTICLE_ROUTE_CONTENT_ID_MISMATCH');
}
