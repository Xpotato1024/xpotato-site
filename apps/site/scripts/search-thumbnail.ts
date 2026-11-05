import { parseFragment, type DefaultTreeAdapterMap } from 'parse5';
import { searchThumbnailSchema, type SearchDocument } from '@xpotato/content-contracts';
import { articleThumbnailPicture } from '../src/lib/media/article-thumbnail.js';
export const SEARCH_THUMBNAIL_SIZES = '(max-width: 600px) calc(100vw - 2 * clamp(1.25rem, 6vw, 5.5rem)), 144px';
type Element = DefaultTreeAdapterMap['element'];
const attrs = (node: Element) => Object.fromEntries(node.attrs.map(item => [item.name,item.value]));

/** Read the validated shared renderer, rather than inventing a second image policy. */
export function thumbnailFromPicture(html: string) {
  const picture = parseFragment(html).childNodes.find(node => 'tagName' in node && node.tagName === 'picture') as Element | undefined;
  const image = picture?.childNodes.find(node => 'tagName' in node && node.tagName === 'img') as Element | undefined;
  if (!picture || !image) throw new Error('SEARCH_THUMBNAIL_PICTURE_REQUIRED');
  const imageAttrs=attrs(image);
  const sources=picture.childNodes.filter(node=>'tagName' in node && node.tagName==='source').map(node=>{
    const source=attrs(node as Element);
    return {type:source.type,candidates:(source.srcset ?? '').split(',').map(item=>{
      const match=/^(\S+)\s+(\d+)w$/u.exec(item.trim());
      if(!match)throw new Error('SEARCH_THUMBNAIL_SRCSET_INVALID');
      return {src:match[1],width:Number(match[2])};
    })};
  });
  return searchThumbnailSchema.parse({src:imageAttrs.src,width:Number(imageAttrs.width),height:Number(imageAttrs.height),sources});
}
export function withSearchThumbnail(document: SearchDocument): SearchDocument {
  if(document.collection!=='blog')return document;
  const picture=articleThumbnailPicture(document.id,SEARCH_THUMBNAIL_SIZES);
  return picture ? {...document,thumbnail:thumbnailFromPicture(picture)} : document;
}
