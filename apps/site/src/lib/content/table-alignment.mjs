/** Preserve GFM cell alignment without JSX turning legacy align attributes into inline styles. */
export function rehypeTableAlignment() {
  return tree => {
    const visit = node => {
      if (node.type === 'element' && (node.tagName === 'th' || node.tagName === 'td')) {
        const align = node.properties?.align;
        if (align === 'left' || align === 'center' || align === 'right') {
          delete node.properties.align;
          node.properties.dataCellAlign = align;
        }
      }
      for (const child of node.children ?? []) visit(child);
    };
    visit(tree);
  };
}
