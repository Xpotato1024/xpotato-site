(() => {
  const button = document.querySelector('.mobile-menu-toggle');
  const panel = document.querySelector('#site-menu');
  const fallback = document.querySelector('.mobile-menu-fallback');
  const summary = fallback?.querySelector('summary');
  if (!button || !panel || !fallback || !summary) return;
  const viewport = window.matchMedia('(max-width: 1180px)');
  const supportsPopover = typeof panel.hidePopover === 'function';
  const header = document.querySelector('.header-band');
  const nav = fallback.querySelector('nav');
  const menus = [panel, nav];
  if (header) header.dataset.menuSurface = 'shared';
  const syncHeaderGeometry = () => {
    if (!header) return;
    const box = header.getBoundingClientRect(), style = document.documentElement.style;
    let bottom = box.bottom;
    for (const menu of menus) {
      if ((menu === panel ? popoverOpen() : fallback.open) || +getComputedStyle(menu).opacity > 0)
        bottom = Math.max(bottom, menu.getBoundingClientRect().bottom);
    }
    style.setProperty('--site-header-bottom', Math.max(0, box.bottom) + 'px');
    style.setProperty('--site-header-height', box.height + 'px');
    style.setProperty('--site-glass-height', bottom - box.top + 'px');
    header.dataset.menuVisible = String(bottom > box.bottom);
  };
  const popoverOpen = () => supportsPopover && panel.matches(':popover-open');
  const synchronize = (control, open) => {
    control.setAttribute('aria-expanded', String(open));
    control.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
  };
  const syncPopover = () => { panel.inert = !popoverOpen(); synchronize(button, popoverOpen()); syncHeaderGeometry(); };
  const syncFallback = () => { nav.inert = !fallback.open; synchronize(summary, fallback.open); syncHeaderGeometry(); };
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
  panel.addEventListener('beforetoggle', event => { panel.inert = event.newState === 'closed'; syncHeaderGeometry(); });
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
  for (const menu of menus) menu.addEventListener('transitionend', syncHeaderGeometry);
  if (header && typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(syncHeaderGeometry);
    [header, ...menus].forEach(element => observer.observe(element));
  }
  syncViewport();
})();
