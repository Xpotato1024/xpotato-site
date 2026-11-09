(() => {
  const header = document.querySelector('.home-header-layout .header-band');
  if (!header) return;
  const root = document.body;
  let pending = false;
  const synchronize = () => {
    pending = false;
    const state = window.scrollY > 24 ? 'scrolled' : 'top';
    if (header.dataset.homeHeaderState !== state) header.dataset.homeHeaderState = state;
  };
  const measure = () => {
    root.style.setProperty('--home-header-height', header.getBoundingClientRect().height + 'px');
    synchronize();
  };
  window.addEventListener('scroll', () => {
    if (!pending) { pending = true; requestAnimationFrame(synchronize); }
  }, { passive: true });
  window.addEventListener('resize', measure);
  window.addEventListener('pageshow', measure);
  if (typeof ResizeObserver === 'function') new ResizeObserver(measure).observe(header);
  measure();
})();
