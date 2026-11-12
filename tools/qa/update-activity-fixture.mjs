import { parse, parseFragment, serialize } from 'parse5';
/** Private preview / QA only. These records never enter the public catalog or dist. */
export function updateActivityFixture(html, scenario, now = Date.now()) {
  if (!['sparse', 'stalled', 'recent', 'invalid'].includes(scenario)) throw Error('Unknown update fixture');
  const date = value => new Date(value + 9 * 3600000).toISOString().slice(0, 10);
  const days = scenario === 'stalled' ? [65, 79, 93] : [2, 16, 30];
  const events = days.map((age, index) => ({ id: `fixture-${index}`, contentId: `fixture-${index}`, date: date(now - age * 86400000), kind: ['tools', 'blog', 'projects'][index], action: '公開', title: ['検証用ツール', '検証用記事', '検証用制作物'][index], route: ['/tools/', '/articles/', '/projects/'][index] }));
  if (scenario === 'recent') { events[0].date = date(now - 3600000); events[0].occurredAt = new Date(now - 3600000).toISOString(); }
  if (scenario === 'invalid') {
    events.push({ ...events[0], id: 'future', date: date(now + 86400000) }, { ...events[0], id: 'invalid', date: '2026-02-30' });
  }
  const doc = parse(html), walk = node => [node, ...(node.childNodes ?? []).flatMap(walk)], nodes = walk(doc);
  const attr = (node, name) => node.attrs?.find(item => item.name === name);
  const root = nodes.find(node => attr(node, 'data-update-activity'));
  if (!root) throw Error('Update component missing');
  attr(root, 'data-update-events').value = JSON.stringify(events);
  const latest = walk(root).find(node => attr(node, 'data-update-latest'));
  latest.childNodes = parseFragment(`最終更新 <time datetime="${events[0].date}">${events[0].date}</time>`).childNodes;
  latest.childNodes.forEach(node => { node.parentNode = latest; });
  const banner = walk(root).find(node => attr(node, 'data-update-banner'));
  banner.childNodes = parseFragment('<a href="/tools/"><span class="home-update-kind">ツール · 公開</span><span class="home-update-title">検証用ツール</span><span aria-hidden="true">→</span></a>').childNodes;
  banner.childNodes.forEach(node => { node.parentNode = banner; });
  const label = parseFragment(`<p class="home-update-legend" data-update-fixture>検証用データ：${scenario === 'stalled' ? '8週以上更新なし' : scenario === 'recent' ? '時刻付きの48時間以内' : '約5週間に3件'}。実際の更新記録ではありません。</p>`).childNodes[0];
  label.parentNode = root; root.childNodes.push(label);
  return serialize(doc);
}
