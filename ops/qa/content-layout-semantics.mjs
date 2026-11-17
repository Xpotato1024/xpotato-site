import {parse} from 'parse5';
const rawText=node=>'value'in node?node.value:'childNodes'in node?node.childNodes.map(rawText).join(''):'';
// Bundler identifiers and inline hydration CSS are not visible article content.
// Runtime graphs, CSP and CSS are verified by the separate release validators.
const text=node=>('tagName'in node&&['script','style','template'].includes(node.tagName)?'':'value'in node?node.value:'childNodes'in node?node.childNodes.map(text).join(''):'').replace(/\s+/gu,' ').trim();
export function semanticPage(html,{sourceRevision}={}){
 if(sourceRevision!==undefined&&!/^[a-f0-9]{40}$/u.test(sourceRevision))throw Error("PARITY_SOURCE_REVISION_INVALID");
 const sourceHref=href=>{if(!sourceRevision)return href;const base="https://github.com/Xpotato1024/xpotato-site/";for(const [actual,normalized] of [[base+"tree/"+sourceRevision,base+"tree/$BUILD"],[base+"blob/"+sourceRevision+"/apps/site/licenses/prime-factorizer/SOURCE_OFFER.md",base+"blob/$BUILD/apps/site/licenses/prime-factorizer/SOURCE_OFFER.md"],[base+"archive/"+sourceRevision+".zip",base+"archive/$BUILD.zip"]])if(href===actual)return normalized;return href;};const result={titles:[],metadata:[],canonicals:[],headings:[],links:[],media:[],structuredData:[],main:[]};
 const walk=(node,inFooter=false)=>{inFooter=inFooter||('tagName'in node&&node.tagName==='footer');if('tagName'in node){const attr=name=>node.attrs.find(a=>a.name===name)?.value;
 if(node.tagName==='title')result.titles.push(text(node));
 if(node.tagName==='meta'&&(attr('name')||attr('property'))&&!/revision|build/u.test(attr('name')??''))result.metadata.push([attr('name')??attr('property'),attr('content')]);
 if(node.tagName==='link'&&attr('rel')==='canonical')result.canonicals.push(attr('href'));
 if(/^h[1-6]$/u.test(node.tagName))result.headings.push([node.tagName,attr('id')??'',text(node)]);
 if(node.tagName==='a'){const href=attr('href')??'';result.links.push(inFooter&&/^https:\/\/github\.com\/Xpotato1024\/xpotato-site\/commit\/[a-f0-9]{40}$/u.test(href)?['generated-site-revision', 'generated-site-revision']:[sourceHref(href),text(node)]);}
 if(['img','source'].includes(node.tagName)){const ref=attr('srcset')??attr('src')??'';if(/assets\.xpotato\.net|\/images\/|\/media\//u.test(ref))result.media.push([ref,attr('alt')??'',attr('width')??'',attr('height')??'']);}
 if(node.tagName==='script'&&attr('type')==='application/ld+json')result.structuredData.push(JSON.parse(rawText(node)));
 if(node.tagName==='main')result.main.push(text(node));
 }if('childNodes'in node)for(const child of node.childNodes)walk(child,inFooter);};walk(parse(html));return result;}
