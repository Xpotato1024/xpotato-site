import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { jstDay, mondayId, parseUpdateDate, relativeUpdateDate, updateActivity, updateInstant, isNewUpdate, validUpdateEvents, type UpdateEvent } from './update-activity.js';
const now = Date.parse('2026-11-12T12:00:00+09:00');
const event = (date: string, extra: Partial<UpdateEvent> = {}): UpdateEvent => ({ id: date, contentId: extra.id ?? date, date, kind: 'blog', action: '公開', route: '/articles/example/', title: 'Example', ...extra });

describe('JST update window', () => {
  it('maps counts to the four visual levels without dropping exact counts', () => {
    for (const total of [0, 1, 2, 3, 7]) {
      const result = updateActivity(Array.from({ length: total }, (_, i) => event('2026-11-10', { id: `item-${i}` })), now);
      expect(result.weeks.at(-1)).toMatchObject({ total, level: Math.min(total, 3), beforeLaunch: false });
    }
  });
  it('uses JST midnight and Monday even across UTC and year boundaries', () => {
    expect(jstDay(Date.parse('2026-11-08T15:00:00Z'))).toBe('2026-11-09');
    expect(mondayId('2026-11-08')).toBe('2026-11-02');
    expect(mondayId('2026-11-09')).toBe('2026-11-09');
    expect(mondayId('2027-01-01')).toBe('2026-12-28');
    expect(updateActivity([], Date.parse('2026-11-08T14:59:59Z')).weeks.at(-1)?.id).toBe('2026-11-02');
    expect(updateActivity([], Date.parse('2026-11-08T15:00:00Z')).weeks.at(-1)?.id).toBe('2026-11-09');
  });
  it('counts 13 inclusive calendar weeks and keeps stable IDs, kinds and event details for stage 2', () => {
    const result = updateActivity([event('2026-08-16'), event('2026-08-17'), event('2026-11-09'),
      event('2026-11-10', { kind: 'tools' }), event('2026-11-11', { kind: 'projects' }), event('2026-11-12', { kind: 'notes' })], now, '2026-08-03');
    expect(result.weeks).toHaveLength(13); expect(result.weeks[0]?.id).toBe('2026-08-17'); expect(result.total).toBe(5);
    expect(result.weeks.at(-1)).toMatchObject({ id: '2026-11-09', total: 4, level: 3, current: true, counts: { blog: 1, tools: 1, projects: 1, notes: 1 } });
    expect(result.weeks.at(-1)?.events).toHaveLength(4);
    expect(result.weeks.at(-1)?.label).toBe('2026-11-09の週：4件（記事1、ツール1、制作物1、メモ1）、今週');
    expect(result.banner?.kind).toBe('notes'); expect(result.latest?.kind).toBe('notes');
  });
  it('shows the latest publication or revision across every kind, including a newer article', () => {
    const at = Date.parse('2026-11-14T12:00:00+09:00');
    const tool = event('2026-11-10', { id: 'tool', kind: 'tools', action: '更新' });
    const article = event('2026-11-14', { id: 'article', action: '更新' });
    const result = updateActivity([tool, article], at);
    expect(result.banner).toEqual(article);
    expect(result.banner).toEqual(result.latest);
    expect(result.weeks.at(-1)?.counts).toMatchObject({ blog: 1, tools: 1 });
    expect(relativeUpdateDate(result.banner!.date, at)).toBe('今日');
    expect(isNewUpdate(result.banner!, at)).toBe(true);
    for (const kind of ['blog', 'tools', 'projects', 'notes'] as const) {
      const latest = event('2026-11-14', { id: kind, kind });
      expect(updateActivity([tool, latest], at).banner).toEqual(latest);
    }
    expect(updateActivity([], at).banner).toBeUndefined();
  });
  it('switches the banner at the JST date boundary and excludes future or invalid instants', () => {
    const tool = event('2026-11-10', { id: 'tool', kind: 'tools' });
    const article = event('2026-11-14', { id: 'article', action: '更新' });
    const boundary = Date.parse('2026-11-13T15:00:00Z');
    expect(updateActivity([tool, article], boundary - 1).banner).toEqual(tool);
    expect(updateActivity([tool, article], boundary).banner).toEqual(article);
    const future = event('2026-11-14', { id: 'future', kind: 'notes', occurredAt: '2026-11-14T12:00:00+09:00' });
    const invalid = event('2026-11-14', { id: 'invalid', occurredAt: 'bad' });
    expect(updateActivity([tool, future, invalid], boundary).banner).toEqual(tool);
    expect(updateActivity([article, future], boundary + 12 * 3600000).banner).toEqual(future);
  });
  it('keeps 13 weeks, distinguishes pre-launch slots, and slides them out naturally', () => {
    const events = [event('2026-10-04'), ...Array.from({ length: 9 }, (_, i) => event('2026-10-05', { id: `launch-${i}` }))];
    const current = updateActivity(events, now);
    expect(current.weeks).toHaveLength(13); expect(current.weeks[0]?.id).toBe('2026-08-17');
    expect(current.weeks.filter(week => week.beforeLaunch)).toHaveLength(7);
    expect(current.weeks.filter(week => week.beforeLaunch).every(week => week.total === 0 && week.events.length === 0 && week.label.includes('サイト公開前（集計対象外）') && !week.label.includes('0件'))).toBe(true);
    expect(current.weeks.filter(week => week.launch)).toEqual([expect.objectContaining({ id: '2026-10-05', beforeLaunch: false, total: 9 })]);
    expect(current.summary).toBe('直近13週で9件'); expect(current.total).toBe(9);
    expect(updateActivity(events, Date.parse('2026-10-05T00:00:00+09:00')).weeks.filter(week => week.beforeLaunch)).toHaveLength(12);
    expect(updateActivity(events, Date.parse('2026-12-21T00:00:00+09:00')).summary).toBe('直近13週で9件');
    expect(updateActivity(events, Date.parse('2026-12-28T00:00:00+09:00')).summary).toBe('直近13週で9件');
    expect(updateActivity(events, Date.parse('2026-12-28T00:00:00+09:00')).weeks.some(week => week.beforeLaunch)).toBe(false);
    const next = updateActivity(events, Date.parse('2027-01-04T00:00:00+09:00'));
    expect(next.weeks).toHaveLength(13); expect(next.weeks[0]?.id).toBe('2026-10-12'); expect(next.total).toBe(0);
    expect(next.weeks.some(week => week.beforeLaunch || week.launch)).toBe(false);
    const before = updateActivity(events, Date.parse('2026-10-04T23:59:59+09:00'));
    expect(before.weeks).toHaveLength(13); expect(before.weeks.every(week => week.beforeLaunch)).toBe(true);
    expect(before.total).toBe(0); expect(before.latest).toBeUndefined(); expect(before.summary).toBe('直近13週で0件');
    expect(() => updateActivity(events, now, '2026-10-06')).toThrow('Monday');
    expect(() => updateActivity(events, now, '2026-02-30')).toThrow('Monday');
  });
  it('renders sparse and stalled histories honestly as the clock moves without a rebuild', () => {
    const events = [event('2026-10-13'), event('2026-10-27'), event('2026-11-10')];
    expect(updateActivity(events, now).total).toBe(3);
    const stalled = updateActivity(events, Date.parse('2027-01-12T12:00:00+09:00'));
    expect(stalled.weeks.slice(-8).every(week => week.total === 0)).toBe(true);
    expect(stalled.weeks.at(-1)?.current).toBe(true);
    expect(relativeUpdateDate(stalled.latest!.date, Date.parse('2027-01-12T12:00:00+09:00'))).toBe('63日前');
  });
  it('uses calendar days for today/yesterday and does not hide a long absence', () => {
    expect(relativeUpdateDate('2026-11-12', now)).toBe('今日');
    expect(relativeUpdateDate('2026-11-11', now)).toBe('昨日');
    expect(relativeUpdateDate('2026-09-01', now)).toBe('72日前');
  });
  it('honors exact timestamps within the closed 72-hour interval', () => {
    const make = (instant: number) => event(jstDay(instant), { occurredAt: new Date(instant).toISOString() });
    expect(isNewUpdate(make(now), now)).toBe(true);
    expect(isNewUpdate(make(now - 72 * 3600000), now)).toBe(true);
    expect(isNewUpdate(make(now - 72 * 3600000 - 1), now)).toBe(false);
    expect(updateActivity([make(now + 1)], now).total).toBe(0);
    expect(isNewUpdate(event('2026-11-12'), now)).toBe(true);
    expect(updateInstant(event('2026-11-12'))).toBeUndefined();
    const monday = Date.parse('2026-11-09T00:00:00+09:00');
    const previous = updateActivity([make(monday - 1)], monday);
    expect(isNewUpdate(make(monday - 1), monday)).toBe(true);
    expect(previous.weeks.at(-2)).toMatchObject({ current: false });
    expect(previous.weeks.at(-1)).toMatchObject({ current: true });
  });
  it('rejects invalid calendar dates, future dates/instants, duplicate IDs and inconsistent timestamps', () => {
    for (const date of ['2026-02-29', '2026-02-30', '2026-13-01', '', '2026-1-1', 'yesterday']) expect(parseUpdateDate(date)).toBeUndefined();
    expect(parseUpdateDate('2028-02-29')).toBeTypeOf('number');
    const invalid = [event('2026-11-13'), event('2026-02-30'), event('2026-11-12', { occurredAt: '2026-11-12T12:00:01+09:00' }),
      event('2026-11-11', { occurredAt: '2026-11-12T00:00:00+09:00' }), event('2026-11-12', { occurredAt: 'not a date' }),
      event('2026-11-12', { occurredAt: '2026-11-12T00:00:00' }), event('2026-11-12', { route: '//other.invalid/' })];
    expect(validUpdateEvents(invalid, now)).toEqual([]);
    expect(validUpdateEvents([event('2026-11-10'), event('2026-11-10')], now)).toHaveLength(1);
  });
  it('uses the entire JST date range without inventing an instant', () => {
    const dateOnly = event('2026-11-10');
    for (const date of ['2026-11-10', '2026-11-11', '2026-11-12'])
      for (const time of ['00:00:00.000', '12:00:00.000', '23:59:59.999'])
        expect(isNewUpdate(dateOnly, Date.parse(date + 'T' + time + '+09:00'))).toBe(true);
    const edge = Date.parse('2026-11-13T00:00:00+09:00');
    expect(isNewUpdate(dateOnly, edge)).toBe(true); // All possible ages still fit the closed 72-hour range.
    expect(isNewUpdate(dateOnly, edge + 1)).toBe(false); // From here the exact age is unknown.
    expect(isNewUpdate(dateOnly, Date.parse('2026-11-13T12:00:00+09:00'))).toBe(false);
    expect(isNewUpdate(dateOnly, Date.parse('2026-11-14T00:00:00+09:00'))).toBe(false);
    expect(isNewUpdate(event('2026-11-13'), now)).toBe(false);
    expect(isNewUpdate(event('2026-02-30'), now)).toBe(false);
    expect(isNewUpdate(dateOnly, Number.NaN)).toBe(false);
    expect(updateInstant(dateOnly)).toBeUndefined(); expect(dateOnly.occurredAt).toBeUndefined();
    expect(isNewUpdate(event('2028-02-29'), Date.parse('2028-03-02T23:59:59.999+09:00'))).toBe(true);
    expect(isNewUpdate(event('2026-12-30'), Date.parse('2027-01-02T00:00:00.001+09:00'))).toBe(false);
  });
  it('prioritizes recorded instants and never rescues invalid ones as date-only records', () => {
    const at = Date.parse('2026-11-13T12:00:00+09:00');
    expect(isNewUpdate(event('2026-11-10', { occurredAt: '2026-11-10T12:00:00+09:00' }), at)).toBe(true);
    expect(isNewUpdate(event('2026-11-10', { occurredAt: '2026-11-10T11:59:59.999+09:00' }), at)).toBe(false);
    for (const occurredAt of ['', 'invalid', '2026-11-11T00:00:00+09:00', '2026-11-10T00:00:00'])
      expect(isNewUpdate(event('2026-11-10', { occurredAt }), now)).toBe(false);
    expect(isNewUpdate(event('2026-11-12', { occurredAt: '2026-11-12T12:00:00.001+09:00' }), now)).toBe(false);
    expect(isNewUpdate(event('2026-11-10'), Date.parse('2026-11-12T15:00:00Z'))).toBe(true);
    expect(isNewUpdate(event('2026-11-10'), Date.parse('2026-11-12T15:00:00.001Z'))).toBe(false);
  });
  it('keeps the initial/no-JS view absolute and the strip non-interactive without animation', () => {
    const component = readFileSync('apps/site/src/components/UpdateActivity.astro', 'utf8');
    expect(component).toContain('datetime={banner.date}>{banner.date}</time>');
    expect(clientDeclaration(component)).toBe(false);
    expect(component).not.toMatch(/client:|weeks\.map|relativeUpdateDate/);
    const client = readFileSync('apps/site/src/lib/home/update-activity-client.ts', 'utf8');
    expect(client).toContain("marker.setAttribute('aria-label', week.label)");
    expect(client).toContain("element('p', 'home-update-summary'");
    expect(client).toContain("element('span', 'home-update-count')");
    expect(client).not.toContain("'home-update-count', String(week.total)");
    expect(component).toContain('<h2 id="updates-heading">更新状況</h2>');
    expect(component).toContain('aria-label="今週"');
    for (const source of [component, client]) {
      expect(source).toContain('最新の公開・更新：');
      expect(source).toContain('公開・更新の記録はありません');
      expect(source).not.toContain('ツール・制作物の最新');
      expect(source).not.toContain('記事はこの行に含みません');
    }
    expect(client).not.toContain('innerHTML'); expect(client).not.toContain('tabIndex');
    const css = readFileSync('apps/site/src/styles/home.css', 'utf8');
    const strip = css.slice(css.indexOf('.home-updates {'), css.indexOf('.home-tool-list {'));
    expect(strip).not.toMatch(/animation|transition/);
    expect(strip).not.toContain('[data-current]'); expect(strip).not.toContain('[data-recent]');
    expect(strip).toContain('.home-update-prelaunch');
    expect(client).toContain('validUpdateEvents(events, now).filter(event => isNewUpdate(event, now))');
    expect(client).toContain("if (isNewUpdate(item, now))");
    expect(component).toContain('class="home-update-meta home-meta"');
    expect(client).toContain('link.append(meta, title)');
    expect(client).toContain("document.querySelectorAll<HTMLElement>('[data-home-new]')");
  });
});

function clientDeclaration(component: string) { return /<p[^>]*aria-label=|<div[^>]*data-update-banner[^>]*aria-label=/.test(component); }
