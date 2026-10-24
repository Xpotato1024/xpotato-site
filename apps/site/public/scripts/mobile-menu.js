(() => {
  const button = document.querySelector('.mobile-menu-toggle');
  const panel = document.querySelector('#site-menu');
  const fallback = document.querySelector('.mobile-menu-fallback');
  const summary = fallback?.querySelector('summary');
  if (!button || !panel || !fallback || !summary) return;
  const viewport = window.matchMedia('(max-width: 1180px)');
  const supportsPopover = typeof panel.hidePopover === 'function';
  const header = document.querySelector('.header-band');
  const syncHeaderGeometry = () => {
    if (header) document.documentElement.style.setProperty('--site-header-bottom', Math.max(0, header.getBoundingClientRect().bottom) + 'px');
  };
  const popoverOpen = () => supportsPopover && panel.matches(':popover-open');
  const synchronize = (control, open) => {
    control.setAttribute('aria-expanded', String(open));
    control.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
  };
  const syncPopover = () => synchronize(button, popoverOpen());
  const syncFallback = () => synchronize(summary, fallback.open);
  const syncViewport = () => {
    syncHeaderGeometry();
    if (!viewport.matches) {
      if (popoverOpen()) panel.hidePopover();
      fallback.open = false;
    }
    syncPopover();
    syncFallback();
  };
  // Toggle events can coalesce during repeated input: derive from the actual state.
  panel.addEventListener('toggle', syncPopover);
  panel.addEventListener('beforetoggle', syncHeaderGeometry);
  fallback.addEventListener('toggle', syncFallback);
  document.addEventListener('click', event => {
    if (fallback.open && event.target instanceof Node && !fallback.contains(event.target)) {
      fallback.open = false;
      syncFallback();
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && fallback.open) {
      event.preventDefault();
      fallback.open = false;
      syncFallback();
      summary.focus();
    }
  });
  if (viewport.addEventListener) viewport.addEventListener('change', syncViewport);
  else viewport.addListener(syncViewport);
  window.addEventListener('pageshow', syncViewport);
  window.addEventListener('resize', syncHeaderGeometry);
  if (header && typeof ResizeObserver === 'function') new ResizeObserver(syncHeaderGeometry).observe(header);
  syncViewport();
})();
