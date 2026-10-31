// Public canonical URL only; no state collection or network dependency.
for (const section of document.querySelectorAll('[data-page-share]')) {
  const payload = Object.freeze({ title: section.dataset.shareTitle, url: section.dataset.shareUrl });
  const status = section.querySelector('.page-share-status');
  const copy = section.querySelector('[data-share-copy]');
  const native = section.querySelector('[data-share-native]');
  const manual = section.querySelector('.page-share-manual');
  const field = manual.querySelector('input');
  let copying = false, sharing = false, focusVersion = 0, feedback = 0;
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
  field.addEventListener('click', () => { feedback++; });
  function selectPublicUrl(expectedFocus, expectedVersion) {
    if (document.activeElement !== expectedFocus || focusVersion !== expectedVersion || document.querySelector('dialog[open]')) return;
    field.focus({ preventScroll: true });
    field.select(); field.setSelectionRange(0, field.value.length);
    field.scrollIntoView({ block: 'nearest' });
  }
  copy.addEventListener('click', async () => {
    if (copying) return;
    const expectedFocus = document.activeElement, expectedVersion = focusVersion, token = ++feedback;
    copying = true; copy.setAttribute('aria-busy', 'true'); status.textContent = '';
    try {
      if (!window.isSecureContext || !navigator.clipboard?.writeText) throw new Error('UNSUPPORTED');
      // Preserve the click's activation before awaiting.
      const write = navigator.clipboard.writeText(payload.url);
      status.textContent = 'コピー中です。応答がない場合は公開 URL 欄を長押ししてください。';
      await write;
      if (token === feedback) status.textContent = '公開 URL をコピーしました。';
    } catch (error) {
      if (token !== feedback) return;
      selectPublicUrl(expectedFocus, expectedVersion);
      status.textContent = (error?.name === 'NotAllowedError' ? 'コピーが拒否されました。' : 'コピーを利用できません。') + '公開 URL 欄を長押しでコピーできます。';
    } finally { copying = false; copy.removeAttribute('aria-busy'); }
  });
  native.addEventListener('click', async () => {
    if (sharing) return;
    const token = ++feedback;
    sharing = true; native.setAttribute('aria-busy', 'true'); status.textContent = '';
    try { await navigator.share(payload); if (token === feedback) status.textContent = '共有メニューへ渡しました。'; }
    catch (error) {
      if (token === feedback) status.textContent = error?.name === 'AbortError' ? '共有は完了していません。' : (error?.name === 'NotAllowedError' ? '共有が拒否されました。' : '共有を利用できません。') + 'X・LINE・公開 URL 欄をご利用ください。';
    } finally { sharing = false; native.removeAttribute('aria-busy'); }
  });
}
