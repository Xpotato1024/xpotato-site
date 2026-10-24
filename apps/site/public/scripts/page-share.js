// Same-origin progressive enhancement. No SDK, analytics, current URL or tool-state access.
for (const section of document.querySelectorAll('[data-page-share]')) {
  const payload = Object.freeze({ title: section.dataset.shareTitle, url: section.dataset.shareUrl });
  const status = section.querySelector('.page-share-status');
  const copy = section.querySelector('[data-share-copy]');
  const native = section.querySelector('[data-share-native]');
  const manual = section.querySelector('.page-share-manual');
  const field = manual.querySelector('input');
  let busy = false;
  copy.hidden = false;
  try { native.hidden = !(window.isSecureContext && typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare(payload))); } catch { native.hidden = true; }
  function selectPublicUrl() {
    manual.open = true;
    field.focus({ preventScroll: true });
    field.select(); field.setSelectionRange(0, field.value.length);
    field.scrollIntoView({ block: 'nearest' });
  }
  copy.addEventListener('click', async () => {
    if (busy) return;
    busy = true; copy.setAttribute('aria-busy', 'true'); status.textContent = '';
    try {
      if (!window.isSecureContext || !navigator.clipboard?.writeText) throw new Error('COPY_UNAVAILABLE');
      await navigator.clipboard.writeText(payload.url);
      status.textContent = '公開 URL をコピーしました。';
    } catch {
      selectPublicUrl();
      status.textContent = '自動コピーできませんでした。選択した公開 URL を手動でコピーしてください。';
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
