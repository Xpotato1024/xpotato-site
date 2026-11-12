import { updateActivity, relativeUpdateDate, updateLabels, type UpdateEvent } from './update-activity.js';

export function mountUpdateActivity(root: HTMLElement) {
  const view = root.querySelector<HTMLElement>('[data-update-view]');
  const latest = root.querySelector<HTMLElement>('[data-update-latest]');
  const banner = root.querySelector<HTMLElement>('[data-update-banner]');
  if (!view || !latest || !banner) return;
  let events: UpdateEvent[];
  try { events = JSON.parse(root.dataset.updateEvents ?? ''); if (!Array.isArray(events)) return; } catch { return; }
  const element = (tag: string, className: string, text?: string) => {
    const node = document.createElement(tag); node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  let previous = '';
  const render = () => {
    const now = Date.now(), data = updateActivity(events, now, root.dataset.updateLaunchWeek);
    const relative = data.latest ? relativeUpdateDate(data.latest.date, now) : '';
    const key = JSON.stringify([data, relative]);
    if (key === previous) return;
    previous = key;
    latest.replaceChildren();
    if (data.latest) {
      const time = document.createElement('time'); time.dateTime = data.latest.date; time.textContent = relative;
      time.title = data.latest.date + '（JST）'; latest.append('最終更新 ', time);
      latest.title = `サイト全体の最終更新：${updateLabels[data.latest.kind]}「${data.latest.title}」 ${data.latest.date}（JST）`;
      latest.append(element('span', 'visually-hidden', `（サイト全体：${updateLabels[data.latest.kind]}「${data.latest.title}」）`));
    } else { latest.textContent = '更新記録はありません'; latest.removeAttribute('title'); }
    banner.replaceChildren();
    if (data.banner) {
      const link = document.createElement('a'); link.href = data.banner.route;
      link.title = `ツール・制作物の最新：${data.banner.date} ${data.banner.title}。サイト全体の最終更新とは対象が異なります。`;
      link.setAttribute('aria-label', `${updateLabels[data.banner.kind]}「${data.banner.title}」。${link.title}`);
      const arrow = element('span', '', '→'); arrow.setAttribute('aria-hidden', 'true');
      link.append(element('span', 'home-update-kind', updateLabels[data.banner.kind]), element('span', 'home-update-title', data.banner.title), arrow);
      banner.append(link);
    } else banner.textContent = 'ツール・制作物の更新記録はありません';
    const list = element('ol', 'home-update-strip');
    list.setAttribute('aria-label', `${data.summary}。1マスは1週、月曜始まり、日本時間。点線はサイト公開前で集計対象外。紫の濃淡は公開後の0件、1件、2件、3件以上。`);
    list.title = '1マス＝1週。点線は公開前。塗りは0 / 1 / 2 / 3件以上。月曜始まり・JST。';
    const axis = element('div', 'home-update-axis'); axis.setAttribute('aria-hidden', 'true');
    const launchAxis = element('div', 'home-update-axis home-update-launch-axis'); launchAxis.setAttribute('aria-hidden', 'true');
    let previousMonth = '';
    for (const week of data.weeks) {
      const cell = element('li', 'home-update-week');
      cell.dataset.week = week.id; cell.dataset.level = String(week.level); cell.dataset.total = String(week.total);
      if (week.current) cell.dataset.current = 'true';
      if (week.recent) cell.dataset.recent = 'true';
      if (week.beforeLaunch) cell.dataset.beforeLaunch = 'true';
      if (week.launch) cell.dataset.launch = 'true';
      // A named inner image is a single non-interactive reading unit within the native list.
      const marker = element('span', 'home-update-count'); marker.setAttribute('role', 'img');
      marker.setAttribute('aria-label', week.label); marker.title = week.label; cell.append(marker); list.append(cell);
      const month = week.id.slice(0, 7);
      const shortOpeningMonth = week === data.weeks[0] && data.weeks[1] && data.weeks[1].id.slice(0, 7) !== month;
      const label = element('span', '', month !== previousMonth && !shortOpeningMonth ? `${Number(week.id.slice(5, 7))}月` : '');
      axis.append(label); previousMonth = month;
      launchAxis.append(element('span', '', week.launch ? '公開' : ''));
    }
    const plot = element('div', 'home-update-plot');
    plot.append(axis, list);
    if (root.dataset.updateLaunchLabel === 'true' && data.weeks.some(week => week.launch)) plot.append(launchAxis);
    const summary = element('p', 'home-update-summary', data.summary);
    if (data.recent) summary.append(element('span', 'visually-hidden', '。48時間以内の更新あり。'));
    summary.title = '日付のみの記録では48時間以内かどうかを判定しません。';
    view.replaceChildren(plot, summary);
  };
  render();
  // Recalculate on return and while a tab stays open; never leave a stale "current" week.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  window.addEventListener('pageshow', render);
  window.setInterval(() => { if (!document.hidden) render(); }, 60_000);
}
