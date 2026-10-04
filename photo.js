// Coin photos: find the coin in a picture (on-device), let the user adjust the circle, export a round crop.
'use strict';

const Photo = (() => {
  const OUT = 640;           // saved photo size (px, square)
  const WORK = 256;          // detection works on a downscaled copy
  const SRC = 2000;          // the original is kept at most this big, so the crop can be edited later

  async function loadBitmap(file) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (e) { return await createImageBitmap(file); }
  }

  // Otsu threshold over a histogram.
  function otsu(hist, total) {
    let sum = 0; for (let i = 0; i < hist.length; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, best = 0, t = 0;
    for (let i = 0; i < hist.length; i++) {
      wB += hist[i]; if (!wB) continue;
      const wF = total - wB; if (!wF) break;
      sumB += i * hist[i];
      const mB = sumB / wB, mF = (sum - sumB) / wF, between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) { best = between; t = i; }
    }
    return t;
  }

  /** Returns {cx, cy, r} in bitmap pixels. The coin is the largest region that differs from the
   *  background (estimated from the photo's border), preferring regions that don't touch the edge. */
  function detect(bmp) {
    const scale = Math.min(1, WORK / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h).data;

    // background colour: median of a thin border band
    const band = Math.max(2, Math.round(Math.min(w, h) * 0.04));
    const rs = [], gs = [], bs = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (x >= band && x < w - band && y >= band && y < h - band) continue;
      const i = (y * w + x) * 4; rs.push(px[i]); gs.push(px[i + 1]); bs.push(px[i + 2]);
    }
    const med = a => { a.sort((p, q) => p - q); return a[a.length >> 1]; };
    const br = med(rs), bg = med(gs), bb = med(bs);

    // distance from background -> mask via Otsu
    const dist = new Uint16Array(w * h), hist = new Uint32Array(256);
    for (let p = 0, i = 0; p < w * h; p++, i += 4) {
      const d = Math.min(255, Math.round((Math.abs(px[i] - br) + Math.abs(px[i + 1] - bg) + Math.abs(px[i + 2] - bb)) / 3));
      dist[p] = d; hist[d]++;
    }
    const t = Math.max(12, otsu(hist, w * h));
    const mask = new Uint8Array(w * h);
    for (let p = 0; p < w * h; p++) mask[p] = dist[p] > t ? 1 : 0;

    // connected components (4-neighbour), keep the best-scoring one
    const label = new Int32Array(w * h); let best = null, id = 0;
    const stack = new Int32Array(w * h);
    for (let s = 0; s < w * h; s++) {
      if (!mask[s] || label[s]) continue;
      id++; let sp = 0; stack[sp++] = s; label[s] = id;
      let area = 0, minX = w, maxX = 0, minY = h, maxY = 0, edge = 0;
      while (sp) {
        const p = stack[--sp], x = p % w, y = (p / w) | 0; area++;
        if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge++;
        if (x > 0 && mask[p - 1] && !label[p - 1]) { label[p - 1] = id; stack[sp++] = p - 1; }
        if (x < w - 1 && mask[p + 1] && !label[p + 1]) { label[p + 1] = id; stack[sp++] = p + 1; }
        if (y > 0 && mask[p - w] && !label[p - w]) { label[p - w] = id; stack[sp++] = p - w; }
        if (y < h - 1 && mask[p + w] && !label[p + w]) { label[p + w] = id; stack[sp++] = p + w; }
      }
      const bw = maxX - minX + 1, bh = maxY - minY + 1, aspect = bw / bh;
      const roundness = area / (Math.PI * (bw / 2) * (bh / 2));      // 1 for a filled ellipse
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
      const off = Math.hypot(cx - w / 2, cy - h / 2) / Math.hypot(w / 2, h / 2);
      let score = area * Math.min(1, roundness + 0.25) * (1 - 0.6 * off) * (edge ? 0.25 : 1);
      if (aspect < 0.6 || aspect > 1.65) score *= 0.3;
      if (!best || score > best.score) best = { score, cx, cy, r: (bw + bh) / 4, area };
    }

    const minDim = Math.min(w, h);
    let c = best && best.area > minDim * minDim * 0.02 ? best : null;
    if (!c) return { cx: bmp.width / 2, cy: bmp.height / 2, r: Math.min(bmp.width, bmp.height) * 0.4 };
    const fine = refine(bmp, { cx: c.cx / scale, cy: c.cy / scale, r: c.r / scale });
    const bmin = Math.min(bmp.width, bmp.height);
    const r = Math.min(Math.max(fine.r * 1.02, bmin * 0.08), Math.max(bmp.width, bmp.height) * 0.6);   // a hair of margin around the rim
    return { cx: fine.cx, cy: fine.cy, r };
  }

  /* Rim refinement: along rays from the rough centre, find the sharpest colour change near the rough
     radius, then fit a circle (least squares) to those edge points, dropping outliers. */
  function refine(bmp, rough) {
    const RS = 512, scale = Math.min(1, RS / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.filter = 'blur(1px)'; ctx.drawImage(bmp, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h).data;
    const at = (x, y) => { const xi = Math.min(w - 1, Math.max(0, Math.round(x))), yi = Math.min(h - 1, Math.max(0, Math.round(y))); const i = (yi * w + xi) * 4; return [px[i], px[i + 1], px[i + 2]]; };
    const cx = rough.cx * scale, cy = rough.cy * scale, r0 = rough.r * scale;
    const pts = [], N = 72;
    for (let k = 0; k < N; k++) {
      const a = k / N * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
      let bestD = -1, bestR = 0;
      for (let r = r0 * 0.7; r <= r0 * 1.45; r += 0.75) {
        const p = at(cx + dx * (r - 2), cy + dy * (r - 2)), q = at(cx + dx * (r + 2), cy + dy * (r + 2));
        const d = Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]);
        if (d > bestD) { bestD = d; bestR = r; }
      }
      if (bestD > 18) pts.push([cx + dx * bestR, cy + dy * bestR]);
    }
    if (pts.length < N * 0.4) return rough;
    let fit = fitCircle(pts);
    for (let pass = 0; pass < 2 && fit; pass++) {
      const keep = pts.filter(([x, y]) => Math.abs(Math.hypot(x - fit.cx, y - fit.cy) - fit.r) < fit.r * 0.08);
      if (keep.length < N * 0.3) break;
      fit = fitCircle(keep);
    }
    if (!fit || !(fit.r > r0 * 0.6 && fit.r < r0 * 1.6) || Math.hypot(fit.cx - cx, fit.cy - cy) > r0 * 0.5) return rough;
    return { cx: fit.cx / scale, cy: fit.cy / scale, r: fit.r / scale };
  }

  // Algebraic (Kasa) least-squares circle fit.
  function fitCircle(pts) {
    let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0, sz = 0; const n = pts.length;
    for (const [x, y] of pts) { const z = x * x + y * y; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; sxz += x * z; syz += y * z; sz += z; }
    const M = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]], v = [sxz, syz, sz];
    const det = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    const D = det(M); if (Math.abs(D) < 1e-9) return null;
    const col = (i) => M.map((row, r) => row.map((val, c) => c === i ? v[r] : val));
    const A = det(col(0)) / D, B = det(col(1)) / D, C = det(col(2)) / D;
    const fcx = A / 2, fcy = B / 2, r2 = C + fcx * fcx + fcy * fcy;
    return r2 > 0 ? { cx: fcx, cy: fcy, r: Math.sqrt(r2) } : null;
  }

  // Draw the circle c of bmp into a size x size round image, turned by deg degrees (clockwise).
  function drawRound(ctx, bmp, c, deg, size) {
    ctx.save(); ctx.clearRect(0, 0, size, size);
    ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, size, size);
    ctx.translate(size / 2, size / 2); ctx.rotate(deg * Math.PI / 180);
    ctx.drawImage(bmp, c.cx - c.r, c.cy - c.r, c.r * 2, c.r * 2, -size / 2, -size / 2, size, size);
    ctx.restore();
  }
  function exportCircle(bmp, c, deg) {
    const cv = document.createElement('canvas'); cv.width = cv.height = OUT;
    const ctx = cv.getContext('2d');
    drawRound(ctx, bmp, c, deg || 0, OUT);
    return new Promise(res => cv.toBlob(b => b && b.type === 'image/webp' ? res(b) : cv.toBlob(res, 'image/jpeg', 0.88), 'image/webp', 0.88));
  }

  // A downscaled copy of the original photo (JPEG) and its bitmap, so later edits use the same pixels.
  async function toSource(bmp) {
    const k = Math.min(1, SRC / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    const blob = await new Promise(res => cv.toBlob(res, 'image/jpeg', 0.9));
    return { blob, bmp: await createImageBitmap(cv) };
  }

  /** Opens the crop dialog for `file`. Resolves null if cancelled, else
   *  { photo: Blob (round crop), source: Blob (the original, to re-edit later), params: {cx, cy, r, deg} }.
   *  opts.init: start from an earlier crop (params) instead of the detected circle.
   *  opts.isSource: `file` is already a saved original, keep it as is. */
  async function crop(file, dlg, body, el, heading, opts = {}) {
    let bmp = await loadBitmap(file), source = file;
    if (!opts.isSource) ({ blob: source, bmp } = await toSource(bmp));
    const auto = detect(bmp);
    let c = opts.init ? { cx: opts.init.cx, cy: opts.init.cy, r: opts.init.r } : { ...auto };
    const initDeg = opts.init ? Number(opts.init.deg) || 0 : 0;
    return new Promise(resolve => {
      body.textContent = '';
      const stage = el('canvas', { class: 'crop-stage', 'aria-label': 'אזור החיתוך. גרור כדי להזיז את העיגול' });
      const size = el('input', { type: 'range', id: 'crop-size', min: '5', max: '100', step: '0.5' });
      const minDim = Math.min(bmp.width, bmp.height), maxR = Math.max(bmp.width, bmp.height) * 0.6;
      const toSlider = r => String(Math.round((r - minDim * 0.05) / (maxR - minDim * 0.05) * 95 + 5));
      const fromSlider = v => minDim * 0.05 + (Number(v) - 5) / 95 * (maxR - minDim * 0.05);
      size.value = toSlider(c.r);
      const done = v => { dlg.close(); resolve(v); };
      const saveBtn = el('button', { class: 'btn accent', type: 'button', text: 'שמור תמונה' });
      // rotation: quarter turns plus a fine angle; the round preview shows the saved result
      let quarter = ((Math.round(initDeg / 90) % 4) + 4) % 4;
      const fine = el('input', { type: 'range', id: 'crop-rot', min: '-45', max: '45', step: '0.5', value: String(initDeg - Math.round(initDeg / 90) * 90) });
      const preview = el('canvas', { class: 'crop-preview', width: '240', height: '240', 'aria-label': 'כך המטבע יישמר' });
      const pctx = preview.getContext('2d');
      const deg = () => quarter * 90 + Number(fine.value);
      const degLbl = el('span', { class: 'rot-deg' });
      const drawPreview = () => { drawRound(pctx, bmp, c, deg(), 240); degLbl.textContent = Math.round(((deg() % 360) + 360) % 360) + '°'; };
      const turn = q => { quarter = (quarter + q + 4) % 4; drawPreview(); };
      body.append(
        el('h2', { text: heading || 'חיתוך המטבע' }),
        el('p', { class: 'muted', text: 'העיגול הזהוב סומן אוטומטית סביב המטבע. גרור אותו או שנה את הגודל אם צריך, וסובב עד שהמטבע ישר.' }),
        stage,
        el('div', { class: 'field' }, [el('label', { for: 'crop-size', text: 'גודל העיגול' }), size]),
        el('div', { class: 'rot-box' }, [
          preview,
          el('div', { class: 'rot-ctl' }, [
            el('span', { class: 'rot-title', text: 'יישור המטבע' }),
            el('div', { class: 'confirm' }, [
              el('button', { class: 'btn', type: 'button', text: '↺ 90°', 'aria-label': 'סובב 90 מעלות נגד כיוון השעון', onclick: () => turn(-1) }),
              el('button', { class: 'btn', type: 'button', text: '↻ 90°', 'aria-label': 'סובב 90 מעלות עם כיוון השעון', onclick: () => turn(1) }),
              degLbl,
            ]),
            el('label', { for: 'crop-rot', class: 'rot-fine', text: 'כיוון עדין' }), fine,
          ]),
        ]),
        el('div', { class: 'confirm' }, [
          saveBtn,
          el('button', { class: 'btn', type: 'button', text: 'זיהוי אוטומטי מחדש', onclick: () => { c = { ...auto }; size.value = toSlider(c.r); draw(); drawPreview(); } }),
          el('button', { class: 'btn', type: 'button', text: 'ביטול', onclick: () => done(null) }),
        ]),
      );

      const ctx = stage.getContext('2d');
      let view = { s: 1, ox: 0, oy: 0, px: 300 };
      function layout() {
        const css = Math.min(body.clientWidth - 40, 420);
        const dpr = window.devicePixelRatio || 1;
        stage.style.width = stage.style.height = css + 'px';
        stage.width = stage.height = Math.round(css * dpr);
        const px = stage.width, s = Math.min(px / bmp.width, px / bmp.height);
        view = { s, ox: (px - bmp.width * s) / 2, oy: (px - bmp.height * s) / 2, px, dpr };
      }
      function draw() {
        const { s, ox, oy, px } = view;
        ctx.fillStyle = '#111'; ctx.fillRect(0, 0, px, px);
        ctx.drawImage(bmp, ox, oy, bmp.width * s, bmp.height * s);
        const X = ox + c.cx * s, Y = oy + c.cy * s, R = c.r * s;
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, px, px); ctx.arc(X, Y, R, 0, Math.PI * 2, true);
        ctx.fillStyle = 'rgba(10,12,20,.62)'; ctx.fill('evenodd'); ctx.restore();
        ctx.lineWidth = 3 * (view.dpr || 1); ctx.strokeStyle = '#e2b648';
        ctx.beginPath(); ctx.arc(X, Y, R, 0, Math.PI * 2); ctx.stroke();
      }
      let drag = null;
      stage.addEventListener('pointerdown', e => {
        stage.setPointerCapture(e.pointerId);
        drag = { x: e.clientX, y: e.clientY, cx: c.cx, cy: c.cy };
      });
      stage.addEventListener('pointermove', e => {
        if (!drag) return;
        const k = (view.dpr || 1) / view.s;
        c.cx = Math.min(bmp.width, Math.max(0, drag.cx + (e.clientX - drag.x) * k));
        c.cy = Math.min(bmp.height, Math.max(0, drag.cy + (e.clientY - drag.y) * k));
        draw(); drawPreview();
      });
      const end = () => { drag = null; };
      stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
      size.addEventListener('input', () => { c.r = fromSlider(size.value); draw(); drawPreview(); });
      fine.addEventListener('input', drawPreview);
      saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        done({ photo: await exportCircle(bmp, c, deg()), source, params: { cx: c.cx, cy: c.cy, r: c.r, deg: deg() } });
      });
      dlg.addEventListener('cancel', () => resolve(null), { once: true });

      dlg.showModal(); layout(); draw(); drawPreview();
    });
  }

  const toDataURL = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
  const fromDataURL = url => fetch(url).then(r => r.blob());

  return { crop, detect, toDataURL, fromDataURL };
})();
