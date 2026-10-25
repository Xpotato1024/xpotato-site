// Same-origin progressive enhancement. No SDK, analytics, current URL or tool-state access.
for (const section of document.querySelectorAll('[data-page-share]')) {
  const payload = Object.freeze({ title: section.dataset.shareTitle, url: section.dataset.shareUrl });
  const status = section.querySelector('.page-share-status');
  const copy = section.querySelector('[data-share-copy]');
  const native = section.querySelector('[data-share-native]');
  const manual = section.querySelector('.page-share-manual');
  const field = manual.querySelector('input');
  let busy = false, focusVersion = 0;
  const actions = section.querySelector('.page-share-actions');
  const showHint = action => section.setAttribute('data-share-hint', action.getAttribute('aria-describedby'));
  const hideHint = () => section.removeAttribute('data-share-hint');
  for (const action of actions.querySelectorAll('a, button')) {
    action.addEventListener('pointerenter', () => { if (!actions.querySelector(':focus-visible')) showHint(action); });
    action.addEventListener('focus', () => showHint(action));
  }
  section.addEventListener('pointerleave', () => {
    const focused = actions.querySelector(':focus-visible');
    if (focused) showHint(focused); else hideHint();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && section.matches(':hover,:focus-within')) hideHint();
  });
  document.addEventListener('focusin', event => { focusVersion += 1; if (!actions.contains(event.target)) hideHint(); });
  copy.hidden = false;
  try { native.hidden = !(window.isSecureContext && typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare(payload))); } catch { native.hidden = true; }
  function selectPublicUrl(expectedFocus, expectedVersion) {
    if (document.activeElement !== expectedFocus || focusVersion !== expectedVersion || document.querySelector('dialog[open]')) return;
    field.focus({ preventScroll: true });
    field.select(); field.setSelectionRange(0, field.value.length);
    field.scrollIntoView({ block: 'nearest' });
  }
  copy.addEventListener('click', async () => {
    if (busy) return;
    const expectedFocus = document.activeElement, expectedVersion = focusVersion;
    busy = true; copy.setAttribute('aria-busy', 'true'); status.textContent = '';
    try {
      if (!window.isSecureContext || !navigator.clipboard?.writeText) throw new Error('COPY_UNAVAILABLE');
      await navigator.clipboard.writeText(payload.url);
      status.textContent = '公開 URL をコピーしました。';
    } catch {
      selectPublicUrl(expectedFocus, expectedVersion);
      status.textContent = '自動コピーできませんでした。公開 URL 欄から手動でコピーしてください。';
    } finally { busy = false; copy.removeAttribute('aria-busy'); }
  });
  native.addEventListener('click', async () => {
    if (busy) return;
    busy = true; native.setAttribute('aria-busy', 'true'); status.textContent = '';
    try { await navigator.share(payload); status.textContent = '共有メニューへ渡しました。'; }
    catch (error) {
      status.textContent = error?.name === 'AbortError' ? '共有は完了していません。' : '共有メニューを開けませんでした。X・LINE・リンクコピーをご利用ください。';
    } finally { busy = false; native.removeAttribute('aria-busy'); }
  });
}
