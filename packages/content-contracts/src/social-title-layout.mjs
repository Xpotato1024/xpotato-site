// Display-only layout. This module never edits content metadata or returns an HTML input surface.
const opening = new Set(Array.from('（［｛「『【〈《‘“([{'));
const closing = new Set(Array.from('、。，．・！？：；）］｝」』】〉》’”)]},.!?:;%％ー々ぁぃぅぇぉっゃゅょァィゥェォッャュョ'));
const weakStarts = new Set(['の','を','に','が','は','で','と','へ','も','や','て','率','数','量','性','化','版','用','型']);
const words = new Intl.Segmenter('ja', {granularity:'word'});
const graphemes = new Intl.Segmenter('ja', {granularity:'grapheme'});
const fail = code => { throw new Error(code); };
function titleInput(title) {
  if(typeof title!=='string'||!title.trim()||/[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/u.test(title))fail('CARD_TITLE_INVALID');
  if([...graphemes.segment(title)].length>180)fail('CARD_TITLE_TOO_LONG');
}
function latinRanges(title) {
  return [...title.matchAll(/[A-Za-z0-9][A-Za-z0-9._+:/#%=-]*/gu)].map(m=>[m.index,m.index+m[0].length]);
}
function legalEdge(line) {
  const dotIdentifier=/^\.[A-Za-z0-9]/u.test(line);
  return !opening.has(Array.from(line).at(-1))&&(!closing.has(Array.from(line)[0])||dotIdentifier);
}
function checkedLines(title,lines,maxLines) {
  if(!Array.isArray(lines)||!lines.length||lines.length>maxLines)fail('CARD_LINES_INVALID');
  const result=[],ranges=latinRanges(title),boundaries=new Set([0,...[...graphemes.segment(title)].map(s=>s.index+s.segment.length)]);let cursor=0;
  for(const raw of lines){
    if(typeof raw!=='string'||!raw.trim()||/[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/u.test(raw))fail('CARD_LINES_INVALID');
    const line=raw.trim();
    while(cursor<title.length&&/\s/u.test(title[cursor]))cursor++;
    if(!boundaries.has(cursor))fail('CARD_LINES_SPLIT_GRAPHEME');
    if(!title.startsWith(line,cursor))fail('CARD_LINES_TITLE_MISMATCH');
    if(!legalEdge(line))fail('CARD_LINES_KINSOKU');
    cursor+=line.length;
    if(!boundaries.has(cursor))fail('CARD_LINES_SPLIT_GRAPHEME');
    if(ranges.some(([start,end])=>cursor>start&&cursor<end))fail('CARD_LINES_SPLIT_LATIN_TOKEN');
    result.push(line);
  }
  if(title.slice(cursor).trim())fail('CARD_LINES_TITLE_MISMATCH');
  return result;
}
function automaticLines(title,measure,size,width,count) {
  const points=[0,...new Set([...words.segment(title)].map(s=>s.index+s.segment.length))];
  const boundaries=new Set([0,...[...graphemes.segment(title)].map(s=>s.index+s.segment.length)]);
  const ranges=latinRanges(title),legal=points.filter(p=>!ranges.some(([a,b])=>p>a&&p<b));
  const total=measure(title.trim(),size),target=total/count,minWidth=Math.min(width*.32,target*.55);
  const states=new Map([['0:0',{cost:0,lines:[]}]]);
  for(let n=0;n<count;n++)for(let i=0;i<legal.length;i++){
    const state=states.get(`${n}:${i}`);if(!state)continue;
    for(let j=i+1;j<legal.length;j++){
      const raw=title.slice(legal[i],legal[j]),line=raw.trim();
      if(!boundaries.has(legal[i]+raw.length-raw.trimStart().length)||!boundaries.has(legal[j]-(raw.length-raw.trimEnd().length)))continue;
      if(!line||!legalEdge(line))continue;
      const w=measure(line,size);if(w>width)break;
      if(count>1&&w<minWidth)continue;
      const first=[...words.segment(line)][0]?.segment;
      const before=title.slice(0,legal[i]).trimEnd().at(-1)??'';
      const sentence=/[。？！?!：:]$/u.test(title.slice(0,legal[j]).trimEnd());
      const penalty=(weakStarts.has(first)?2:0)+(/[A-Za-z0-9]$/u.test(before)&&/^[ァ-ヿ]/u.test(line)?1.5:0);
      const cost=state.cost+((w-target)/width)**2+penalty-(sentence ? .08 : 0);
      const key=`${n+1}:${j}`,old=states.get(key);
      if(!old||cost<old.cost)states.set(key,{cost,lines:[...state.lines,line]});
    }
  }
  return states.get(`${count}:${legal.length-1}`)?.lines;
}

/** Pure text validation; capacity is measured later with the admitted real font. */
export function validateSocialTitleLines(title,lines) {
  titleInput(title);
  return lines===undefined?undefined:checkedLines(title,lines,5);
}
/** Explicit line text may replace boundary whitespace, but may not add/remove/rewrite title text. */
export function layoutSocialTitle(title,options={},measure) {
  titleInput(title);
  if(typeof measure!=='function')fail('CARD_MEASURE_REQUIRED');
  if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(key=>!['lines','width','height','lineHeight','minSize','maxSize','maxLines'].includes(key)))fail('CARD_LAYOUT_OPTIONS_INVALID');
  const {lines,width=540,height=320,lineHeight=1.25,minSize=48,maxSize=54,maxLines=5}=options;
  if(![width,height,lineHeight,minSize,maxSize,maxLines].every(Number.isFinite)||width<=0||height<=0||lineHeight<1||minSize<48||maxSize<minSize||maxSize>80||!Number.isInteger(minSize)||!Number.isInteger(maxSize)||!Number.isInteger(maxLines)||maxLines<1||maxLines>5)fail('CARD_LAYOUT_OPTIONS_INVALID');
  const manual=lines===undefined?undefined:checkedLines(title,lines,maxLines);
  const cache=new Map(),widthOf=(text,size)=>{const key=JSON.stringify([text,size]);if(!cache.has(key)){const value=measure(text,size);if(!Number.isFinite(value)||value<0)fail('CARD_MEASURE_INVALID');cache.set(key,value);}return cache.get(key);};
  for(let size=maxSize;size>=minSize;size=size>minSize?Math.max(minSize,size-2):minSize-1){
    if(manual){
      if(manual.length*size*lineHeight<=height&&manual.every(line=>widthOf(line,size)<=width))return {title,lines:manual,fontSize:size,lineHeight,mode:'manual'};
    }else for(let count=1;count<=maxLines;count++){
      if(count*size*lineHeight>height)break;
      const proposed=automaticLines(title,widthOf,size,width,count);
      if(proposed)return {title,lines:checkedLines(title,proposed,maxLines),fontSize:size,lineHeight,mode:'automatic'};
    }
  }
  fail('CARD_TITLE_CANNOT_FIT');
}
