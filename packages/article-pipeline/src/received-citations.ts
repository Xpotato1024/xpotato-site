import type {LocalEvidenceBundle,SourceRecord} from '@xpotato/content-contracts';
import {compileArticleCitations,walkReview} from '@xpotato/portable-content/review';
import {fingerprint,sha256} from './canonical.js';
import {fail} from './private-files.js';
/** Existing numeric markers are input, not invented Source IDs. Pin every
 * conversion to an original UTF-16 span and reuse the normal citation compiler.
 * The original body and material-claim span identities remain unchanged. */
export function compileReceivedCitations(body:string,sources:SourceRecord[],markers:NonNullable<LocalEvidenceBundle['receivedCitationMarkers']>):ReturnType<typeof compileArticleCitations>{
 const original=compileArticleCitations(body,sources);
 if(original.patches.length)fail('RECEIVED_CITATION_FORMATS_MIXED');
 const ordered=[...markers].sort((a,b)=>a.start-b.start);
 let end=0,normalized=body;
 for(const marker of ordered){
  if(marker.start<end||marker.end<=marker.start||marker.end>body.length
   ||!/^\[\d+\]$/u.test(body.slice(marker.start,marker.end))||new Set(marker.sourceIds).size!==marker.sourceIds.length)fail('RECEIVED_CITATION_SPAN_INVALID');
  // Only paragraph text is supported; code, raw HTML, links and definitions
  // must not become citation authority through an arbitrary numeric substring.
  let paragraph=false;
  walkReview(original.tree,(n,parents)=>{
   if(n.type==='text'&&marker.start>=(n.position?.start.offset??Infinity)&&marker.end<=(n.position?.end.offset??-1)
    &&parents.some(p=>p.type==='paragraph')&&!parents.some(p=>['link','linkReference','footnoteDefinition','heading','tableCell'].includes(p.type)))paragraph=true;
  });
  if(!paragraph)fail('RECEIVED_CITATION_LOCATION_DENIED');
  end=marker.end;
 }
 for(const marker of [...ordered].reverse())normalized=normalized.slice(0,marker.start)+'[@'+marker.sourceIds.join(' @')+']'+normalized.slice(marker.end);
 const compiled=compileArticleCitations(normalized,sources);
 const manifest={...compiled.manifest,bodySha256:sha256(body)};
 return {...compiled,tree:original.tree,patches:ordered.map(m=>({...m,text:'[@'+m.sourceIds.join(' @')+']'})),manifest,
  compilationSha256:fingerprint({profile:'received-numeric-citations-v1',markers:ordered,manifest})};
}
