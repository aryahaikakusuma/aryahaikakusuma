(() => {
  'use strict';

  const SRC = 'assets/hands.webp?v=7';
  const REGION_W = 860;               // width of the cutout in base units; the file holds it at a higher resolution
  const FOCUS = { x: 429, y: 175 };   // the gap between the fingertips, in base units
  const SEAM_CELLS = 2;               // painting dissolves into glyphs over this many cells
  const EXTRA_GAP = 60;               // widens the gap between the fingertips, in base units
  const SPLIT_X = 432.5;              // between Adam's and God's fingertips, in base units
  const SLIDE_MS = 1700;              // each hand slides in over this long
  const SLIDE_STAGGER = 140;          // God's hand follows Adam's by this much
  const LAMP_R = 100;
  const HEAT_TAU = 130;

  const canvas = document.getElementById('hero-canvas');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const darkQuery = matchMedia('(prefers-color-scheme: dark)');
  // Motion plays even when the OS asks for reduced motion, by the site owner's choice.
  // Set this to true to honour the setting: the hero then renders as a still frame.
  const RESPECT_REDUCED_MOTION = false;
  const noMotion = () => RESPECT_REDUCED_MOTION && reduced.matches;

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t >= 1 ? 1 : 1 - Math.pow(2, -9 * t);   // exponential ease-out
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const hex = (h) => { const n = parseInt(h.replace('#', ''), 16); return `rgb(${n >> 16 & 255},${n >> 8 & 255},${n & 255})`; };
  const hash = (a, b) => {
    let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const isDark = () => root.dataset.theme ? root.dataset.theme === 'dark' : darkQuery.matches;

  let img = null;
  let G = null;                        // geometry and per-size buffers
  let T = null;                        // per-theme cell glyph data
  let t0 = 0, last = 0, raf = 0, visible = true;
  const lamp = { x: 0, y: 0, s: 0, px: 0, py: 0, on: false, at: -1e9 };
  let prox = 0;

  /* ---- size-dependent: crop, painting raster, cell coverage ---- */
  function sample() {
    const rect = canvas.getBoundingClientRect();
    const W = Math.round(rect.width), H = Math.round(rect.height);
    if (!W || !H) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pw = Math.round(W * dpr), ph = Math.round(H * dpr);
    canvas.width = pw; canvas.height = ph;

    const k = img.naturalWidth / REGION_W;               // file px per base unit
    const iw = REGION_W, ih = img.naturalHeight / k;
    let cropW = lerp(520, 780, smooth(420, 1100, W));
    let cropH = cropW * H / W;
    if (cropH > ih) { cropH = ih; cropW = cropH * W / H; }
    const sx = clamp(FOCUS.x - cropW / 2, 0, iw - cropW);
    const sy = clamp(FOCUS.y - cropH / 2, 0, ih - cropH);
    const scale = W / cropW;
    const cx = (FOCUS.x - sx) * scale, cy = (FOCUS.y - sy) * scale;

    const fs = clamp(W / 300, 4, 7);
    ctx.font = `${fs}px "Fragment Mono", ui-monospace, monospace`;
    const cw = ctx.measureText('M').width;
    const ch = Math.max(4, Math.round(fs * 1.1));

    const tmp = document.createElement('canvas');
    tmp.width = pw; tmp.height = ph;
    const tctx = tmp.getContext('2d', { willReadFrequently: true });
    tctx.imageSmoothingQuality = 'high';
    // each hand is cropped on its own so the gap can be widened without moving either crop's framing
    const half = EXTRA_GAP / 2;
    const splitL = Math.round((SPLIT_X - (sx + half)) * scale * dpr);
    const splitR = Math.round((SPLIT_X - (sx - half)) * scale * dpr);
    tctx.save(); tctx.beginPath(); tctx.rect(0, 0, splitL, ph); tctx.clip();
    tctx.drawImage(img, (sx + half) * k, sy * k, cropW * k, cropH * k, 0, 0, pw, ph);
    tctx.restore();
    tctx.save(); tctx.beginPath(); tctx.rect(splitR, 0, pw - splitR, ph); tctx.clip();
    tctx.drawImage(img, (sx - half) * k, sy * k, cropW * k, cropH * k, 0, 0, pw, ph);
    tctx.restore();
    const px = tctx.getImageData(0, 0, pw, ph).data;

    // painting raster (left of the gap), with the seam dissolve and frame fade baked in
    const out = new ImageData(pw, ph);
    const o = out.data;
    const cxp = cx * dpr, seam = SEAM_CELLS * cw * dpr;
    const hist = new Uint32Array(256);
    const edge = new Float32Array(pw * ph);   // frame fade, reused for the glyph side
    for (let y = 0; y < ph; y++) {
      const fy = smooth(0, 0.14, Math.min(y, ph - 1 - y) / ph);
      for (let x = 0; x < pw; x++) {
        const k = y * pw + x, i = k * 4;
        const fx = smooth(0, 0.16, Math.min(x, pw - 1 - x) / (pw / 2));
        const e = fx * fy;
        edge[k] = e;
        const a = px[i + 3];
        if (a > 200) hist[Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2])]++;
        if (x < cxp) {
          o[i] = px[i]; o[i + 1] = px[i + 1]; o[i + 2] = px[i + 2];
          o[i + 3] = a * e * (1 - smooth(cxp - seam, cxp, x));
        }
      }
    }
    const raster = document.createElement('canvas');
    raster.width = pw; raster.height = ph;
    raster.getContext('2d').putImageData(out, 0, 0);

    let total = 0; for (let b = 0; b < 256; b++) total += hist[b];
    let acc = 0, lo = 0, hi = 255;
    for (let b = 0; b < 256; b++) { acc += hist[b]; if (acc >= total * 0.03) { lo = b; break; } }
    acc = 0;
    for (let b = 0; b < 256; b++) { acc += hist[b]; if (acc >= total * 0.97) { hi = b; break; } }

    // per-cell coverage and mean luminance
    const ox = cx - Math.floor(cx / cw) * cw - cw;
    const cols = Math.ceil((W - ox) / cw), rows = Math.ceil(H / ch);
    const cellA = new Float32Array(cols * rows), cellL = new Float32Array(cols * rows);
    for (let r = 0; r < rows; r++) {
      const ya = Math.max(0, Math.floor(r * ch * dpr)), yb = Math.min(ph, Math.floor((r + 1) * ch * dpr));
      for (let c = 0; c < cols; c++) {
        const xa = Math.max(0, Math.floor((ox + c * cw) * dpr)), xb = Math.min(pw, Math.floor((ox + (c + 1) * cw) * dpr));
        if (xb <= xa || yb <= ya) continue;
        let sa = 0, sl = 0;
        for (let y = ya; y < yb; y++) {
          for (let x = xa; x < xb; x++) {
            const k = y * pw + x, i = k * 4;
            const a = (px[i + 3] / 255) * edge[k];
            sa += a;
            sl += a * (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
          }
        }
        const n = (xb - xa) * (yb - ya);
        cellA[r * cols + c] = sa / n;
        cellL[r * cols + c] = sa > 0 ? sl / sa : 0;
      }
    }

    const R = LAMP_R, d = Math.round(2 * R * dpr);
    const lc = document.createElement('canvas');
    lc.width = d; lc.height = d;

    G = { W, H, dpr, pw, ph, cx, cy, cw, ch, fs, ox, cols, rows, cellA, cellL, lo, hi, raster, lc,
          heat: new Float32Array(cols * rows) };
    lamp.x = lamp.px = cx; lamp.y = lamp.py = cy;
    return true;
  }

  /* ---- theme-dependent: tone and glyph per cell ---- */
  function paint() {
    if (!G) return;
    const { cols, rows, cellA, cellL, lo, hi } = G;
    const dark = isDark();
    const css = getComputedStyle(root);
    const ink = hex(css.getPropertyValue('--ink').trim());
    const rubric = hex(css.getPropertyValue('--rubric').trim());

    const n = cols * rows;
    const tone = new Float32Array(n);
    const span = Math.max(1, hi - lo);
    const base = dark ? 0.14 : 0.4;   // ink on paper needs a firmer floor for the silhouette to read
    const gamma = dark ? 1.15 : 1.1;

    const nrm = new Float32Array(n);
    for (let i = 0; i < n; i++) if (cellA[i] >= 0.04) nrm[i] = clamp((cellL[i] / cellA[i] - lo) / span);
    // unsharp mask: push each cell away from its neighbourhood mean so knuckles, nails and finger gaps carry the shading
    const RAD = 5;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c, A = cellA[i];
        if (A < 0.04) continue;
        let sw = 0, sm = 0;
        for (let dr = -RAD; dr <= RAD; dr++) {
          const rr = r + dr; if (rr < 0 || rr >= rows) continue;
          for (let dc = -RAD; dc <= RAD; dc++) {
            const cc = c + dc; if (cc < 0 || cc >= cols) continue;
            const j = rr * cols + cc, a = cellA[j];
            if (a < 0.3) continue;
            sw += a; sm += a * nrm[j];
          }
        }
        const mean = sw ? sm / sw : nrm[i];
        const e = clamp(nrm[i] + 1.8 * (nrm[i] - mean));
        const tr = dark ? e : 1 - e;
        tone[i] = clamp(Math.pow(A, 0.7) * (base + (1 - base) * Math.pow(tr, gamma)));
      }
    }

    const aspect = G.cw / G.ch;
    for (let r = 1; r < rows - 1; r++) {
      for (let c = 1; c < cols - 1; c++) {
        const i = r * cols + c;
        if (cellA[i] < 0.1 || cellA[i] > 0.9) continue;
        const ax = (cellA[i + 1] - cellA[i - 1]) / 2, ay = (cellA[i + cols] - cellA[i - cols]) / 2 * aspect;
        if (Math.hypot(ax, ay) > 0.12) tone[i] = Math.max(tone[i], 0.6);   // keep the outline of the hand crisp
      }
    }
    const rub = new Uint8Array(n);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (tone[i] > 0.45 && hash(c, r) < 0.012) rub[i] = 1;
    }
    // bake the static glyph layer once; frames only redraw the cells the lamp touches
    const { W, H, dpr, cx, cw, ch, fs, ox, pw, ph } = G;
    const layer = document.createElement('canvas');
    layer.width = pw; layer.height = ph;
    const lx = layer.getContext('2d');
    lx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lx.font = `${fs}px "Fragment Mono", ui-monospace, monospace`;
    lx.textAlign = 'center'; lx.textBaseline = 'middle';
    const aMin = dark ? 0.16 : 0.4;   // dark ink on vellum needs a higher floor than chalk on slate
    let rubOn = null;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c, te = tone[i];
        if (te < 0.06) continue;
        const xc = ox + (c + 0.5) * cw;
        const w = smooth(cx - SEAM_CELLS * cw, cx, xc);
        if (w < 0.01) continue;
        const isRub = rub[i] === 1;
        if (isRub !== rubOn) { lx.fillStyle = isRub ? rubric : ink; rubOn = isRub; }
        lx.globalAlpha = (aMin + (1 - aMin) * te) * w;
        lx.fillText(ramp(dark ? te : Math.pow(te, 0.75)), xc, (r + 0.5) * ch);   // fine glyphs print lighter than they look on screen, so pick denser ones on paper
      }
    }
    T = { tone, rub, ink, rubric, dark, layer };
  }

  const ramp = (t) => t < 0.06 ? '' : t < 0.17 ? '·' : t < 0.30 ? ':' : t < 0.45 ? '/' : t < 0.62 ? 'x' : t < 0.80 ? 'X' : '#';

  /* ---- frame ---- */
  function stepLamp(now, dt) {
    const { W, H, cx, cy } = G;
    const drifting = noMotion() || !(lamp.on && now - lamp.at < 5000);
    let tx, ty, ts;
    if (drifting) {
      tx = cx + Math.sin(now / 5200) * W * 0.26;
      ty = H * 0.5 + Math.sin(now / 3700 + 1) * H * 0.2;
      ts = noMotion() ? 0 : 0.7;
    } else {
      tx = lamp.px; ty = lamp.py;
      ts = 1 - smooth(0, Math.max(innerHeight, 600), Math.max(0, -ty, ty - H));   // the lamp keeps following the pointer anywhere on the page
    }
    const k = 1 - Math.exp(-dt / 90);
    lamp.x += (tx - lamp.x) * k; lamp.y += (ty - lamp.y) * k; lamp.s += (ts - lamp.s) * k;

    const near = (1 - smooth(W * 0.06, W * 0.28, Math.hypot(lamp.x - cx, lamp.y - cy))) * lamp.s;
    prox += (near - prox) * (1 - Math.exp(-dt / 180));

    const { heat, cols, rows, cw, ch, ox } = G;
    const decay = Math.exp(-dt / HEAT_TAU);
    for (let i = 0; i < heat.length; i++) { const v = heat[i] * decay; heat[i] = v < 0.003 ? 0 : v; }
    G.box = null;
    if (lamp.s > 0.02) {
      const sig = LAMP_R * 0.5, reach = LAMP_R * 1.4;
      const c0 = Math.max(0, Math.floor((lamp.x - reach - ox) / cw)), c1 = Math.min(cols - 1, Math.ceil((lamp.x + reach - ox) / cw));
      const r0 = Math.max(0, Math.floor((lamp.y - reach) / ch)), r1 = Math.min(rows - 1, Math.ceil((lamp.y + reach) / ch));
      G.box = { c0, c1, r0, r1 };
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const dx = ox + (c + 0.5) * cw - lamp.x, dy = (r + 0.5) * ch - lamp.y;
        const g = Math.exp(-(dx * dx + dy * dy) / (2 * sig * sig)) * lamp.s;
        const i = r * cols + c;
        if (g > heat[i]) heat[i] = g;
      }
    }
  }

  function draw(now) {
    const { W, H, dpr, cx, cy, cw, ch, fs, ox, cols, rows, heat, raster, lc } = G;
    const { tone, ink, rubric, layer } = T;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const t = noMotion() ? Infinity : now - t0;
    const pl = ease(clamp(t / SLIDE_MS));                      // Adam's hand
    const pr = ease(clamp((t - SLIDE_STAGGER) / SLIDE_MS));    // God's hand
    const dist = clamp(W * 0.14, 60, 220);
    const settled = pl > 0.98 && pr > 0.98;

    // the painting slides in from the left
    ctx.save();
    ctx.globalAlpha = clamp(pl * 1.5);
    ctx.translate(-(1 - pl) * dist, 0);
    ctx.drawImage(raster, 0, 0, W, H);
    ctx.restore();

    if (settled && lamp.s > 0.03 && !noMotion()) {
      const R = LAMP_R, d = lc.width, lctx = lc.getContext('2d');
      lctx.globalCompositeOperation = 'source-over';
      lctx.clearRect(0, 0, d, d);
      lctx.drawImage(raster, (lamp.x - R) * dpr, (lamp.y - R) * dpr, d, d, 0, 0, d, d);
      lctx.globalCompositeOperation = 'destination-in';
      const g = lctx.createRadialGradient(d / 2, d / 2, 0, d / 2, d / 2, d / 2);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = g; lctx.fillRect(0, 0, d, d);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.22 * lamp.s;
      ctx.drawImage(lc, lamp.x - R, lamp.y - R, 2 * R, 2 * R);
      ctx.restore();
    }

    // the glyphs slide in from the right: baked layer, with the right-hand part nudged left as the lamp nears the gap
    const shift = prox * cw, cxD = Math.round(cx * dpr);
    ctx.save();
    ctx.globalAlpha = clamp(pr * 1.5);
    ctx.translate((1 - pr) * dist, 0);
    ctx.drawImage(layer, 0, 0, cxD, G.ph, 0, 0, cx, H);
    ctx.drawImage(layer, cxD, 0, G.pw - cxD, G.ph, cx - shift, 0, W - cx, H);
    ctx.restore();

    // glyphs the lamp is warming
    if (settled && G.box) {
      ctx.save();
      ctx.font = `${fs}px "Fragment Mono", ui-monospace, monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = ink;
      const { c0, c1, r0, r1 } = G.box;
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const i = r * cols + c, h = heat[i];
          if (h < 0.06 || tone[i] <= 0.04) continue;   // only warm cells that are part of the hand, so no dotted disc shows in the empty gap
          const xc = ox + (c + 0.5) * cw;
          if (smooth(cx - SEAM_CELLS * cw, cx, xc) < 0.99) continue;
          const te = tone[i] + h * 0.38;
          ctx.globalAlpha = (0.16 + 0.84 * clamp(te)) * Math.min(1, h * 1.6);
          ctx.fillText(ramp(te), xc - shift, (r + 0.5) * ch);
        }
      }
      ctx.restore();
    }

    // the spark in the gap appears as the hands arrive
    const arrive = smooth(0.8, 1, Math.min(pl, pr));
    if (arrive > 0) {
      const pulse = noMotion() ? 0.6 : 0.5 + 0.5 * Math.sin(now / 1000 * (Math.PI * 2 / 3.2));
      ctx.save();
      ctx.fillStyle = rubric;
      ctx.globalAlpha = clamp(0.4 + 0.45 * pulse + 0.15 * prox) * arrive;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1.8, fs * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function frame(now) {
    raf = 0;
    if (!G || !T || !visible) return;
    const dt = Math.min(64, now - last || 16); last = now;
    stepLamp(now, dt);
    draw(now);
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (raf || !G || !T) return;
    if (noMotion()) { draw(t0); return; }
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function rebuild() {
    if (!img || !sample()) return;
    paint();
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    start();
  }

  /* ---- wiring ---- */
  const lastClient = { x: 0, y: 0 };
  addEventListener('scroll', () => {   // keep the lamp under the pointer while the page scrolls
    if (!lamp.on) return;
    const r = canvas.getBoundingClientRect();
    lamp.px = lastClient.x - r.left; lamp.py = lastClient.y - r.top;
  }, { passive: true });
  addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    lastClient.x = e.clientX; lastClient.y = e.clientY;
    lamp.px = e.clientX - r.left; lamp.py = e.clientY - r.top;
    lamp.on = true; lamp.at = performance.now();
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { lamp.on = false; });

  let resizeTimer = 0;
  new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(rebuild, 120); }).observe(canvas);
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) start(); else if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }).observe(canvas);
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    if (visible) start(); else if (raf) { cancelAnimationFrame(raf); raf = 0; }
  });
  addEventListener('themechange', () => { paint(); if (noMotion()) draw(t0); });
  reduced.addEventListener('change', rebuild);

  (async () => {
    const image = new Image();
    image.src = SRC;
    const fonts = Promise.race([
      document.fonts.load('8px "Fragment Mono"'),
      new Promise((res) => setTimeout(res, 1500)),
    ]).catch(() => {});
    try { await Promise.all([image.decode(), fonts]); } catch (e) { return; }
    img = image;
    if (!sample()) return;
    paint();
    t0 = performance.now();
    canvas.dataset.ready = 'true';
    start();
  })();
})();
