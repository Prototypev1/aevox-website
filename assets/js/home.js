/* Aevox — landing page: ocean, whale, depth, live feed, steps, sonar */
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const MAX_DEPTH = 4000;

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const fmtDepth = (m) => Math.round(m).toLocaleString('en-US');

  // ---------------------------------------------------------------------------
  // Layout cache (recomputed on resize / font load)
  // ---------------------------------------------------------------------------
  let W = window.innerWidth;
  let H = window.innerHeight;
  let docH = 1;
  const wake = $('.wake');
  const whale = $('[data-whale]');
  let wakeTop = 0;
  let wakeH = 1;
  const depthLabels = $$('[data-depth-label]');

  const absTop = (el) => el.getBoundingClientRect().top + window.scrollY;

  function measure() {
    W = window.innerWidth;
    H = window.innerHeight;
    docH = Math.max(1, document.documentElement.scrollHeight - H);
    if (wake) { wakeTop = absTop(wake); wakeH = wake.offsetHeight; }
    depthLabels.forEach((el) => {
      const section = el.closest('section');
      const d = clamp((absTop(section) - H * 0.25) / docH) * MAX_DEPTH;
      el.dataset.depth = `${fmtDepth(Math.round(d / 10) * 10)} m`;
    });
  }

  // ---------------------------------------------------------------------------
  // Ocean canvas
  // ---------------------------------------------------------------------------
  const canvas = $('.ocean');
  const ctx = canvas.getContext('2d');
  let dpr = 1;
  let particles = [];
  const bubbles = [];

  const STOPS = [
    [0.0, [43, 39, 118], [20, 18, 62]],
    [0.08, [28, 25, 82], [14, 13, 46]],
    [0.25, [15, 14, 46], [10, 9, 30]],
    [0.55, [9, 8, 26], [6, 6, 17]],
    [1.0, [4, 4, 11], [3, 3, 7]],
  ];
  const mix = (a, b, t) => a.map((v, i) => Math.round(lerp(v, b[i], t)));
  function depthColors(d) {
    for (let i = 1; i < STOPS.length; i++) {
      if (d <= STOPS[i][0]) {
        const [d0, t0, b0] = STOPS[i - 1];
        const [d1, t1, b1] = STOPS[i];
        const t = (d - d0) / (d1 - d0);
        return [mix(t0, t1, t), mix(b0, b1, t)];
      }
    }
    return [STOPS[STOPS.length - 1][1], STOPS[STOPS.length - 1][2]];
  }

  function sprite(r, color, core) {
    const c = document.createElement('canvas');
    c.width = c.height = r * 2;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, core);
    grad.addColorStop(0.25, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, r * 2, r * 2);
    return c;
  }
  const SPR_DOT = sprite(16, 'rgba(210,205,255,0.5)', 'rgba(255,255,255,0.95)');
  const SPR_VIOLET = sprite(32, 'rgba(140,124,255,0.45)', 'rgba(230,226,255,1)');
  const SPR_TEAL = sprite(32, 'rgba(98,227,209,0.4)', 'rgba(220,255,250,1)');

  function buildParticles() {
    const n = Math.round(clamp((W * H) / 11000, 40, W <= 900 ? 60 : 150));
    particles = Array.from({ length: n }, () => {
      const z = 0.25 + Math.random() * 0.75;
      const glow = Math.random() < 0.16;
      return {
        x: Math.random(), y: Math.random(), z,
        r: glow ? 3 + Math.random() * 5 : (0.6 + Math.random() * 1.3) * z,
        vy: (2 + Math.random() * 6) * z, // px per second, slow sink
        ph: Math.random() * Math.PI * 2,
        tw: 0.4 + Math.random() * 1.2,
        glow, teal: Math.random() < 0.45,
      };
    });
  }

  let lastW = 0;
  function resizeCanvas() {
    // the background is soft anyway; phones draw it at 1x to keep scrolling smooth
    dpr = Math.min(window.devicePixelRatio || 1, W <= 900 ? 1 : 1.5);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (Math.abs(W - lastW) > 40 || !particles.length) { buildParticles(); lastW = W; }
  }

  function emitBubbles(x, y, n, spread = 20) {
    if (reduceMotion) return;
    for (let i = 0; i < n && bubbles.length < 140; i++) {
      bubbles.push({
        x: x + (Math.random() - 0.5) * spread,
        y: y + (Math.random() - 0.5) * spread * 0.6,
        r: 1.2 + Math.random() * 4,
        vy: 30 + Math.random() * 60,
        ph: Math.random() * 6.28,
        life: 1,
        decay: 0.25 + Math.random() * 0.35,
      });
    }
  }

  function drawOcean(t, dt, sy) {
    const d = clamp(sy / docH);
    const [top, bot] = depthColors(d);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgb(${top})`);
    g.addColorStop(1, `rgb(${bot})`);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Sunlight from the surface: rays + glow, fading as we descend
    const sun = clamp(1 - sy / (H * 1.8));
    if (sun > 0.01) {
      ctx.globalCompositeOperation = 'lighter';
      const lift = -sy * 0.45;
      const glow = ctx.createRadialGradient(W * 0.62, lift - H * 0.15, 0, W * 0.62, lift - H * 0.15, Math.max(W, H) * 0.9);
      glow.addColorStop(0, `rgba(150,135,255,${0.32 * sun})`);
      glow.addColorStop(1, 'rgba(150,135,255,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);

      for (let i = 0; i < 6; i++) {
        const sway = Math.sin(t * 0.00022 * (1 + i * 0.17) + i * 2.1);
        const x = W * (0.12 + i * 0.165) + sway * W * 0.035;
        const tw = 26 + (i % 3) * 34;
        const bw = tw * 4.2;
        const skew = W * 0.1 + sway * 20;
        const len = H * 1.05;
        const a = 0.085 * sun * (0.55 + 0.45 * Math.sin(t * 0.0006 + i * 1.7));
        const rg = ctx.createLinearGradient(0, lift, 0, lift + len);
        rg.addColorStop(0, `rgba(205,196,255,${a})`);
        rg.addColorStop(0.6, `rgba(160,150,255,${a * 0.35})`);
        rg.addColorStop(1, 'rgba(160,150,255,0)');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.moveTo(x - tw / 2, lift - 10);
        ctx.lineTo(x + tw / 2, lift - 10);
        ctx.lineTo(x + skew + bw / 2, lift + len);
        ctx.lineTo(x + skew - bw / 2, lift + len);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Particles: marine snow + bioluminescence
    ctx.globalCompositeOperation = 'lighter';
    const glowStrength = clamp((d - 0.08) * 1.8);
    const span = H + 60;
    for (const p of particles) {
      let y = (p.y * span + (t / 1000) * p.vy - sy * p.z * 0.55) % span;
      if (y < 0) y += span;
      y -= 30;
      const x = p.x * W + Math.sin(t * 0.0003 * p.tw + p.ph) * 14 * p.z;
      if (p.glow) {
        if (glowStrength <= 0.02) continue;
        const pulse = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(t * 0.0012 * p.tw + p.ph), 3);
        ctx.globalAlpha = glowStrength * pulse * 0.9;
        const s = p.r * 3.2;
        ctx.drawImage(p.teal ? SPR_TEAL : SPR_VIOLET, x - s, y - s, s * 2, s * 2);
      } else {
        ctx.globalAlpha = (0.18 + 0.32 * p.z) * (1 - d * 0.35);
        const s = p.r * 2.2;
        ctx.drawImage(SPR_DOT, x - s, y - s, s * 2, s * 2);
      }
    }

    // Bubbles from the whale
    if (bubbles.length) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = 1;
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        b.life -= b.decay * dt;
        if (b.life <= 0) { bubbles.splice(i, 1); continue; }
        b.y -= b.vy * dt;
        const x = b.x + Math.sin(t * 0.004 + b.ph) * 3;
        ctx.globalAlpha = Math.min(1, b.life * 1.4) * 0.6;
        ctx.strokeStyle = 'rgba(200,195,255,0.9)';
        ctx.beginPath();
        ctx.arc(x, b.y, b.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillRect(x - b.r * 0.4, b.y - b.r * 0.5, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------------------------------------------------------------------------
  // Depth gauge + nav readout
  // ---------------------------------------------------------------------------
  const gauge = $('.gauge');
  const gaugeVal = $('[data-depth-value]');
  const gaugeZone = $('[data-depth-zone]');
  const navDepth = $('[data-depth-readout]');
  let lastDepth = -1;
  const zoneFor = (m) => (m < 200 ? 'Sunlight zone' : m < 1000 ? 'Twilight zone' : m < 3990 ? 'Midnight zone' : 'Abyssal zone');

  function updateDepth(sy) {
    const p = clamp(sy / (docH - 2));
    const m = Math.round(p * MAX_DEPTH);
    if (m === lastDepth) return;
    lastDepth = m;
    gauge.style.setProperty('--p', p.toFixed(4));
    gauge.classList.toggle('is-on', sy > H * 0.35);
    gaugeVal.textContent = fmtDepth(m);
    gaugeZone.textContent = zoneFor(m);
    if (navDepth) navDepth.textContent = `${fmtDepth(m)} m`;
  }

  // ---------------------------------------------------------------------------
  // Hero: phone tilt + sink on scroll
  // ---------------------------------------------------------------------------
  // Give every phone mock a real edge (see .phone-sides in home.css)
  $$('.phone').forEach((ph) => {
    const sides = document.createElement('div');
    sides.className = 'phone-sides';
    sides.setAttribute('aria-hidden', 'true');
    const N = 16;
    for (let k = 1; k <= N; k++) {
      const layer = document.createElement('i');
      layer.style.setProperty('--k', k);
      // brushed-metal shading: brightest along the middle of the edge
      layer.style.setProperty('--l', `${(18 + 22 * Math.sin((Math.PI * k) / (N + 1))).toFixed(1)}%`);
      if (k > 4 && k < N - 3) layer.className = 'btns';
      sides.appendChild(layer);
    }
    ph.prepend(sides);
  });

  const heroCopy = $('.hero-copy');
  const heroPhone = $('[data-tilt]');
  const heroHolder = $('[data-phone-holder]');
  const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  if (finePointer && !reduceMotion) {
    window.addEventListener('pointermove', (e) => {
      tilt.tx = (e.clientX / W - 0.5) * 16;
      tilt.ty = (e.clientY / H - 0.5) * -10;
    }, { passive: true });
  }

  // On phones the hero phone just scrolls with the page: per-frame transforms there
  // lag behind touch scrolling (it stepped) and pulled it away from its notification.
  const smallScreen = window.matchMedia('(max-width: 900px)');
  function updateHero(sy) {
    if (smallScreen.matches) {
      if (!tilt.static) {
        tilt.static = true;
        heroCopy.style.transform = '';
        heroCopy.style.opacity = '';
        heroPhone.style.transform = '';
        heroHolder.style.opacity = '';
      }
      return;
    }
    tilt.static = false;
    const hp = clamp(sy / H);
    if (hp >= 1 && tilt.done) return;
    tilt.done = hp >= 1;
    tilt.x += (tilt.tx - tilt.x) * 0.06;
    tilt.y += (tilt.ty - tilt.y) * 0.06;
    heroCopy.style.transform = `translate3d(0, ${(-hp * 70).toFixed(1)}px, 0)`;
    heroCopy.style.opacity = (1 - hp * 1.15).toFixed(3);
    heroPhone.style.transform =
      `translate3d(0, ${(hp * 140).toFixed(1)}px, 0) rotateX(${(6 + hp * 26 + tilt.y).toFixed(2)}deg) rotateY(${(-24 + tilt.x + hp * 30).toFixed(2)}deg) rotateZ(${(-hp * 7).toFixed(2)}deg) scale(${(1 - hp * 0.16).toFixed(3)})`;
    heroHolder.style.opacity = (1 - hp * 0.75).toFixed(3);
  }

  // ---------------------------------------------------------------------------
  // Whale pass
  // ---------------------------------------------------------------------------
  const wakeText = $('[data-wake-text]');
  let wakeWords = [];
  if (wakeText) {
    const words = wakeText.textContent.trim().split(/\s+/);
    const hlFrom = words.length - 4;
    wakeText.innerHTML = words.map((w, i) => `<span class="wd${i >= hlFrom ? ' hl' : ''}">${w}</span>`).join(' ');
    wakeWords = $$('.wd', wakeText);
  }
  let lastWakeP = -1;
  let wakeNear = false;

  // When a nav link scrolls the page for the visitor, the whale would just
  // flash past mid-jump. Hide it until the scroll settles.
  let jumping = false;
  let jumpTimer = null;
  const root = document.documentElement;
  let glide = null;
  function endJump() {
    if (!jumping || glide) return;
    jumping = false;
    clearTimeout(jumpTimer);
    root.classList.remove('is-jumping');
  }
  function startJump() {
    jumping = true;
    root.classList.add('is-jumping');
    clearTimeout(jumpTimer);
    jumpTimer = setTimeout(() => { glide = null; endJump(); }, 4000); // safety net
  }
  function stopGlide() {
    if (!glide) return;
    cancelAnimationFrame(glide.raf);
    glide = null;
    endJump();
  }
  // the visitor taking over (wheel, touch, keys) cancels the glide
  ['wheel', 'touchstart', 'keydown'].forEach((ev) => window.addEventListener(ev, stopGlide, { passive: true }));

  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function glideTo(target) {
    // "virtual" scroll positions leave out the pinned whale stretch
    const pinStart = wakeTop;
    const pinLen = wake ? Math.max(0, wakeH - H) : 0;
    const toV = (y) => (y <= pinStart ? y : y >= pinStart + pinLen ? y - pinLen : pinStart);
    const fromV = (v) => (v <= pinStart ? v : v + pinLen);
    const v0 = toV(window.scrollY);
    const v1 = toV(target);
    const dist = Math.abs(v1 - v0);
    const dur = clamp(700 + dist * 0.07, 700, 1500);
    const t0 = performance.now();
    stopGlide();
    startJump();
    glide = { raf: 0 };
    const step = (now) => {
      if (!glide) return;
      const t = clamp((now - t0) / dur);
      const y = t < 1 ? fromV(v0 + (v1 - v0) * easeInOut(t)) : target;
      window.scrollTo({ top: y, behavior: 'instant' });
      if (t < 1) { glide.raf = requestAnimationFrame(step); return; }
      glide = null;
      requestAnimationFrame(endJump);
    };
    glide.raf = requestAnimationFrame(step);
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href*="#"]');
    if (!a || a.origin !== location.origin || a.pathname !== location.pathname || !a.hash) return;
    const el = document.getElementById(a.hash.slice(1));
    if (!el || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    const pad = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
    const target = el.id === 'top' ? 0 : Math.max(0, el.getBoundingClientRect().top + window.scrollY - pad);
    if (history.pushState) history.pushState(null, '', a.hash);
    // let the destination already be fully drawn when we arrive
    const section = el.closest('section') || el;
    [section, ...section.querySelectorAll('[data-reveal], [data-split]')].forEach((n) => n.classList.add('in'));
    if (reduceMotion) { window.scrollTo(0, target); return; }
    glideTo(target);
  });
  if ('onscrollend' in window) {
    window.addEventListener('scrollend', endJump);
  } else {
    let idle = null;
    window.addEventListener('scroll', () => {
      if (!jumping) return;
      clearTimeout(idle);
      idle = setTimeout(endJump, 160);
    }, { passive: true });
  }

  // The art faces left. face -1 = swimming left (scrolling down), +1 = swimming right (scrolling up).
  // He always moves head-first and only turns around while he's out of sight.
  const whaleState = { x: null, face: -1 };

  function updateWhale(sy) {
    if (!wake || reduceMotion) return;
    const p = clamp((sy - wakeTop) / Math.max(1, wakeH - H));
    const near = !(sy + H < wakeTop - 50 || sy > wakeTop + wakeH + 50);
    if (near !== wakeNear) { wakeNear = near; wake.classList.toggle('is-near', near); }
    const ww = whale.offsetWidth;
    const wh = ww * (420 / 1010);
    const right = W * 1.02;   // parked just off the right edge
    const left = -ww * 1.08;  // parked just off the left edge

    if (!near) {
      // wait off-screen on the side he'll enter from next
      if (sy < wakeTop) { whaleState.x = right; whaleState.face = -1; } else { whaleState.x = left; whaleState.face = 1; }
      lastWakeP = p;
      return;
    }
    if (jumping) { lastWakeP = p; return; }
    if (whaleState.x === null) whaleState.x = lerp(right, left, p);

    const dp = lastWakeP < 0 ? 0 : p - lastWakeP;
    lastWakeP = p;
    if (dp !== 0) {
      const want = dp > 0 ? -1 : 1;
      const hidden = whaleState.x >= right - 1 || whaleState.x <= left + 1;
      if (hidden) {
        // out of sight: turn to match the scroll and come in from that side
        whaleState.face = want;
        whaleState.x = want === -1 ? right : left;
      }
      // one full crossing per full pass through the pinned section
      whaleState.x = clamp(whaleState.x + whaleState.face * Math.abs(dp) * (right - left), left, right);
    }

    const x = whaleState.x;
    const bob = Math.sin(p * Math.PI * 3) * H * 0.018;
    const rot = Math.cos(p * Math.PI * 3) * 1.6;
    whale.style.transform = `translate3d(${x.toFixed(1)}px, calc(-50% + ${bob.toFixed(1)}px), 0) rotate(${rot.toFixed(2)}deg)${whaleState.face === 1 ? ' scaleX(-1)' : ''}`;

    const moved = Math.abs(dp);
    if (moved > 0.0005) {
      const topY = H * 0.36 + 40 - wh / 2 + bob;
      const head = whaleState.face === -1 ? 0.15 : 0.85;
      const tail = whaleState.face === -1 ? 0.97 : 0.03;
      // blowhole trickle + wake behind the flukes
      emitBubbles(x + ww * head, topY + wh * 0.3, Math.min(4, 1 + moved * 120), 14);
      emitBubbles(x + ww * tail, topY + wh * 0.45, Math.min(6, 1 + moved * 220), 40);
    }

    const n = wakeWords.length;
    wakeWords.forEach((w, i) => w.classList.toggle('on', p > 0.08 + (i / n) * 0.62));
  }

  // ---------------------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------------------
  let lastT = performance.now();
  function frame(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    const sy = window.scrollY;
    drawOcean(t, dt, sy);
    updateDepth(sy);
    updateHero(sy);
    updateWhale(sy);
    if (!reduceMotion) requestAnimationFrame(frame);
  }

  function onResize() {
    measure();
    resizeCanvas();
    tilt.done = false;
    if (reduceMotion) frame(performance.now());
  }
  window.addEventListener('resize', onResize);
  if (reduceMotion) window.addEventListener('scroll', () => frame(performance.now()), { passive: true });
  new ResizeObserver(() => { measure(); }).observe(document.body);
  if (document.fonts) document.fonts.ready.then(measure);
  measure();
  resizeCanvas();
  requestAnimationFrame(frame);

  // ---------------------------------------------------------------------------
  // Split headings into words + reveal on scroll
  // ---------------------------------------------------------------------------
  $$('[data-split]').forEach((el) => {
    let i = 0;
    const wrapText = (node) => {
      const frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
        const w = document.createElement('span');
        w.className = 'w';
        const inner = document.createElement('span');
        inner.textContent = part;
        inner.style.setProperty('--wi', i++);
        w.appendChild(inner);
        frag.appendChild(w);
      });
      node.replaceWith(frag);
    };
    const walk = (node) => [...node.childNodes].forEach((c) => (c.nodeType === 3 ? wrapText(c) : walk(c)));
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    walk(el);
    [...el.children].forEach((c) => c.setAttribute('aria-hidden', 'true'));
  });

  const revealer = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('in'); revealer.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
  $$('[data-reveal], [data-split]').forEach((el) => revealer.observe(el));

  // ---------------------------------------------------------------------------
  // Hero live feed
  // ---------------------------------------------------------------------------
  const feed = $('[data-feed]');
  const floatAlert = $('[data-float-alert]');
  const FEED = [
    { k: 'buy', av: 'E', name: 'Early PEPE buyer', amt: '+$142K', sub: '35,986,410,000 PEPE', tag: '↑ Bought PEPE', meta: 'paid 60 ETH', chain: 'ETH', note: ['Early PEPE buyer · +$142K', 'Bought PEPE with 60 ETH'] },
    { k: 'sell', av: 'T', name: 'Treasury / contract', amt: '−$6.2M', sub: '3,000,000 PENDLE', tag: '↓ Insider → exchange · likely selling', meta: '1.7% of supply', chain: 'ETH', note: ['Insider move · −$6.2M', 'PENDLE treasury → exchange'] },
    { k: 'transfer', av: 'L', name: 'Large holder #3', amt: '$1.1M', sub: '9,400 QNT', tag: '→ Moved to a new wallet', meta: 'from 0x7513…634c57', chain: 'ETH', note: ['Large holder #3 · $1.1M', '9,400 QNT moved to a new wallet'] },
    { k: 'sell', av: 'B', name: 'BSC whale', amt: '−$1.9M', sub: '3,050 BNB', tag: '↓ Sent to exchange · likely selling', meta: '24h after: <b>in 24h</b>', conf: '76%', chain: 'BSC', note: ['BSC whale · −$1.9M', '3,050 BNB sent to an exchange'] },
    { k: 'buy', av: 'S', name: 'Smart trader #7', amt: '+$318K', sub: '27,530 LINK', tag: '↑ Bought LINK', meta: 'paid 318,000 USDC', chain: 'ETH', note: ['Smart trader #7 · +$318K', 'Bought LINK with USDC'] },
    { k: 'sell', av: 'E', name: 'ETH whale', amt: '−$2.8M', sub: '1,200 ETH', tag: '↓ Sent to exchange · likely selling', meta: '24h after: <b>in 23h</b>', conf: '88%', chain: 'ETH', note: ['ETH whale · −$2.8M', '1,200 ETH sent to Binance'] },
  ];
  let feedIdx = 0;
  let feedTimer = null;

  function pushFeed() {
    const it = FEED[feedIdx++ % FEED.length];
    const el = document.createElement('article');
    el.className = `tx ${it.k} enter`;
    el.innerHTML =
      `<div class="tx-top"><span class="av">${it.av}</span><b>${it.name}</b><span class="amt">${it.amt}<small>${it.sub}</small></span></div>` +
      `<span class="tag">${it.tag}</span><p class="tx-meta">${it.meta}</p>` +
      `<div class="tx-foot"><span>just now</span>${it.conf ? `<span class="pill conf">${it.conf}</span>` : ''}<span class="pill">${it.chain}</span></div>`;
    feed.prepend(el);
    // age the rest
    $$('.tx', feed).slice(1).forEach((tx, i) => {
      const s = tx.querySelector('.tx-foot span');
      if (s && s.textContent === 'just now') s.textContent = `${(i + 1) * 3} minutes ago`;
    });
    while (feed.children.length > 4) feed.lastElementChild.remove();
    if (floatAlert) {
      $('[data-float-title]', floatAlert).textContent = it.note[0];
      $('[data-float-body]', floatAlert).textContent = it.note[1];
      floatAlert.classList.add('show');
      setTimeout(() => floatAlert.classList.remove('show'), 2600);
    }
  }

  if (feed && !reduceMotion) {
    const heroObs = new IntersectionObserver(([en]) => {
      clearInterval(feedTimer);
      if (en.isIntersecting) {
        feedTimer = setInterval(() => { if (!document.hidden) pushFeed(); }, 4200);
      }
    }, { threshold: 0.2 });
    heroObs.observe($('.hero'));
    setTimeout(() => floatAlert && floatAlert.classList.add('show'), 1800);
    setTimeout(() => floatAlert && floatAlert.classList.remove('show'), 4400);
  }

  // ---------------------------------------------------------------------------
  // How it works: scroll-driven phone screens
  // ---------------------------------------------------------------------------
  const steps = $$('.step');
  const screens = $$('.step-screen');
  const dots = $$('.step-dots li');
  const stage = $('.how-stage');
  let caption = null;
  if (stage && steps.length) {
    caption = document.createElement('div');
    caption.className = 'how-caption';
    caption.setAttribute('aria-hidden', 'true');
    caption.innerHTML = steps.map((s, i) =>
      `<div${i === 0 ? ' class="is-active"' : ''}><span class="step-num mono">${s.querySelector('.step-num').textContent}</span><h3>${s.querySelector('h3').textContent}</h3><p>${s.querySelector('p:not(.step-num)').textContent}</p></div>`
    ).join('');
    stage.appendChild(caption);
  }
  const trackBtn = $('[data-track-btn]');
  const stepsPhone = $('[data-steps-phone]');
  let trackTimer = null;
  let current = 0;

  function setStep(i) {
    if (i === current && steps[i].classList.contains('is-active')) return;
    const prev = current;
    current = i;
    steps.forEach((s, j) => s.classList.toggle('is-active', j === i));
    if (stepsPhone) stepsPhone.style.setProperty('--ry', `${[-20, 18, -16, 20][i] || -20}deg`);
    dots.forEach((d, j) => d.classList.toggle('is-active', j === i));
    if (caption) [...caption.children].forEach((c, j) => c.classList.toggle('is-active', j === i));
    screens.forEach((s, j) => {
      s.classList.toggle('is-active', j === i);
      s.classList.toggle('was-active', j === prev && prev !== i);
    });
    const leaving = screens[prev];
    setTimeout(() => { if (current !== prev) leaving.classList.remove('was-active'); }, 1050);

    clearTimeout(trackTimer);
    if (trackBtn) {
      trackBtn.classList.remove('is-on');
      trackBtn.textContent = 'Track';
      if (i === 0) trackTimer = setTimeout(() => { trackBtn.classList.add('is-on'); trackBtn.textContent = 'Tracking'; }, 1400);
    }
  }

  const stepObs = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) setStep(steps.indexOf(en.target)); });
  }, { rootMargin: '-48% 0px -48% 0px' });
  steps.forEach((s) => stepObs.observe(s));
  if (steps.length) setStep(0);

  const lockDate = $('[data-lock-date]');
  if (lockDate) lockDate.textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '');

  // ---------------------------------------------------------------------------
  // Sonar: min-alert-size filter demo
  // ---------------------------------------------------------------------------
  const sonar = $('[data-sonar]');
  if (sonar) {
    const blipsEl = $('[data-blips]', sonar);
    const sweepEl = $('.sonar-sweep', sonar);
    const slider = $('[data-floor]');
    const out = $('[data-floor-out]');
    const count = $('[data-sonar-count]');
    const typeInputs = $$('.type-chips input');

    // deterministic pseudo-random so the layout is the same on every visit
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const TYPES = [['sell', 'var(--red)'], ['buy', 'var(--green)'], ['transfer', 'var(--violet-2)'], ['insider', 'var(--amber)']];
    const TOKENS = ['ETH', 'PEPE', 'LINK', 'PENDLE', 'QNT', 'BNB', 'UNI', 'ARB', 'USDC'];
    const money = (v) => (v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${Math.round(v)}`);

    const blips = Array.from({ length: 32 }, () => {
      const [type, color] = TYPES[Math.floor(rnd() * 4)];
      const v = Math.exp(lerp(Math.log(300), Math.log(9e6), rnd()));
      const ang = rnd() * 360; // clockwise from 12 o'clock
      const rad = 0.16 + rnd() * 0.74;
      const x = 50 + Math.sin((ang * Math.PI) / 180) * rad * 50;
      const y = 50 - Math.cos((ang * Math.PI) / 180) * rad * 50;
      const el = document.createElement('span');
      el.className = `blip${x > 64 ? ' left' : ''}`;
      el.style.cssText = `--x:${x}%;--y:${y}%;--c:${color};--s:${(5 + Math.log10(v) * 1.5).toFixed(1)}px`;
      const sign = type === 'buy' ? '+' : type === 'transfer' ? '' : '−';
      el.innerHTML = `<span class="blip-label">${sign}${money(v)} ${TOKENS[Math.floor(rnd() * TOKENS.length)]}</span>`;
      blipsEl.appendChild(el);
      return { el, type, v, ang, on: true };
    });

    const toValue = (x) => 250 * Math.pow(2000, x / 1000);
    const nice = (v) => {
      const step = v < 1e3 ? 10 : v < 1e4 ? 100 : v < 1e5 ? 1000 : 5000;
      return Math.round(v / step) * step;
    };
    const label = (v) => (v >= 1e3 ? `$${+(v / 1e3).toFixed(v < 1e4 ? 1 : 0)}K` : `$${v}`);

    function applyFilter() {
      const floor = nice(toValue(+slider.value));
      const types = new Set(typeInputs.filter((i) => i.checked).map((i) => i.value));
      out.textContent = label(floor);
      slider.style.setProperty('--fill', `${(slider.value / 10).toFixed(1)}%`);
      let shown = 0;
      blips.forEach((b) => {
        b.on = b.v >= floor && types.has(b.type);
        b.el.classList.toggle('off', !b.on);
        if (b.on) shown++;
      });
      count.innerHTML = `Showing <b>${shown}</b> of ${blips.length} moves at ${label(floor)} and up`;
    }
    slider.addEventListener('input', applyFilter);
    typeInputs.forEach((i) => i.addEventListener('change', applyFilter));
    applyFilter();

    let sonarOn = false;
    let prevSweep = 0;
    const PERIOD = 4200;
    function sonarFrame(t) {
      if (!sonarOn) return;
      const sweep = ((t / PERIOD) * 360) % 360;
      sweepEl.style.setProperty('--sweep', `${sweep}deg`);
      blips.forEach((b) => {
        if (!b.on) return;
        const hit = prevSweep <= sweep ? b.ang > prevSweep && b.ang <= sweep : b.ang > prevSweep || b.ang <= sweep;
        if (hit) {
          b.el.classList.add('ping');
          clearTimeout(b.t);
          b.t = setTimeout(() => b.el.classList.remove('ping'), 1100);
        }
      });
      prevSweep = sweep;
      requestAnimationFrame(sonarFrame);
    }
    if (reduceMotion) {
      blips.forEach((b) => b.el.classList.add('ping'));
    } else {
      new IntersectionObserver(([en]) => {
        const was = sonarOn;
        sonarOn = en.isIntersecting;
        if (sonarOn && !was) requestAnimationFrame(sonarFrame);
      }).observe(sonar);
    }
  }

  // ---------------------------------------------------------------------------
  // FAQ: animated accordion, one open at a time
  // ---------------------------------------------------------------------------
  const faqs = $$('.faq details');
  function toggleFaq(d, open) {
    const body = $('.faq-a', d);
    if (reduceMotion || !body.animate) { d.open = open; return; }
    if (open) {
      d.open = true;
      const h = body.scrollHeight;
      body.animate([{ height: '0px', opacity: 0 }, { height: `${h}px`, opacity: 1 }], { duration: 480, easing: 'cubic-bezier(.16,1,.3,1)' });
    } else {
      const h = body.scrollHeight;
      const a = body.animate([{ height: `${h}px`, opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 320, easing: 'cubic-bezier(.65,0,.35,1)' });
      a.onfinish = () => { d.open = false; };
    }
  }
  faqs.forEach((d) => {
    $('summary', d).addEventListener('click', (e) => {
      e.preventDefault();
      const willOpen = !d.open;
      if (willOpen) faqs.forEach((o) => o !== d && o.open && toggleFaq(o, false));
      toggleFaq(d, willOpen);
    });
  });

  // ---------------------------------------------------------------------------
  // Active nav link
  // ---------------------------------------------------------------------------
  const navLinks = $$('[data-nav-link]');
  const sectionObs = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const id = en.target.dataset.section;
      navLinks.forEach((a) => a.classList.toggle('is-active', a.dataset.navLink === id));
    });
  }, { rootMargin: '-45% 0px -54% 0px' });
  $$('[data-section]').forEach((s) => sectionObs.observe(s));
})();
