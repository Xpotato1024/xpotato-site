import { parseFragment, serialize, type DefaultTreeAdapterMap } from 'parse5';
import type { ContentHeading } from './table-of-contents.js';
/** Transform only selected long-form headings, using the HTML parser rather than string injection. */
export const addSectionLinks = (html: string, headings: readonly ContentHeading[]): string => {
  if (!headings.length) return html;
  const names = new Map(headings.map(h=>[h.slug,h.text]));
  const tree=parseFragment(html);
  const visit=(node:DefaultTreeAdapterMap['node']) => {
    if ('tagName' in node && ['h2','h3'].includes(node.tagName)) {
      const id=node.attrs.find(a=>a.name==='id')?.value;
      if(id && names.has(id)) {
        const anchor=parseFragment('<a class="section-anchor"><span aria-hidden="true">#</span></a>').childNodes[0] as DefaultTreeAdapterMap['element'];
        anchor.attrs.push({name:'href',value:'#'+encodeURIComponent(id)},{name:'aria-label',value:'# '+names.get(id)+'の節リンク'});
        anchor.parentNode=node; node.childNodes.push(anchor);
      }
    }
    if('childNodes' in node) for(const child of node.childNodes) visit(child);
  };
  visit(tree); return serialize(tree);
};
