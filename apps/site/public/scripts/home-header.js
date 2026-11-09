(() => {
  const header = document.querySelector('.home-header-layout .header-band');
  if (!header) return;
  let pending = false;
  const synchronize = () => {
    pending = false;
    const state = window.scrollY > 24 ? 'scrolled' : 'top';
    if (header.dataset.homeHeaderState !== state) header.dataset.homeHeaderState = state;
  };
  window.addEventListener('scroll', () => {
    if (!pending) { pending = true; requestAnimationFrame(synchronize); }
  }, { passive: true });
  window.addEventListener('pageshow', synchronize);
  synchronize();
})();
