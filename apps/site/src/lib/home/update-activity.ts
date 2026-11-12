/** Date calculations are independent of the viewer's time zone and the build clock. */
export const updateKinds = ['blog', 'tools', 'projects', 'notes'] as const;
export type UpdateKind = typeof updateKinds[number];
export const updateLabels: Record<UpdateKind, string> = { blog: '記事', tools: 'ツール', projects: '制作物', notes: 'メモ' };
export interface UpdateEvent {
  id: string;
  contentId: string;
  date: string;
  /** Only an explicitly recorded instant may establish the 48-hour state. */
  occurredAt?: string;
  kind: UpdateKind;
  action: '公開' | '更新';
  title: string;
  route: string;
}
export interface UpdateWeek {
  id: string;
  counts: Record<UpdateKind, number>;
  events: UpdateEvent[];
  total: number;
  level: 0 | 1 | 2 | 3;
  current: boolean;
  recent: boolean;
  label: string;
}
const day = 86_400_000, jst = 9 * 3_600_000;
const isoDay = (value: number) => new Date(value).toISOString().slice(0, 10);
export const jstDay = (now: number) => isoDay(now + jst);
export function parseUpdateDate(value: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return undefined;
  const parsed = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(parsed) && isoDay(parsed) === value ? parsed : undefined;
}
export function mondayId(date: string): string {
  const value = parseUpdateDate(date);
  if (value === undefined) throw Error('Invalid update date');
  return isoDay(value - ((new Date(value).getUTCDay() + 6) % 7) * day);
}
export function updateInstant(event: UpdateEvent): number | undefined {
  if (!event.occurredAt || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/u.test(event.occurredAt)) return undefined;
  // Reject Date.parse's calendar normalization, not just NaN.
  if (parseUpdateDate(event.occurredAt.slice(0, 10)) === undefined) return undefined;
  const parsed = Date.parse(event.occurredAt);
  return Number.isFinite(parsed) && jstDay(parsed) === event.date ? parsed : undefined;
}
export function validUpdateEvents(events: readonly UpdateEvent[], now: number): UpdateEvent[] {
  const today = jstDay(now), seen = new Set<string>();
  return events.filter(event => {
    const instant = updateInstant(event);
    if (!event.id || seen.has(event.id) || !updateKinds.includes(event.kind) || parseUpdateDate(event.date) === undefined
      || event.date > today || (event.occurredAt !== undefined && (instant === undefined || instant > now))
      || !event.route.startsWith('/') || event.route.startsWith('//')) return false;
    seen.add(event.id); return true;
  }).sort((a, b) => b.date.localeCompare(a.date) || (updateInstant(b) ?? 0) - (updateInstant(a) ?? 0) || a.id.localeCompare(b.id));
}
export function relativeUpdateDate(date: string, now: number): string {
  const days = Math.round((parseUpdateDate(jstDay(now))! - parseUpdateDate(date)!) / day);
  return days === 0 ? '今日' : days === 1 ? '昨日' : `${days}日前`;
}
export function updateActivity(events: readonly UpdateEvent[], now: number) {
  const valid = validUpdateEvents(events, now), current = mondayId(jstDay(now));
  const first = parseUpdateDate(current)! - 12 * 7 * day;
  const isRecent = (event: UpdateEvent) => {
    const instant = updateInstant(event);
    return instant !== undefined && now - instant >= 0 && now - instant <= 48 * 3_600_000;
  };
  const weeks: UpdateWeek[] = Array.from({ length: 13 }, (_, index) => {
    const id = isoDay(first + index * 7 * day);
    const items = valid.filter(event => mondayId(event.date) === id);
    const counts = Object.fromEntries(updateKinds.map(kind => [kind, items.filter(event => event.kind === kind).length])) as UpdateWeek['counts'];
    const total = items.length, recent = items.some(isRecent);
    const detail = updateKinds.filter(kind => counts[kind]).map(kind => updateLabels[kind] + counts[kind]).join('、');
    return { id, counts, events: items, total, level: Math.min(total, 3) as UpdateWeek['level'], current: id === current, recent,
      label: `${id}の週：${total}件${detail ? `（${detail}）` : ''}${id === current ? '、今週' : ''}${recent ? '、48時間以内の更新あり' : ''}` };
  });
  return { weeks, total: weeks.reduce((sum, week) => sum + week.total, 0), latest: valid[0],
    banner: valid.find(event => event.kind === 'tools' || event.kind === 'projects'), recent: valid.some(isRecent) };
}
