import type { SearchDocument } from '@xpotato/content-contracts';
type Thumbnail = NonNullable<SearchDocument['thumbnail']>;
const safeUrl = (value: unknown) => {
  if(typeof value!=='string')return false;
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash;}catch{return false;}
};
const positive=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0;
function validThumbnail(value: unknown): value is Thumbnail {
  if(!value||typeof value!=='object')return false;
  const image=value as Thumbnail;
  return safeUrl(image.src)&&positive(image.width)&&positive(image.height)&&Array.isArray(image.sources)&&image.sources.length<=4&&image.sources.every(source=>
    source && typeof source==='object' && ['image/avif','image/webp','image/jpeg','image/png'].includes(source.type)&&Array.isArray(source.candidates)&&source.candidates.length>0&&source.candidates.length<=32&&source.candidates.every(candidate=>candidate && typeof candidate==='object' && safeUrl(candidate.src)&&positive(candidate.width)));
}
type Result = {id:unknown;route?:unknown;title?:unknown;description?:unknown;collection?:unknown;thumbnail?:unknown};
export function renderSearchResult(document: Document, match: Result): HTMLLIElement {
  const item=document.createElement('li'),link=document.createElement('a'),copy=document.createElement('div'),title=document.createElement('h2'),description=document.createElement('p');
  link.className='search-result-link';link.href=String(match.route);
  title.className='search-result-title';title.textContent=String(match.title);
  description.textContent=String(match.description);copy.append(title,description);
  if(match.collection==='blog'&&validThumbnail(match.thumbnail)){
    const data=match.thumbnail,box=document.createElement('div'),picture=document.createElement('picture'),img=document.createElement('img');
    box.className='search-result-thumbnail';box.setAttribute('aria-hidden','true');link.classList.add('has-thumbnail');
    for(const entry of data.sources){const source=document.createElement('source');source.type=entry.type;source.srcset=entry.candidates.map(candidate=>candidate.src+' '+candidate.width+'w').join(', ');source.sizes='(max-width: 600px) calc(100vw - 2 * clamp(1.25rem, 6vw, 5.5rem)), 144px';picture.append(source);}
    img.alt='';img.width=data.width;img.height=data.height;img.loading='lazy';img.decoding='async';
    img.addEventListener('error',()=>box.replaceChildren(document.createTextNode('画像なし')),{once:true});
    img.src=data.src;picture.append(img);box.append(picture);link.append(box);
  }
  link.append(copy);item.append(link);return item;
}
