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
    const now = Date.now(), data = updateActivity(events, now);
    const relative = data.latest ? relativeUpdateDate(data.latest.date, now) : '';
    const key = JSON.stringify([data, relative]);
    if (key === previous) return;
    previous = key;
    latest.replaceChildren();
    if (data.latest) {
      const time = document.createElement('time'); time.dateTime = data.latest.date; time.textContent = relative;
      time.title = data.latest.date + '（JST）'; latest.append('最終更新 ', time);
    } else latest.textContent = '更新記録はありません';
    banner.replaceChildren();
    if (data.banner) {
      const link = document.createElement('a'); link.href = data.banner.route;
      const arrow = element('span', '', '→'); arrow.setAttribute('aria-hidden', 'true');
      link.append(element('span', 'home-update-kind', `${updateLabels[data.banner.kind]} · ${data.banner.action}`), element('span', 'home-update-title', data.banner.title), arrow);
      banner.append(link);
    } else banner.textContent = 'ツール・制作物の更新記録はありません';
    const list = element('ol', 'home-update-strip'); list.setAttribute('aria-label', '直近13週の更新件数。月曜始まり、日本時間');
    for (const week of data.weeks) {
      const cell = element('li', 'home-update-week');
      cell.dataset.week = week.id; cell.dataset.level = String(week.level);
      if (week.current) cell.dataset.current = 'true';
      if (week.recent) cell.dataset.recent = 'true';
      // A named inner image is a single non-interactive reading unit within the native list.
      const marker = element('span', 'home-update-count', String(week.total)); marker.setAttribute('role', 'img');
      marker.setAttribute('aria-label', week.label); marker.title = week.label; cell.append(marker); list.append(cell);
    }
    const plot = element('div', 'home-update-plot');
    const axis = element('div', 'home-update-axis'); axis.setAttribute('aria-hidden', 'true');
    axis.append(element('span', '', data.weeks[0]!.id), element('span', '', '今週'));
    plot.append(list, axis);
    const summary = element('p', 'home-update-summary', `直近13週で${data.total}件`);
    const legend = element('p', 'home-update-legend', '1マス＝1週 · 0 / 1 / 2 / 3件以上 · 月曜始まり・JST');
    if (data.recent) legend.append(element('span', 'home-update-recent', '48時間以内の更新あり'));
    const precision = element('span', 'visually-hidden', '日付のみの記録では48時間以内かどうかを判定しません。'); legend.append(precision);
    view.replaceChildren(plot, summary, legend);
  };
  render();
  // Recalculate on return and while a tab stays open; never leave a stale "current" week.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  window.addEventListener('pageshow', render);
  window.setInterval(() => { if (!document.hidden) render(); }, 60_000);
}
