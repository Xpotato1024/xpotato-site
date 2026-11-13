import postcss from 'postcss';
// Expand single-selector nesting for assertions on effective selectors. Preserve
// declaration order and at-rule conditions; never discard the tool exclusion.
export function expandedCss(css: string): string {
 const walk=(nodes: postcss.ChildNode[], parents: string[]=[]): string => nodes.map(node=>{
  if(node.type==='rule'){
   const selectors=postcss.list.comma(node.selector).flatMap(selector=>parents.length ? parents.map(parent=>selector.includes('&')?selector.replaceAll('&',parent):parent+' '+selector):[selector]);
   const declarations=node.nodes.filter(child=>child.type==='decl'||(child.type==='atrule'&&!child.nodes)).map(child=>child.toString()+';').join(' ');
   const own=declarations?selectors.join(', ').replace(/,\s*/g,', ')+' { '+declarations+' }\n':'';
   return own+walk(node.nodes.filter(child=>child.type==='rule'||(child.type==='atrule'&&child.nodes)),selectors);
  }
  if(node.type==='atrule'&&node.nodes)return '@'+node.name+' '+node.params+' {\n'+walk(node.nodes,parents)+'}\n';
  return node.toString()+'\n';
 }).join('');
 return walk(postcss.parse(css).nodes);
}
