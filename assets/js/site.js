/* Aevox — shared behaviour for every page */
(() => {
  // ---------------------------------------------------------------------------
  // Store links. Paste the real listing URLs here; every download button on
  // every page picks them up automatically.
  // ---------------------------------------------------------------------------
  const STORE_LINKS = {
    ios: 'https://apps.apple.com/us/app/aevox/id6760921113',
    android: 'https://play.google.com/store/apps/details?id=com.aevox.aevox',
  };

  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const platform = isIOS ? 'ios' : isAndroid ? 'android' : null;
  document.documentElement.classList.remove('no-js');
  if (platform) document.documentElement.dataset.platform = platform;

  const fallback = document.getElementById('download') ? '#download' : '/#download';

  document.querySelectorAll('[data-store]').forEach((a) => {
    let which = a.dataset.store;
    if (which === 'auto') which = platform;
    const url = which && STORE_LINKS[which];
    if (url) {
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
    } else if (a.getAttribute('href') === '#download') {
      a.setAttribute('href', fallback);
    }
  });

  // Cursor-follow glow on store buttons and pricing cards
  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest && e.target.closest('.store-btn, .plan');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------
  const nav = document.querySelector('[data-nav]');
  // Only Chromium applies SVG filters to backdrop-filter; others keep the frosted version
  const isChromium = !!(navigator.userAgentData && navigator.userAgentData.brands.some((b) => /Chromium/.test(b.brand)));
  if (isChromium) document.documentElement.classList.add('lg-refract');
  if (nav) {
    nav.addEventListener('pointermove', (e) => {
      nav.style.setProperty('--gx', `${e.clientX}px`);
    }, { passive: true });
  }
  const onScroll = () => nav && nav.classList.toggle('is-scrolled', window.scrollY > 12);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Legal dropdown
  const legalBtn = document.querySelector('[data-legal-toggle]');
  const legalMenu = document.getElementById('legal-menu');
  if (legalBtn && legalMenu) {
    const set = (open) => {
      legalBtn.setAttribute('aria-expanded', String(open));
      legalMenu.hidden = !open;
    };
    legalBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      set(legalMenu.hidden);
    });
    document.addEventListener('click', (e) => {
      if (!legalMenu.hidden && !legalMenu.contains(e.target)) set(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !legalMenu.hidden) { set(false); legalBtn.focus(); }
    });
    const here = location.pathname.replace(/\/$/, '');
    legalMenu.querySelectorAll('a').forEach((a) => {
      if (a.getAttribute('href') === here) a.setAttribute('aria-current', 'page');
    });
  }

  // Mobile menu
  const menuBtn = document.querySelector('[data-menu-toggle]');
  const menu = document.querySelector('[data-menu]');
  if (menuBtn && menu) {
    const set = (open) => {
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      menu.classList.toggle('is-open', open);
      document.body.classList.toggle('menu-open', open);
    };
    menuBtn.addEventListener('click', () => set(!menu.classList.contains('is-open')));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('is-open')) set(false); });
    window.matchMedia('(min-width: 961px)').addEventListener('change', (m) => m.matches && set(false));
  }

  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  // ---------------------------------------------------------------------------
  // Legal pages: table of contents with scroll-spy
  // ---------------------------------------------------------------------------
  const body = document.querySelector('.legal-body');
  const toc = document.querySelector('[data-toc]');
  if (body && toc) {
    const heads = [...body.querySelectorAll('h2')];
    const slug = (t) => t.toLowerCase().replace(/^\d+\.\s*/, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const links = heads.map((h) => {
      if (!h.id) h.id = slug(h.textContent);
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#${h.id}`;
      a.textContent = h.textContent.replace(/^\d+\.\s*/, '');
      li.appendChild(a);
      toc.appendChild(li);
      return a;
    });
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const i = heads.indexOf(en.target);
        links.forEach((l, j) => l.classList.toggle('is-active', i === j));
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    heads.forEach((h) => spy.observe(h));
  }
})();
