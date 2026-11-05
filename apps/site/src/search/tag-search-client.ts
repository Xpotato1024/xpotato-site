import { filterTags, TAG_PAGE_SIZE, type DirectoryTag } from '../lib/discovery/tag-directory.js';

const section = document.querySelector<HTMLElement>('[data-tag-search]');
const template = section?.querySelector<HTMLTemplateElement>('[data-tag-catalog]');
const form = section?.querySelector<HTMLFormElement>('form');
const input = section?.querySelector<HTMLInputElement>('#tag-query');
const clear = form?.querySelector<HTMLButtonElement>('button[type="reset"]');
const status = section?.querySelector<HTMLElement>('#tag-status');
const results = section?.querySelector<HTMLElement>('#tag-results');
const paging = section?.querySelector<HTMLElement>('.tag-paging');
const previous = section?.querySelector<HTMLButtonElement>('[data-tag-prev]');
const next = section?.querySelector<HTMLButtonElement>('[data-tag-next]');
const pageLabel = section?.querySelector<HTMLElement>('[data-tag-page]');

if (template && form && input && status && results && paging && previous && next && pageLabel) {
  const tags: DirectoryTag[] = Array.from(template.content.querySelectorAll<HTMLElement>('[data-id]'), node => ({
    id: node.dataset.id!, label: node.dataset.label!, aliases: JSON.parse(node.dataset.aliases!), route: node.dataset.route!, count: Number(node.dataset.count),
  }));
  let page = 1;
  let composing = false;
  const render = (sync?: 'replace' | 'push') => {
    if (composing) return;
    if (clear) clear.disabled = !input.value;
    const query = input.value.trim();
    const matches = filterTags(tags, query);
    const totalPages = Math.max(1, Math.ceil(matches.length / TAG_PAGE_SIZE));
    page = Math.min(page, totalPages);
    const list = document.createElement('ul');
    list.className = 'tag-links';
    for (const tag of matches.slice((page - 1) * TAG_PAGE_SIZE, page * TAG_PAGE_SIZE)) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = tag.route;
      const label = document.createElement('span'); label.textContent = tag.label;
      const count = document.createElement('span'); count.className = 'tag-count'; count.textContent = String(tag.count);
      const suffix = document.createElement('span'); suffix.className = 'visually-hidden'; suffix.textContent = '件の記事';
      count.append(suffix); link.append(label, ' ', count); item.append(link); list.append(item);
    }
    results.replaceChildren(list);
    status.textContent = matches.length ? `${matches.length}タグ・${(page - 1) * TAG_PAGE_SIZE + 1}〜${Math.min(page * TAG_PAGE_SIZE, matches.length)}件を表示（タグ名順）` : '一致するタグはありません。短い語や別名で試してください。';
    paging.hidden = totalPages <= 1;
    previous.disabled = page === 1; next.disabled = page === totalPages;
    pageLabel.textContent = `${page} / ${totalPages}`;
    if (sync) {
      const url = new URL(location.href);
      if (query) url.searchParams.set('tag', query); else url.searchParams.delete('tag');
      if (page > 1) url.searchParams.set('tagPage', String(page)); else url.searchParams.delete('tagPage');
      // Typing must not fill browser history or disturb the independent full-text query.
      if (url.href !== location.href) history[sync === 'push' ? 'pushState' : 'replaceState'](null, '', url);
    }
  };
  const restore = () => {
    composing = false;
    const params = new URL(location.href).searchParams;
    const requestedPage = Number(params.get('tagPage') ?? 1);
    page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    input.value = params.get('tag') ?? ''; render();
  };
  input.addEventListener('input', () => { page = 1; render('replace'); });
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; page = 1; render('replace'); });
  form.addEventListener('submit', event => { event.preventDefault(); if (!composing) { page = 1; render('replace'); } });
  input.addEventListener('keydown', event => { if (event.key === 'Enter' && (composing || event.isComposing)) event.preventDefault(); });
  form.addEventListener('reset', () => { composing = false; queueMicrotask(() => { input.value = ''; page = 1; render('replace'); input.focus(); }); });
  previous.addEventListener('click', () => { page--; render('push'); status.focus(); });
  next.addEventListener('click', () => { page++; render('push'); status.focus(); });
  window.addEventListener('popstate', restore);
  window.addEventListener('pageshow', event => { if (event.persisted) restore(); });
  restore(); form.hidden = false;
  const hint = section?.querySelector<HTMLElement>('#tag-hint'); if (hint) hint.hidden = false;
}
