import { parse, parseFragment, serialize } from 'parse5';
/** Private preview / QA only. These records never enter the public catalog or dist. */
export function updateActivityFixture(html, scenario, now = Date.now()) {
  if (!['current', 'current-labeled', 'sliding', 'sparse', 'stalled', 'recent', 'invalid', 'article-latest', 'nojs'].includes(scenario)) throw Error('Unknown update fixture');
  const date = value => new Date(value + 9 * 3600000).toISOString().slice(0, 10);
  const today = Date.parse(date(now) + 'T00:00:00Z'), monday = today - ((new Date(today).getUTCDay() + 6) % 7) * 86400000;
  const launchWeek = new Date(monday - (['sliding', 'stalled'].includes(scenario) ? 18 : 5) * 7 * 86400000).toISOString().slice(0, 10);
  const days = scenario === 'stalled' ? [65, 79, 93] : [2, 16, 30];
  const events = days.map((age, index) => ({ id: `fixture-${index}`, contentId: `fixture-${index}`, date: date(now - age * 86400000), kind: ['tools', 'blog', 'projects'][index], action: '公開', title: ['検証用ツール', '検証用記事', '検証用制作物'][index], route: ['/tools/', '/articles/', '/projects/'][index] }));
  if (scenario === 'current' || scenario === 'current-labeled') {
    events.splice(2, 1, ...Array.from({ length: 7 }, (_, i) => ({ ...events[2], id: `fixture-launch-${i}`, contentId: `fixture-launch-${i}`, date: launchWeek, kind: i === 6 ? 'notes' : 'projects' })));
  }
  if (scenario === 'sliding') events.push({ ...events[0], id: 'fixture-outside-window', date: launchWeek });
  if (scenario === 'article-latest') events[1].date = date(now);
  if (scenario === 'recent') { events[0].date = date(now - 3600000); events[0].occurredAt = new Date(now - 3600000).toISOString(); }
  if (scenario === 'invalid') {
    events.push({ ...events[0], id: 'future', date: date(now + 86400000) }, { ...events[0], id: 'invalid', date: '2026-02-30' });
  }
  const doc = parse(html), walk = node => [node, ...(node.childNodes ?? []).flatMap(walk)], nodes = walk(doc);
  const attr = (node, name) => node.attrs?.find(item => item.name === name);
  const root = nodes.find(node => attr(node, 'data-update-activity'));
  if (!root) throw Error('Update component missing');
  if (scenario === 'nojs') {
    for (const node of nodes) if (node.tagName === 'script') node.parentNode.childNodes = node.parentNode.childNodes.filter(child => child !== node);
    const label = parseFragment('<p class="home-update-fixture" data-update-fixture>検証用：スクリプトを除いた静的表示。日付は通常ホームと同じ実データです。</p>').childNodes[0];
    label.parentNode = root; root.childNodes.push(label); return serialize(doc);
  }
  attr(root, 'data-update-events').value = JSON.stringify(events);
  attr(root, 'data-update-launch-week').value = launchWeek;
  root.attrs.push({ name: 'data-update-launch-label', value: String(scenario === 'current-labeled') });
  const latest = walk(root).find(node => attr(node, 'data-update-latest'));
  const latestDate = events.map(event => event.date).filter(value => /^\d{4}-\d{2}-\d{2}$/.test(value) && value <= date(now)).sort().at(-1);
  latest.childNodes = parseFragment(`最終更新 <time datetime="${latestDate}">${latestDate}</time>`).childNodes;
  if (attr(latest, 'title')) attr(latest, 'title').value = `検証用データのサイト全体の最終更新：${latestDate}（JST）`;
  latest.childNodes.forEach(node => { node.parentNode = latest; });
  const banner = walk(root).find(node => attr(node, 'data-update-banner'));
  banner.childNodes = parseFragment('<a href="/tools/"><span class="home-update-kind">ツール</span><span class="home-update-title">検証用ツール</span><span aria-hidden="true">→</span></a>').childNodes;
  banner.childNodes.forEach(node => { node.parentNode = banner; });
  const descriptions = { current: '直近13週で9件、公開前7週・公開後6週（公開ラベルなし）', 'current-labeled': '直近13週で9件、公開前7週・公開後6週（公開ラベルあり）', sliding: '公開から19週、直近13週の窓', stalled: '8週以上更新なし', recent: '時刻付きの48時間以内', 'article-latest': '記事がサイト全体の最新、帯はツールの最新' };
  const label = parseFragment(`<p class="home-update-fixture" data-update-fixture>検証用データ：${descriptions[scenario] ?? '約5週間に3件'}。実際の更新記録ではありません。</p>`).childNodes[0];
  label.parentNode = root; root.childNodes.push(label);
  return serialize(doc);
}
