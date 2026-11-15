import {SaxesParser} from 'saxes';
import {fromHtml} from 'hast-util-from-html';
import {sanitizeSvg} from '../../../packages/media-ingest/src/svg-sanitizer.mjs';
import {limits} from './inputs.mjs';

const tags = new Set(['svg','g','defs','marker','path','rect','circle','ellipse','line','polyline','polygon','text','tspan','title','desc','clipPath','linearGradient','radialGradient','stop']);
const attributes = new Set(['xmlns','xmlnsXLink','id','className','viewBox','width','height','x','y','x1','y1','x2','y2','cx','cy','r','rx','ry','d','points',
  'transform','fill','stroke','strokeWidth','strokeDasharray','strokeDashArray','strokeDashoffset','strokeDashOffset','strokeLinecap','strokeLineCap','strokeLinejoin','strokeLineJoin','strokeMiterLimit','fillOpacity','strokeOpacity','opacity','fillRule','clipRule',
  'fontFamily','fontSize','fontWeight','fontStyle','textAnchor','dominantBaseline','alignmentBaseline','dx','dy','lengthAdjust','textLength',
  'markerStart','markerMid','markerEnd','markerWidth','markerHeight','markerUnits','refX','refY','orient','clipPath','clipPathUnits',
  'gradientUnits','gradientTransform','offset','stopColor','stopOpacity','role','ariaLabel','ariaLabelledBy','ariaDescribedBy','ariaRoleDescription','ariaHidden','focusable','version','preserveAspectRatio','pointerEvents','display']);

/** Renderer-local fail-closed checks. The global sanitizer and CSP are unchanged. */
export function staticSvg(source) {
  if (Buffer.byteLength(source) > limits.svgBytes || /<!|<\?|\\|\b(?:file|https?|data|javascript):/iu.test(source.replaceAll('http://www.w3.org/2000/svg','').replaceAll('http://www.w3.org/1999/xlink','')))
    throw Error('SVG declarations, paths or external resources are forbidden');
  const parser=new SaxesParser({xmlns:true});let depth=0,roots=0,xmlNodes=0;
  const invalid=()=>{throw Error('SVG must be well-formed namespace-safe XML');};
  parser.on('error',invalid);parser.on('doctype',invalid);parser.on('processinginstruction',invalid);parser.on('xmldecl',invalid);parser.on('cdata',invalid);
  parser.on('opentag',tag=>{if(tag.uri!=='http://www.w3.org/2000/svg'||++xmlNodes>limits.svgNodes||depth>=64)invalid();if(depth++===0){roots++;if(tag.local!=='svg')invalid();}});
  parser.on('closetag',()=>depth--);parser.write(source).close();if(roots!==1||depth!==0)invalid();
  const svg = sanitizeSvg(source), tree = fromHtml(svg, {fragment:true});
  tree.children=tree.children.filter(node=>node.type!=='text'||node.value.trim());
  if (tree.children.length !== 1 || tree.children[0].tagName !== 'svg') throw Error('Exactly one SVG root required');
  let count = 0;
  const walk = node => {
    if (++count > limits.svgNodes) throw Error('SVG node budget exceeded');
    if (node.type === 'element') {
      if (!tags.has(node.tagName)) throw Error('Unsupported static SVG element: ' + node.tagName);
      for (const [key, value] of Object.entries(node.properties ?? {})) {
        if (!attributes.has(key)) throw Error('Unsupported SVG attribute: ' + key);
        const text = String(value);
        if (key === 'xmlns' || key === 'xmlnsXLink') {
          if (!['http://www.w3.org/2000/svg','http://www.w3.org/1999/xlink'].includes(text)) throw Error('Unexpected SVG namespace');
        } else if (/[:\\@]|\/\/|[\u0000-\u001f]/u.test(text) || /url\(/iu.test(text) && !/^url\(#[A-Za-z][\w.-]*\)$/u.test(text)) {
          // Text labels are nodes, never path/URL-bearing attributes.
          if (!['ariaLabel','ariaRoledescription','ariaDescribedBy','ariaLabelledBy'].includes(key)) throw Error('Unsafe SVG attribute value: ' + key);
        }
      }
    } else if (node.type !== 'text') throw Error('Unexpected SVG node');
    for (const child of node.children ?? []) walk(child);
  };
  walk(tree.children[0]);
  const box = String(tree.children[0].properties.viewBox ?? '').trim().split(/[ ,]+/u).map(Number);
  if (box.length !== 4 || !box.every(Number.isFinite) || box[2] <= 0 || box[3] <= 0 || box[2] > limits.dimension || box[3] > limits.dimension || box[2]*box[3] > limits.pixels) throw Error('SVG dimension budget exceeded');
  return {svg, width:Math.ceil(box[2]), height:Math.ceil(box[3]), nodeCount:count};
}
