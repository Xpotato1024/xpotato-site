// xpotato-prime-offline-v1: site shell only; never read calculator input or output.
(() => {
  const scope = '/tools/prime-factorizer/';
  if (location.pathname !== scope) return;
  const root = document.querySelector('[data-prime-offline]');
  const guide = root?.querySelector('details'), hash = '#prime-offline-guide';
  let follow = false, top = 0;
  const openGuide = () => { guide.open=true; follow=true; requestAnimationFrame(()=>{top=scrollY;}); };
  const revealGuide = () => { if (guide && location.hash === hash) openGuide(); };
  document.querySelector('[data-prime-offline-guide-link]')?.addEventListener('click', event => {
    if (guide && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) openGuide();
  });
  window.addEventListener('hashchange', revealGuide);
  revealGuide();
  const tool = document.querySelector('[data-interactive-module]');
  if (root && tool && !tool.querySelector('[data-phase]')) {
    const events = ['wheel','touchstart','pointerdown','keydown'], stop = () => { follow=false; };
    for (const name of events) window.addEventListener(name, stop, {passive: true});
    const layout = new MutationObserver(() => {
      if (!tool.querySelector('[data-phase]')) return;
      layout.disconnect();
      requestAnimationFrame(() => {
        if (follow && scrollY === top && location.hash === hash && document.activeElement === root) root.scrollIntoView({block: 'start'});
        for (const name of events) window.removeEventListener(name, stop);
      });
    });
    layout.observe(tool,{childList:true,subtree:true,attributes:true});
  }
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
    if (!await saved(registration.waiting || registration.active)) { show('保存が完了していません。インターネットに接続して、もう一度保存してください。'); return; }
    if (registration.waiting) show('更新版を保存しました。計算が終わったら、この計算機のタブとアプリをすべて閉じて開き直してください。');
    else if (registration.active) show('オフライン用に保存済みです。必要なときは、通信を切って開き直し、計算できるか確認してください。');
  }).catch(() => show('保存できているか確認できません。この画面では引き続き計算できます。'));
  show(navigator.onLine ? '保存・更新にはインターネット接続と空き容量が必要です。計算中は保存できません。' : 'インターネットに接続されていません。新しく保存・更新するときは接続してください。');
  updateButton();
  button.addEventListener('click', async () => {
    if (working || needsClose || busy() || !navigator.onLine) return;
    working = true; updateButton(); show('保存しています。このページを開いたままお待ちください。');
    try {
      if (!await navigator.serviceWorker.getRegistration(scope) && navigator.serviceWorker.controller) {
        needsClose = true; show('保存し直すには、この計算機のタブとアプリをすべて閉じ、インターネットに接続して開き直してください。'); return;
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
        show('保存に失敗し、オフライン機能を解除しました。この計算機のタブとアプリをすべて閉じ、インターネットに接続して開き直し、もう一度保存してください。'); return;
      }
      show(registration.waiting
        ? '更新版を保存しました。計算が終わったら、この計算機のタブとアプリをすべて閉じて開き直してください。'
        : '保存しました。通信を切って開き直し、計算できるか確認してください。');
    } catch {
      show('保存・更新できませんでした。インターネット接続と空き容量を確認し、もう一度お試しください。以前の保存が使える場合は、そのまま残ります。計算画面も閉じません。');
    } finally { working = false; updateButton(); }
  });
})();
