import { parse, parseFragment, serialize } from 'parse5';
/** Private preview / QA only. These records never enter the public catalog or dist. */
export function updateActivityFixture(html, scenario, now = Date.now()) {
  if (!['current','current-labeled','four-days','sliding','sparse','stalled','recent','invalid','article-latest','date-only','date-only-three-days','nojs'].includes(scenario)) throw Error('Unknown update fixture');
  const date = value => new Date(value + 9 * 3600000).toISOString().slice(0, 10);
  const today = Date.parse(date(now) + 'T00:00:00Z'), monday = today - ((new Date(today).getUTCDay() + 6) % 7) * 86400000;
  const launchWeek = new Date(monday - (['sliding','stalled'].includes(scenario) ? 18 : 5) * 7 * 86400000).toISOString().slice(0,10);
  const doc = parse(html), walk = node => [node,...(node.childNodes??[]).flatMap(walk)], nodes = walk(doc);
  const attr = (node,name) => node.attrs?.find(item=>item.name===name);
  const root = nodes.find(node=>attr(node,'data-update-activity'));
  if (!root) throw Error('Update component missing');
  const append = (parent, html) => { const children=parseFragment(html).childNodes; for(const child of children) child.parentNode=parent; parent.childNodes.push(...children); };
  if (scenario==='nojs') {
    for(const node of nodes) if(node.tagName==='script') node.parentNode.childNodes=node.parentNode.childNodes.filter(child=>child!==node);
    append(root,'<p class="home-update-fixture" data-update-fixture>検証用：スクリプトを除いた静的表示。日付は通常ホームと同じ実データです。</p>'); return serialize(doc);
  }
  const actual = JSON.parse(attr(root,'data-update-events').value);
  const ids = new Set(nodes.filter(node=>attr(node,'data-home-new')).map(node=>attr(node,'data-home-new').value));
  const first = kind=>actual.find(event=>event.kind===kind&&ids.has(event.contentId));
  const ages = scenario==='stalled' ? [65,79,93] : ['four-days','invalid'].includes(scenario) ? [4,4,4] : scenario==='date-only-three-days' ? [3,3,3] : [2,2,2];
  const events = ['tools','blog','projects'].map((kind,index)=>{
    const source=first(kind), instant=now-ages[index]*86400000;
    return {id:'fixture-'+index,contentId:source?.contentId??'fixture-'+index,date:date(instant),occurredAt:new Date(instant).toISOString(),kind,action:'更新',title:source?.title??'検証用'+kind,route:source?.route??'/'+kind+'/'};
  });
  if(['current','current-labeled','four-days','sliding'].includes(scenario)) events.push(...Array.from({length:6},(_,i)=>({...events[2],occurredAt:undefined,id:'fixture-launch-'+i,contentId:'fixture-launch-'+i,date:scenario==='sliding'?date(now-30*86400000):launchWeek})));
  if(scenario==='sliding') events.push({...events[0],id:'fixture-outside-window',occurredAt:undefined,date:launchWeek});
  if(scenario==='article-latest'){events[1].date=date(now);events[1].occurredAt=new Date(now).toISOString();}
  if(scenario.startsWith('date-only')) events.forEach(event=>{delete event.occurredAt});
  if(scenario==='recent'){events[0].date=date(now-3600000);events[0].occurredAt=new Date(now-3600000).toISOString();}
  if(scenario==='invalid'){events.forEach(event=>{delete event.occurredAt});events.push({...events[0],id:'future',date:date(now+86400000)},{...events[0],id:'invalid',date:'2026-02-30'});}
  attr(root,'data-update-events').value=JSON.stringify(events); attr(root,'data-update-launch-week').value=launchWeek;
  root.attrs.push({name:'data-update-launch-label',value:String(scenario==='current-labeled')});
  const latest=walk(root).find(node=>attr(node,'data-update-latest'));
  latest.childNodes=parseFragment(events[0].date).childNodes;attr(latest,'datetime').value=events[0].date; latest.childNodes.forEach(node=>{node.parentNode=latest;});
  const descriptions={current:'公開から6週、最新2日前（時刻あり・NEWあり）','four-days':'公開から6週、最新4日前（NEWなし）','current-labeled':'公開から6週、最新2日前・公開ラベル比較',sliding:'公開から19週、直近13週の窓',stalled:'8週以上更新なし',recent:'時刻付きの1時間以内','article-latest':'記事は今日、最新アイテムの行は2日前のツール','date-only':'2日前の日付のみ（72時間内と確定・NEWあり）','date-only-three-days':'3日前の日付のみ（通常は未確定・NEWなし）',invalid:'4日前の日付のみ・未来日・不正日'};
  append(root,'<p class="home-update-fixture" data-update-fixture>検証用データ：'+(descriptions[scenario]??'約5週間に3件')+'。実際の更新記録ではありません。</p>');
  return serialize(doc);
}
