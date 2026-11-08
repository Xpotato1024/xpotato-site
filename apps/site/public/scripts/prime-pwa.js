// xpotato-prime-offline-v1: site shell only; never read calculator input or output.
(() => {
  const scope = '/tools/prime-factorizer/';
  if (location.pathname !== scope) return;
  const root = document.querySelector('[data-prime-offline]');
  const button = root?.querySelector('[data-prime-offline-save]');
  const status = root?.querySelector('[data-prime-offline-status]');
  if (!root || !button || !status || !isSecureContext || !('serviceWorker' in navigator)) return;
  let working = false, needsClose = false;
  const saved = worker => new Promise((resolve, reject) => {
    if (!worker) { resolve(false); return; }
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); reject(Error('status')); }, 5000);
    channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); resolve(event.data?.complete === true); };
    worker.postMessage('PRIME_OFFLINE_STATUS', [channel.port2]);
  });
  const busy = () => [...document.querySelectorAll('.bt-prime-factorizer')].some(el => ['running', 'cancelling', 'starting'].includes(el.dataset.phase));
  const show = text => { status.textContent = text; };
  const updateButton = () => { button.disabled = working || needsClose || busy() || !navigator.onLine; };
  const observe = new MutationObserver(updateButton);
  observe.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-phase'] });
  window.addEventListener('online', updateButton);
  window.addEventListener('offline', updateButton);
  // Reading the local registration does not install/update it or make a fetch.
  navigator.serviceWorker.getRegistration(scope).then(async registration => {
    if (registration?.scope !== new URL(scope, location.origin).href) return;
    if (!await saved(registration.waiting || registration.active)) { show('保存が完全ではありません。オンラインで保存し直してください。'); return; }
    if (registration.waiting) show('更新版を保存しました。計算終了後、このツールのタブとアプリをすべて閉じ、開き直してください。');
    else if (registration.active) show('オフライン用の保存があります。保存が消去されることもあるため、必要なときは通信を切って起動を確認してください。');
  }).catch(() => show('保存状態を確認できません。通常の計算はそのまま使えます。'));
  show(navigator.onLine ? '保存・更新には通信と端末の空き容量を使います。計算中は保存できません。' : '通信がありません。新しい保存・更新にはオンライン接続が必要です。');
  updateButton();
  button.addEventListener('click', async () => {
    if (working || needsClose || busy() || !navigator.onLine) return;
    working = true; updateButton(); show('アプリのファイルを保存しています。このページを開いたままお待ちください。');
    try {
      if (!await navigator.serviceWorker.getRegistration(scope) && navigator.serviceWorker.controller) {
        needsClose = true; show('保存し直す前に、このツールのタブとアプリをすべて閉じ、オンラインで開き直してください。'); return;
      }
      const registration = await navigator.serviceWorker.register(scope + 'sw.js', { scope, updateViaCache: 'none' });
      await registration.update();
      const worker = registration.installing;
      if (worker) await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { worker.removeEventListener('statechange', changed); reject(Error('timeout')); }, 120000);
        const changed = () => {
          if (['installed', 'activated', 'redundant'].includes(worker.state)) {
            clearTimeout(timer); worker.removeEventListener('statechange', changed);
            if (worker.state === 'redundant') reject(Error('install')); else resolve();
          }
        };
        worker.addEventListener('statechange', changed); changed();
      });
      if (!await saved(registration.waiting || registration.active)) {
        await registration.unregister(); needsClose = true;
        show('保存が完全ではないためオフライン機能を解除しました。このツールのタブとアプリをすべて閉じ、オンラインで開き直して保存してください。'); return;
      }
      show(registration.waiting
        ? '更新版を保存しました。計算終了後、このツールのタブとアプリをすべて閉じ、開き直してください。'
        : '保存しました。次回からオフラインで開けます。ホーム画面のアプリは別の保存領域になる場合があるため、そちらでもオンラインで一度開いて保存してください。');
    } catch {
      show('保存・更新できませんでした。通信や空き容量を確認して再試行してください。利用できる以前の保存と現在の計算画面は維持します。');
    } finally { working = false; updateButton(); }
  });
})();
