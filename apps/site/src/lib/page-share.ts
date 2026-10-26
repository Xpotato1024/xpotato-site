/** Sharing never reads the current URL, search form, tool input, result or settings. */
export const derivePageShare = (input: {
  collection: string; title: string; canonical: string; canonicalOrigin: string;
  published: boolean; noindex: boolean; preview: boolean;
}) => {
  if (!['blog', 'notes', 'tools'].includes(input.collection) || !input.published || input.noindex || input.preview) return undefined;
  let url: URL, origin: URL;
  try { url = new URL(input.canonical); origin = new URL(input.canonicalOrigin); } catch { return undefined; }
  if (url.protocol !== 'https:' || origin.protocol !== 'https:' || url.origin !== origin.origin || url.username || url.password || !url.pathname.startsWith(`/${input.collection}/`)) return undefined;
  url.search = ''; url.hash = '';
  const title = input.title.trim();
  if (!title) return undefined;
  const x = new URL('https://x.com/intent/tweet');
  const line = new URL('https://social-plugins.line.me/lineit/share');
  for (const target of [x, line]) { target.searchParams.set('text', title); target.searchParams.set('url', url.href); }
  return { title, url: url.href, x: x.href, line: line.href };
};
