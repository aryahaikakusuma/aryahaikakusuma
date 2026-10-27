(() => {
  'use strict';

  const root = document.documentElement;
  const toggle = document.getElementById('theme-toggle');

  // projects: let the wheel scroll the plates sideways
  const plates = document.querySelector('.plates');
  if (plates) {
    plates.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = plates.scrollWidth - plates.clientWidth;
      const next = plates.scrollLeft + e.deltaY;
      if (next < 0 || next > max) return;   // at either end, let the page scroll
      e.preventDefault();
      plates.scrollLeft = next;
    }, { passive: false });
  }

  // cursor light: a soft glow across the whole page that trails the pointer
  const RESPECT_REDUCED_MOTION = false;   // motion plays even when the OS asks for less, by the site owner's choice
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  if (matchMedia('(hover: hover) and (pointer: fine)').matches && !(RESPECT_REDUCED_MOTION && reducedMotion.matches)) {
    const glow = document.createElement('div');
    glow.className = 'cursor-glow';
    glow.setAttribute('aria-hidden', 'true');
    document.body.append(glow);

    const R = 320;                          // the glow is a disc of radius R
    let tx = 0, ty = 0, gx = 0, gy = 0, raf = 0, seen = false;

    const tick = () => {
      gx += (tx - gx) * 0.12; gy += (ty - gy) * 0.12;
      glow.style.transform = `translate3d(${gx - R}px, ${gy - R}px, 0)`;
      raf = Math.abs(tx - gx) < 0.3 && Math.abs(ty - gy) < 0.3 ? 0 : requestAnimationFrame(tick);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };

    addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      tx = e.clientX; ty = e.clientY;
      if (!seen) { seen = true; gx = tx; gy = ty; glow.classList.add('on'); }
      kick();
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => glow.classList.remove('on'));
    document.documentElement.addEventListener('mouseenter', () => { if (seen) glow.classList.add('on'); });
  }

  if (!toggle) return;

  const dark = matchMedia('(prefers-color-scheme: dark)');
  const reduced = reducedMotion;
  const current = () => root.dataset.theme || (dark.matches ? 'dark' : 'light');

  const label = () => {
    toggle.setAttribute('aria-label', current() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  };

  const apply = (theme) => {
    root.dataset.theme = theme;
    try { localStorage.setItem('theme', theme); } catch (e) {}
    label();
    window.dispatchEvent(new Event('themechange'));
  };

  toggle.addEventListener('click', (e) => {
    const next = current() === 'dark' ? 'light' : 'dark';
    if (!document.startViewTransition || (RESPECT_REDUCED_MOTION && reduced.matches)) { apply(next); return; }

    const r = toggle.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

    root.dataset.transition = 'theme';
    const t = document.startViewTransition(() => apply(next));
    t.finished.finally(() => { delete root.dataset.transition; });
    t.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 800, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(() => {});
  });

  dark.addEventListener('change', () => {
    if (!root.dataset.theme) { label(); window.dispatchEvent(new Event('themechange')); }
  });
  label();
})();
