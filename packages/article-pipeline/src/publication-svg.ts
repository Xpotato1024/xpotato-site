import {SaxesParser} from 'saxes';

const namespace='http://www.w3.org/2000/svg';
const elements=new Set(['svg','g','path','rect','circle','ellipse','line','polyline','polygon','text','tspan','title','desc','defs','clipPath','linearGradient','radialGradient','stop']);
const attributes=new Set(['id','role','aria-label','aria-labelledby','aria-hidden','focusable','viewBox','preserveAspectRatio','width','height','x','y','x1','y1','x2','y2',
 'cx','cy','r','rx','ry','d','points','transform','fill','fill-opacity','fill-rule','stroke','stroke-width','stroke-opacity','stroke-linecap','stroke-linejoin','stroke-miterlimit',
 'stroke-dasharray','stroke-dashoffset','opacity','color','font-family','font-size','font-weight','font-style','text-anchor','dominant-baseline','letter-spacing',
 'offset','stop-color','stop-opacity','gradientUnits','gradientTransform','spreadMethod','clip-path','clip-rule','clipPathUnits','vector-effect','shape-rendering']);

/** A namespace-aware static SVG subset. No CSS/SMIL/script/image/use/foreign
 * elements, external resources, entity expansion or browser active content.
 * Sharp decoding below is an independent image-validity check. */
export function assertStaticPublicationSvg(source:string){
 const deny=()=>{throw Error('CI_PUBLICATION_ACTIVE_SVG_DENIED');};
 if(source.length>24*1024*1024)deny();
 const parser=new SaxesParser({xmlns:true});let depth=0,roots=0;
 parser.on('error',deny);parser.on('doctype',deny);parser.on('processinginstruction',deny);parser.on('xmldecl',deny);parser.on('cdata',deny);
 parser.on('opentag',tag=>{
  if(tag.uri!==namespace||!elements.has(tag.local)||depth===0&&tag.local!=='svg')deny();
  if(depth++===0)roots++;
  for(const attribute of Object.values(tag.attributes)){
   if(attribute.uri==='http://www.w3.org/2000/xmlns/'){
    if(attribute.value!==namespace)deny();continue;
   }
   if(attribute.uri||!attributes.has(attribute.local))deny();
   const value=attribute.value;
   if(/[\\\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)||/url\(/iu.test(value)&&!/^url\(#[A-Za-z_][A-Za-z0-9_.-]*\)$/u.test(value.trim()))deny();
  }
 });
 parser.on('closetag',()=>{depth--;});
 parser.write(source).close();if(roots!==1||depth!==0)deny();
}
