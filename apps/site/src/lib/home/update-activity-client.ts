import { updateActivity, relativeUpdateDate, updateLabels, isNewUpdate, validUpdateEvents, type UpdateEvent } from './update-activity.js';

export function mountUpdateActivity(root: HTMLElement) {
  const view = root.querySelector<HTMLElement>('[data-update-view]');
  const banner = root.querySelector<HTMLElement>('[data-update-banner]');
  if (!view || !banner) return;
  let events: UpdateEvent[];
  try { events = JSON.parse(root.dataset.updateEvents ?? ''); if (!Array.isArray(events)) return; } catch { return; }
  const element = (tag: string, className: string, text?: string) => {
    const node = document.createElement(tag); node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const newLabel = () => {
    const label = element('span', 'home-new home-meta'); label.dataset.updateNew = '';
    const visible = element('span', '', 'NEW'); visible.setAttribute('aria-hidden', 'true');
    label.append(visible, element('span', 'visually-hidden', '新着')); return label;
  };
  let previous = '';
  const render = () => {
    const now = Date.now(), data = updateActivity(events, now, root.dataset.updateLaunchWeek);
    // One policy for every home item, independent of where it is displayed or the strip window.
    const newIds = new Set(validUpdateEvents(events, now).filter(event => isNewUpdate(event, now)).map(event => event.contentId));
    const relative = data.banner ? relativeUpdateDate(data.banner.date, now) : '';
    const key = JSON.stringify([data, relative, [...newIds]]);
    if (key === previous) return;
    previous = key;
    document.querySelectorAll<HTMLElement>('[data-home-new]').forEach(label => { label.hidden = !newIds.has(label.dataset.homeNew ?? ''); });
    banner.replaceChildren();
    if (data.banner) {
      const item = data.banner, link = document.createElement('a'); link.href = item.route;
      link.title = `ツール・制作物の最新：${item.date}（JST）。記事はこの行に含みません。`;
      const meta = element('span', 'home-update-meta home-meta');
      if (isNewUpdate(item, now)) meta.append(newLabel());
      const time = document.createElement('time'); time.className = 'home-meta home-update-date'; time.dataset.updateLatest = '';
      time.dateTime = item.date; time.textContent = relative; time.title = item.date + '（JST）';
      const arrow = element('span', 'home-update-arrow', '→'); arrow.setAttribute('aria-hidden', 'true');
      meta.append(time, element('span', 'home-update-kind', updateLabels[item.kind] + '・' + item.action));
      const title = element('span', 'home-update-title', item.title); title.append(arrow);
      link.append(meta, title);
      banner.append(link);
    } else { const empty = element('p', '', 'ツール・制作物の更新記録はありません'); empty.dataset.updateLatest = ''; banner.append(empty); }
    const list = element('ol', 'home-update-strip');
    list.setAttribute('aria-label', `${data.summary}。1マスは1週、月曜始まり、日本時間。連続した点線はサイト公開前で集計対象外。紫の濃淡は公開後の0件、1件、2件、3件以上。`);
    list.title = '1マス＝1週。連続した点線は公開前。塗りは0 / 1 / 2 / 3件以上。月曜始まり・JST。';
    const axis = element('div', 'home-update-axis home-meta'); axis.setAttribute('aria-hidden', 'true');
    const launchAxis = element('div', 'home-update-axis home-update-launch-axis home-meta'); launchAxis.setAttribute('aria-hidden', 'true');
    let previousMonth = '';
    for (const week of data.weeks) {
      const cell = element('li', 'home-update-week');
      cell.dataset.week = week.id; cell.dataset.level = String(week.level); cell.dataset.total = String(week.total);
      if (week.current) cell.dataset.current = 'true';
      if (week.beforeLaunch) cell.dataset.beforeLaunch = 'true';
      if (week.launch) cell.dataset.launch = 'true';
      const marker = element('span', 'home-update-count'); marker.setAttribute('role', 'img');
      marker.setAttribute('aria-label', week.label); marker.title = week.label; cell.append(marker); list.append(cell);
      const month = week.id.slice(0, 7);
      const shortOpeningMonth = week === data.weeks[0] && data.weeks[1] && data.weeks[1].id.slice(0, 7) !== month;
      axis.append(element('span', '', month !== previousMonth && !shortOpeningMonth ? `${Number(week.id.slice(5, 7))}月` : '')); previousMonth = month;
      launchAxis.append(element('span', '', week.launch ? '公開' : ''));
    }
    const plot = element('div', 'home-update-plot'), bars = element('div', 'home-update-bars'); bars.append(list);
    const before = data.weeks.filter(week => week.beforeLaunch).length;
    if (before) {
      const prelaunch = element('span', 'home-update-prelaunch'); prelaunch.style.gridColumn = '1 / span ' + before;
      prelaunch.setAttribute('aria-hidden', 'true'); bars.append(prelaunch);
    }
    const pointers = element('div', 'home-update-pointer-row'), pointer = element('span', 'home-update-pointer');
    pointer.setAttribute('role', 'img'); pointer.setAttribute('aria-label', '今週');
    // CSS draws a quiet 8×8px filled triangle without a font-dependent symbol.
    pointer.append(element('span', 'home-update-triangle')); pointers.append(pointer);
    plot.append(axis, bars, pointers);
    if (root.dataset.updateLaunchLabel === 'true' && data.weeks.some(week => week.launch)) plot.append(launchAxis);
    const summary = element('p', 'home-update-summary');
    summary.append('直近', element('span', 'home-number', '13'), '週で', element('span', 'home-number', String(data.total)), '件');
    view.replaceChildren(plot, summary);
    root.dataset.updateReady = "true";
  };
  render();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  window.addEventListener('pageshow', render);
  window.setInterval(() => { if (!document.hidden) render(); }, 60_000);
}
