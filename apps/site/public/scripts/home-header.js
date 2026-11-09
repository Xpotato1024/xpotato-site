(() => {
  const header = document.querySelector('.home-header-layout .header-band');
  if (!header) return;
  const root = document.body;
  const menus = [...header.querySelectorAll('.mobile-menu-panel, .mobile-menu-fallback nav')];
  let pending = false;
  const synchronize = () => {
    pending = false;
    const state = window.scrollY > 24 ? 'scrolled' : 'top';
    if (header.dataset.homeHeaderState !== state) header.dataset.homeHeaderState = state;
  };
  const measure = () => {
    const box = header.getBoundingClientRect();
    root.style.setProperty('--home-header-height', box.height + 'px');
    let bottom = box.bottom;
    for (const menu of menus) {
      if (menu.matches('.mobile-menu-fallback[open] nav') || (menu.hidePopover && menu.matches(':popover-open')) || +getComputedStyle(menu).opacity > 0)
        bottom = Math.max(bottom, menu.getBoundingClientRect().bottom);
    }
    root.style.setProperty('--home-glass-height', bottom - box.top + 'px');
    synchronize();
  };
  for (const menu of menus) {
    (menu.closest('.mobile-menu-fallback') || menu).addEventListener('toggle', measure);
    menu.addEventListener('transitionend', measure);
  }
  window.addEventListener('scroll', () => {
    if (!pending) { pending = true; requestAnimationFrame(synchronize); }
  }, { passive: true });
  window.addEventListener('resize', measure);
  window.addEventListener('pageshow', measure);
  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(measure);
    [header, ...menus].forEach(element => observer.observe(element));
  }
  measure();
})();
