/** Replace only the generated return glyph, preserving GFM targets, labels and repeat counts. */
export function rehypeFootnoteBacklinks() {
  return tree => {
    const visit = node => {
      if (node.type === 'element' && node.tagName === 'a' &&
          Object.hasOwn(node.properties ?? {}, 'dataFootnoteBackref')) {
        node.children = node.children.flatMap(child => {
          if (child.type !== 'text' || !/↩[\uFE0E\uFE0F]?/u.test(child.value)) return [child];
          return child.value.split(/(↩[\uFE0E\uFE0F]?)/u).filter(Boolean).map(value =>
            /^↩[\uFE0E\uFE0F]?$/u.test(value) ? {
              type: 'element', tagName: 'svg',
              properties: {
                className: ['footnote-backref-icon'], xmlns: 'http://www.w3.org/2000/svg',
                viewBox: '0 0 24 24', width: 16, height: 16, fill: 'none',
                stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
                ariaHidden: 'true', focusable: 'false',
              },
              children: [{type: 'element', tagName: 'path', properties: {d: 'm9 5-5 5 5 5M4 10h11a5 5 0 0 1 0 10h-3'}, children: []}],
            } : {type: 'text', value});
        });
      }
      for (const child of node.children ?? []) visit(child);
    };
    visit(tree);
  };
}
