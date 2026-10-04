'use strict';
(() => {
// collections: the albums this person keeps, in order: { id, kind: 'catalog' | 'own', name, sub }.
// A catalog collection's id is the catalog key; an own collection's coins are all "extras".
const st = { tab: '', view: 'album', filter: 'all', collections: [], owned: new Map(), extras: new Map(), photos: new Map(), ready: false };
try { st.tab = localStorage.getItem('album.tab') || ''; const v = localStorage.getItem('album.view'); if (v === 'list' || v === 'album') st.view = v; } catch (e) {}

const $ = s => document.querySelector(s);
const el = (tag, attrs = {}, kids = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v);
  }
  for (const k of [].concat(kids)) if (k != null) n.append(k.nodeType ? k : document.createTextNode(k));
  return n;
};
const nowIso = () => new Date().toISOString();
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

function colById(id) { return st.collections.find(c => c.id === id); }
function curCol() { return colById(st.tab) || st.collections[0]; }
function themeOf(col) { return col && col.kind === 'catalog' ? CATALOGS[col.id].theme : 'own'; }
function extraToItem(id, x) {
  const col = colById(x.series), own = col && col.kind === 'own';
  return { id: 'x-' + id, extraId: id, series: x.series, y: x.year || '', tag: own ? '' : 'תוספת', rare: '', metal: x.metal || 'silver',
    diam: Number(x.diam) || (x.series === 'crowns' ? CROWN_DIAM : 25),
    metalName: METAL_NAME[x.metal] || '', title: x.label || 'מטבע נוסף', sub: col ? col.name + (own ? '' : ', תוספת') : '',
    design: x.note || '', holed: false, custom: true, own };
}
// A collector can trim a catalog: hide whole groups (a reign, a denomination, a country) or single coins.
// Hidden coins keep their data; they just leave the album, the counts and the lists.
function hiddenOf(series) { const c = colById(series); return { groups: new Set(c?.hidden?.groups || []), items: new Set(c?.hidden?.items || []) }; }
function showsVariants(series) { const c = colById(series); return !c || c.showVariants !== false; }
function visibleIn(series) { const h = hiddenOf(series), v = showsVariants(series); return it => !h.groups.has(it.group) && !h.items.has(it.id) && (v || !it.variant); }
function allItems(series) {
  const base = CATALOGS[series] && CATALOGS[series].list && colById(series) ? CATALOGS[series].list.filter(visibleIn(series)) : [];
  const extra = [...st.extras.values()].filter(x => x.series === series);
  if (!base.length) extra.sort((a, b) => (Number(a.y) || 0) - (Number(b.y) || 0) || a.title.localeCompare(b.title, 'he'));
  return base.concat(extra);
}
function findItem(id) { for (const c of st.collections) { const it = allItems(c.id).find(i => i.id === id); if (it) return it; } return null; }

/* ---------- rendering ---------- */
function coinEl(item) {
  const photo = st.owned.has(item.id) && st.photos.get(item.id);
  const coin = el('span', { class: 'coin' + (item.holed ? ' holed' : '') + (photo ? ' has-photo' : '') }, [String(item.y || '·')]);
  if (photo) coin.append(el('img', { src: photo, alt: '', loading: 'lazy', decoding: 'async' }));
  if (item.rare) coin.append(el('span', { class: 'rare-dot', title: item.rare }));
  return coin;
}
function slotEl(item) {
  const own = st.owned.has(item.id);
  const b = el('button', {
    type: 'button', class: 'slot m-' + item.metal + (own ? ' own' : '') + (st.justAdded === item.id ? ' pop' : ''),
    'aria-label': item.title + (own ? ', יש באוסף' : ', חסר') + (item.rare ? ', ' + item.rare : ''),
    onclick: () => openSheet(item.id),
  }, [coinEl(item), el('span', { class: 'lbl', text: own ? (st.owned.get(item.id).grade || 'יש') : (item.tag || '') })]);
  if ((st.filter === 'own' && !own) || (st.filter === 'miss' && own)) b.hidden = true;
  return b;
}

function seriesStats(key) {
  const items = allItems(key), have = items.filter(i => st.owned.has(i.id)).length;
  return { total: items.length, have, pct: items.length ? Math.round(have / items.length * 100) : 0 };
}

function renderStats() {
  const host = $('#stats'); host.textContent = '';
  let have = 0, total = 0;
  for (const c of st.collections) { const x = seriesStats(c.id); have += x.have; total += x.total; }
  const stat = (cls, n, t) => el('div', { class: 'stat ' + cls }, [el('b', { text: String(n) }), el('span', { text: t })]);
  host.append(stat('gold', have, 'מטבעות באלבום'), stat('', (total ? Math.round(have / total * 100) : 0) + '%', 'מכל הסדרות'), stat('copper', total - have, 'עוד חסרים'));
}

function renderTabs() {
  const host = $('#tabs'); host.textContent = '';
  for (const s of st.collections) {
    const key = s.id, x = seriesStats(key);
    const ring = el('span', { class: 'ring', style: '--p:' + x.pct }, [el('span', { text: x.pct + '%' })]);
    host.append(el('button', { class: 'tab ' + themeOf(s), role: 'tab', type: 'button', 'aria-selected': String(st.tab === key),
      onclick: () => { st.tab = key; try { localStorage.setItem('album.tab', key); } catch (e) {} render(); } }, [
      ring,
      el('span', { class: 't-name', text: s.name }),
      el('span', { class: 't-sub', text: s.sub || '' }),
      el('span', { class: 't-count', text: x.have + ' מתוך ' + x.total }),
    ]));
  }
  host.append(el('button', { class: 'tab add', type: 'button', onclick: () => openLibrary() }, [
    el('span', { class: 'ring' }, [el('span', { text: '+' })]),
    el('span', { class: 't-name', text: 'אוסף חדש' }),
    el('span', { class: 't-sub', text: 'מהספרייה או משלך' }),
  ]));
}

function trayHead(title, sub, extra) {
  return el('div', { class: 'tray-head' }, [el('h2', { text: title }), extra || null, el('p', { text: sub })]);
}

function renderCrowns(view) {
  const tray = el('div', { class: 'tray' }, [trayHead('קראונים בריטיים', 'חמישה שילינג. לכל מלך המונוגרמה המלכותית שלו.')]);
  const vis = visibleIn('crowns');
  for (const r of CROWN_REIGNS) {
    const items = CROWNS.filter(c => c.reign === r.key && vis(c)), have = items.filter(i => st.owned.has(i.id)).length;
    if (!items.length) continue;
    tray.append(el('div', { class: 'reign' }, [
      el('div', { class: 'reign-head' }, [
        el('span', { class: 'cypher', 'aria-hidden': 'true', text: r.cypher }),
        el('div', {}, [el('h3', { text: r.name }), el('small', { text: r.years + ' · ' + have + '/' + items.length })]),
        el('span', { class: 'mini-bar', 'aria-hidden': 'true' }, [el('i', { style: 'width:' + Math.round(have / items.length * 100) + '%' })]),
      ]),
      el('div', { class: 'slots' }, items.map(slotEl)),
    ]));
  }
  view.append(tray);
}

function renderMandate(view) {
  const tray = el('div', { class: 'tray' }, [trayHead('מטבעות המנדט', 'כל ערך בכל שנת הטבעה. גלול לצדדים לראות את כל השנים.',
    el('span', { class: 'tri', text: 'פלשתינה (א"י) · PALESTINE · فلسطين' }))]);
  const table = el('table', { class: 'matrix' });
  const vis = visibleIn('mandate'), shown = MANDATE.filter(vis);
  const years = MANDATE_YEARS.filter(y => shown.some(c => c.y === y));
  table.append(el('thead', {}, [el('tr', {}, [el('th', { text: '' }), ...years.map(y => el('th', { scope: 'col', text: String(y) }))])]));
  const tb = el('tbody');
  for (const den of MANDATE_DENOMS) {
    const items = shown.filter(c => c.d === den.d), have = items.filter(i => st.owned.has(i.id)).length;
    if (!items.length) continue;
    const tr = el('tr', {}, [el('th', { scope: 'row' }, [den.d + (den.d === 1 ? ' מיל' : ' מילים'), el('small', { text: have + '/' + items.length + ' · ' + den.metalName.split(',')[0] })])]);
    for (const y of years) {
      const cell = items.filter(c => c.y === y);
      tr.append(el('td', {}, cell.length
        ? (cell.length > 1 ? el('div', { class: 'cell-pair' }, cell.map(slotEl)) : slotEl(cell[0]))
        : el('span', { class: 'none', 'aria-hidden': 'true', text: '·' })));
    }
    tb.append(tr);
  }
  table.append(tb);
  tray.append(el('div', { class: 'matrix-wrap' }, [table]));
  view.append(tray);
}

// List view for catalogs loaded from files: one tray per group.
function renderGroupedList(view, key) {
  const cat = CATALOGS[key], col = colById(key);
  if (!cat.list) { view.append(el('div', { class: 'tray' }, [trayHead(cat.name, 'טוען את הקטלוג...')])); return; }
  const vis = visibleIn(key);
  const tray = el('div', { class: 'tray' }, [trayHead(col.name, cat.sub || '')]);
  for (const g of cat.groups) {
    const items = cat.list.filter(c => c.group === g.key && vis(c)), have = items.filter(i => st.owned.has(i.id)).length;
    if (!items.length) continue;
    tray.append(el('div', { class: 'reign' }, [
      el('div', { class: 'reign-head' }, [
        el('div', {}, [el('h3', { text: g.name }), el('small', { text: have + '/' + items.length })]),
        el('span', { class: 'mini-bar', 'aria-hidden': 'true' }, [el('i', { style: 'width:' + Math.round(have / items.length * 100) + '%' })]),
      ]),
      el('div', { class: 'slots' }, items.map(slotEl)),
    ]));
  }
  view.append(tray);
}
function renderOwnList(view) {
  const col = curCol(), items = allItems(col.id);
  view.append(el('div', { class: 'tray' }, [
    trayHead(col.name, col.sub || 'אוסף שבנית בעצמך.'),
    items.length ? el('div', { class: 'slots' }, items.map(slotEl))
      : el('p', { class: 'muted', style: 'color:var(--on-velvet-dim)', text: 'עוד אין כאן מטבעות. לחץ "הוסף מטבע" כדי להוסיף את הראשון.' }),
  ]));
}
function renderExtras(view) {
  const extra = allItems(st.tab).filter(i => i.custom);
  if (!extra.length) return;
  view.append(el('div', { class: 'tray extras' }, [
    el('h3', { text: 'מטבעות שהוספת מחוץ לרשימה' }),
    el('p', { text: 'וריאנטים, פרופים או מטבעות שלא מופיעים בקטלוג.' }),
    el('div', { class: 'slots' }, extra.map(slotEl)),
  ]));
}

function render() {
  if (!colById(st.tab) && st.collections.length) st.tab = st.collections[0].id;
  const empty = st.ready && !st.collections.length;
  document.body.dataset.series = themeOf(curCol());
  document.body.classList.toggle('no-collections', empty);
  renderStats(); renderTabs();
  if (empty) { const view = $('#view'); view.textContent = ''; view.append(welcome()); return; }
  if (!st.collections.length) { $('#view').textContent = ''; return; }
  document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.f === st.filter)));
  document.querySelectorAll('.vt').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.v === st.view)));
  $('#customizeBtn').hidden = !(curCol() && curCol().kind === 'catalog');
  $('.chips').hidden = st.view === 'album';
  const view = $('#view'); view.textContent = '';
  if (st.view === 'album') {
    renderAlbum(view, false);
    if (st.reader) { const stg = $('#readerStage'); stg.textContent = ''; renderAlbum(stg, true); layoutReader(); }
  }
  else if (st.tab === 'crowns') { renderCrowns(view); renderExtras(view); }
  else if (st.tab === 'mandate') { renderMandate(view); renderExtras(view); }
  else if (CATALOGS[st.tab]) { renderGroupedList(view, st.tab); renderExtras(view); }
  else renderOwnList(view);
  st.justAdded = null;
}

/* ---------- album pages (sheets of pockets with coin holders) ---------- */
// The sheet for a page: the smallest layout whose holder window fits the page's largest coin.
function sheetFor(maxDiam) {
  return maxDiam <= SHEET_TYPES.P20.maxWindow ? SHEET_TYPES.P20 : SHEET_TYPES.P12;
}
// Smallest standard holder window the coin fits through (XL holders: coin size + 1 mm).
function windowFor(diam, sheet) {
  if (sheet.key === 'P20') return HOLDER_WINDOWS.find(w => w >= diam) || HOLDER_WINDOWS[HOLDER_WINDOWS.length - 1];
  return Math.ceil(diam + 1);
}
function albumSections(series) {
  const extras = allItems(series).filter(i => i.custom);
  const out = [];
  const col = colById(series);
  if (col && col.kind === 'own') return extras.length ? [{ title: col.name, items: extras }] : [];
  const vis = visibleIn(series);
  if (series === 'crowns') out.push({ title: 'קראונים בריטיים', items: CROWNS.filter(vis) });
  else if (series !== 'mandate') { const cat = CATALOGS[series]; for (const g of (cat && cat.list ? cat.groups : [])) out.push({ title: g.name, items: cat.list.filter(c => c.group === g.key && vis(c)) }); }
  else for (const den of MANDATE_DENOMS) out.push({ title: den.d + (den.d === 1 ? ' מיל' : ' מילים') + ' · ' + den.metalName.split(',')[0] + ' · ' + den.diam + ' מ"מ', items: MANDATE.filter(c => c.d === den.d && vis(c)) });
  if (extras.length) out.push({ title: 'מטבעות שהוספת', items: extras });
  return out.filter(s => s.items.length);
}
// Fill pages in order; a new section starts a new page. Each page is sized by its own largest coin.
function albumPages(series) {
  const pages = [];
  for (const sec of albumSections(series)) {
    let i = 0, part = 0;
    const parts = [];
    while (i < sec.items.length) {
      let sheet = sheetFor(Math.max(...sec.items.slice(i, i + SHEET_TYPES.P20.pockets).map(c => c.diam || 25)));
      let chunk = sec.items.slice(i, i + sheet.pockets);
      const fit = sheetFor(Math.max(...chunk.map(c => c.diam || 25)));   // a smaller chunk may fit a smaller sheet
      if (fit.pockets !== sheet.pockets) { sheet = fit; chunk = sec.items.slice(i, i + sheet.pockets); }
      parts.push({ sheet, items: chunk }); i += chunk.length;
    }
    for (const pp of parts) pages.push({ sec, sheet: pp.sheet, items: pp.items, part: ++part, parts: parts.length });
  }
  return pages;
}
function holderEl(item, sheet) {
  const own = st.owned.has(item.id);
  const win = windowFor(item.diam || 25, sheet);
  const coin = coinEl(item);
  coin.style.width = coin.style.height = ((item.diam || 25) / win * 100) + '%';
  const label = String(item.y || '') + (item.tag && item.series === 'crowns' ? ' ' + item.tag : '') + (item.series === 'mandate' ? ' · ' + item.d + ' מיל' : '');
  return el('button', {
    type: 'button', class: 'pocket slot m-' + item.metal + (own ? ' own' : '') + (st.justAdded === item.id ? ' pop' : ''),
    'aria-label': item.title + (own ? ', יש באוסף' : ', חסר') + (item.rare ? ', ' + item.rare : ''),
    title: item.title, onclick: () => openSheet(item.id),
  }, [el('span', { class: 'holder' }, [
    el('span', { class: 'window', style: '--w:' + (win / sheet.holder * 100) + '%' }, [coin]),
    el('span', { class: 'hl-lbl', text: label }),
    el('span', { class: 'hl-mm', text: String(win).replace('.', ',') }),
  ])]);
}
function reignSpan(items) {
  const names = [...new Set(items.map(i => (CROWN_REIGNS.find(r => r.key === i.reign) || {}).name).filter(Boolean))];
  return names.length > 1 ? names[0] + ' – ' + names[names.length - 1] : (names[0] || '');
}
/* ---------- the album as a book (Hebrew binding: pages turn from left to right) ----------
   Open at page p: the LEFT side shows the front of page p, the RIGHT side shows the back of page p-1
   (or the inside of the cover for p = 0). Turning forward lifts the left page over the spine to the right. */
function pageFront(p, i) {
  const have = p.items.filter(it => st.owned.has(it.id)).length;
  const meta = (st.tab === 'crowns' && !p.items[0].custom ? reignSpan(p.items) + ' · ' : '') + have + '/' + p.items.length + ' באוסף';
  const grid = el('div', { class: 'pg-grid', style: 'grid-template-columns:repeat(' + p.sheet.cols + ',minmax(0,1fr));grid-template-rows:repeat(' + p.sheet.rows + ',minmax(0,1fr))' },
    p.items.map(it => holderEl(it, p.sheet)));
  for (let k = p.items.length; k < p.sheet.pockets; k++) grid.append(el('span', { class: 'pocket empty', 'aria-hidden': 'true' }));
  return el('section', { class: 'pg front', 'aria-label': 'דף ' + (i + 1) }, [
    el('div', { class: 'pg-head' }, [
      el('span', { class: 'pg-title', text: p.sec.title + (p.parts > 1 ? ' (' + p.part + '/' + p.parts + ')' : '') }),
      el('span', { class: 'pg-meta', text: meta }),
    ]),
    grid,
    el('div', { class: 'pg-foot' }, [el('span', { text: p.sheet.pockets + ' כיסים' }), el('span', { text: String(i + 1) })]),
  ]);
}
// The back of a sheet: the same pockets seen from behind (columns mirrored). A missing coin has no holder.
function pageBack(p, i) {
  const cells = [];
  for (let r = 0; r < p.sheet.rows; r++) for (let c = p.sheet.cols - 1; c >= 0; c--) {
    const it = p.items[r * p.sheet.cols + c];
    if (it && st.owned.has(it.id)) {
      const win = windowFor(it.diam || 25, p.sheet);
      const rev = st.photos.get(it.id + REV);
      const coin = el('span', { class: 'coin' + (it.holed ? ' holed' : '') + (rev ? ' has-photo' : '') }, rev ? [el('img', { src: rev, alt: '' })] : []);
      coin.style.width = coin.style.height = ((it.diam || 25) / win * 100) + '%';
      cells.push(el('button', {
        type: 'button', class: 'pocket own back-holder slot m-' + it.metal,
        'aria-label': it.title + ', גב המטבע, פתח פרטים',
        title: it.title, onclick: () => openSheet(it.id),
      }, [el('span', { class: 'holder' }, [
        el('span', { class: 'window', style: '--w:' + (win / p.sheet.holder * 100) + '%' }, [coin]),
        el('span', { class: 'hl-lbl', text: String(it.y || '') }),
      ])]));
    } else cells.push(el('span', { class: 'pocket empty', 'aria-hidden': 'true' }));
  }
  return el('section', { class: 'pg back', 'aria-label': 'גב דף ' + (i + 1) }, [
    el('div', { class: 'pg-head' }, [el('span', { class: 'pg-meta', text: 'גב דף ' + (i + 1) })]),
    el('div', { class: 'pg-grid', style: 'grid-template-columns:repeat(' + p.sheet.cols + ',minmax(0,1fr));grid-template-rows:repeat(' + p.sheet.rows + ',minmax(0,1fr))' }, cells),
    el('div', { class: 'pg-foot' }, [el('span', { text: '' }), el('span', { text: '' })]),
  ]);
}
function coverInside(atEnd) {
  const x = seriesStats(st.tab);
  return el('section', { class: 'pg lining' }, [el('div', { class: 'lining-inner' }, [
    el('span', { class: 'ex-libris', text: atEnd ? 'סוף האלבום' : 'אלבום' }),
    el('b', { text: curCol().name }),
    el('span', { text: x.have + ' מתוך ' + x.total + ' מטבעות' }),
  ])]);
}

function renderAlbum(view, inReader) {
  const pages = albumPages(st.tab);
  st.book = st.book || {};
  const bk = st.book[st.tab] = st.book[st.tab] || { open: false, p: 0 };
  bk.p = Math.min(bk.p, pages.length);   // p = pages.length: the last sheet is turned, the back cover's inside shows on the left
  const isOpen = inReader && bk.open;   // outside reading mode the album shows its closed cover
  const singlePage = inReader && reader.portrait;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const book = el('div', { class: 'book' + (isOpen ? ' open' : '') + (singlePage ? ' single-page' : ''), role: 'region', 'aria-label': 'אלבום ' + curCol().name });
  const right = el('div', { class: 'side right' }), left = el('div', { class: 'side left' });
  const ind = el('span', { class: 'pg-ind' });
  let busy = false;

  const rightFor = p => p === 0 ? coverInside() : pageBack(pages[p - 1], p - 1);
  const leftFor = p => p < pages.length ? pageFront(pages[p], p) : coverInside(true);
  function paint() {
    if (singlePage) {
      right.replaceChildren();
      left.replaceChildren(leftFor(bk.p));
    } else {
      right.replaceChildren(rightFor(bk.p));
      left.replaceChildren(leftFor(bk.p));
    }
    ind.textContent = bk.p < pages.length ? 'דף ' + (bk.p + 1) + ' מתוך ' + pages.length : 'סוף האלבום';
    if (jump) jump.value = String(bk.p);
    prev.disabled = false; next.disabled = bk.p >= pages.length;
  }

  // Closed: only the front cover.
  const x = seriesStats(st.tab);
  const cover = el('button', { class: 'cover', type: 'button', 'aria-label': 'פתח את האלבום ' + curCol().name }, [
    el('span', { class: 'cover-frame' }, [
      el('span', { class: 'cover-kicker', text: 'אלבום מטבעות' }),
      el('span', { class: 'cover-name', text: curCol().name }),
      el('span', { class: 'cover-sub', text: curCol().sub || '' }),
      el('span', { class: 'cover-count', text: x.have + ' / ' + x.total }),
      el('span', { class: 'cover-hint', text: 'לחץ לפתיחה' }),
    ]),
  ]);

  function leaf(frontEl, backEl, fromSide) {
    const lf = el('div', { class: 'leaf from-' + fromSide }, [
      el('div', { class: 'face face-front' }, [frontEl]),
      el('div', { class: 'face face-back' }, [backEl]),
      el('div', { class: 'leaf-shade', 'aria-hidden': 'true' }),
    ]);
    book.append(lf);
    return lf;
  }
  function animate(lf, from, to) {
    const dur = reduce ? 1 : 620;
    const a = lf.animate([{ transform: 'rotateY(' + from + 'deg)' }, { transform: 'rotateY(' + to + 'deg)' }],
      { duration: dur, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'forwards' });
    const sh = lf.querySelector('.leaf-shade');
    sh.animate([{ opacity: 0 }, { opacity: .55, offset: .5 }, { opacity: 0 }], { duration: dur, fill: 'forwards' });
    return a.finished;
  }

  // Forward: the left page (front of p) turns over to the right, showing its back.
  async function forward() {
    if (busy || bk.p >= pages.length) return;
    busy = true;
    if (singlePage) {
      bk.p++;
      left.replaceChildren(leftFor(bk.p));
      if (!reduce) await left.animate([{opacity:.25,transform:'translateX(-10%)'},{opacity:1,transform:'translateX(0)'}],
        {duration:220,easing:'ease-out'}).finished;
      paint(); busy = false; return;
    }
    const lf = leaf(pageFront(pages[bk.p], bk.p), pageBack(pages[bk.p], bk.p), 'left');
    left.replaceChildren(leftFor(bk.p + 1));
    await animate(lf, 0, 180);
    bk.p++; lf.remove(); paint(); busy = false;
  }
  // Back: the right page (back of p-1) turns over to the left, showing page p-1's front. At p = 0 the cover closes.
  async function backward() {
    if (busy) return;
    busy = true;
    if (singlePage && bk.p > 0) {
      bk.p--;
      left.replaceChildren(leftFor(bk.p));
      if (!reduce) await left.animate([{opacity:.25,transform:'translateX(10%)'},{opacity:1,transform:'translateX(0)'}],
        {duration:220,easing:'ease-out'}).finished;
      paint(); busy = false; return;
    }
    if (bk.p === 0) {
      const lf = leaf(coverInside(), coverFace(), 'right');
      right.replaceChildren();
      await animate(lf, 0, -180);
      bk.open = false; busy = false; render(); return;
    }
    const lf = leaf(pageBack(pages[bk.p - 1], bk.p - 1), pageFront(pages[bk.p - 1], bk.p - 1), 'right');
    right.replaceChildren(rightFor(bk.p - 1));
    await animate(lf, 0, -180);
    bk.p--; lf.remove(); paint(); busy = false;
  }
  function coverFace() { const c = cover.cloneNode(true); c.className = 'cover as-face'; return c; }

  const prev = el('button', { class: 'btn ghost', type: 'button', text: '→ אחורה', onclick: backward });
  const next = el('button', { class: 'btn ghost', type: 'button', text: 'קדימה ←', onclick: forward });

  const jump = el('select', { class: 'pg-jump', 'aria-label': 'קפוץ לדף' });
  const jumpLabels = new Map();
  pages.forEach((p, i) => {
    let label = p.sec.title;
    // Keep the useful collection heading compact in the side picker.
    if (st.tab === 'mandate') label = label.split(' · ')[0];
    if (p.parts > 1) label += ' (' + p.part + '/' + p.parts + ')';
    // Repeated section names are still separate physical pages.
    jumpLabels.set(i, label);
    jump.append(el('option', { value: String(i), text: label + ' — דף ' + (i + 1) }));
  });
  jump.append(el('option', { value: String(pages.length), text: 'סוף האלבום' }));
  jump.onchange = () => {
    if (busy) { jump.value = String(bk.p); return; }
    const target = Number(jump.value);
    if (!Number.isFinite(target) || target < 0 || target > pages.length || target === bk.p) return;
    bk.p = target;
    paint();
  };

  if (!isOpen) {
    book.append(cover);
    cover.addEventListener('click', async () => {
      if (!inReader) { enterReader(); return; }
      if (busy) return; busy = true;
      book.classList.add('open');
      cover.remove();
      book.append(right, left);
      right.replaceChildren(); left.replaceChildren(pageFront(pages[0], 0));
      bk.p = 0;
      if (!singlePage) {
        const lf = leaf(coverFace(), coverInside(), 'left');
        await animate(lf, 0, 180);
        lf.remove();
      }
      bk.open = true; paint(); busy = false;
      nav.hidden = false; edges.hidden = false;
    });
  } else { book.append(right, left); }

  // Swipe: in a Hebrew book you pull the left page to the right to go forward.
  let sx = null, sy = 0;
  let swipePointer = null, swipeBlocked = false;
  book.addEventListener('pointerdown', e => {
    if (!bk.open) return;
    // One finger owns page turning. A second finger cancels the pending swipe so pinch-zoom can take over.
    if (swipePointer !== null && swipePointer !== e.pointerId) { swipeBlocked = true; sx = null; return; }
    swipePointer = e.pointerId; swipeBlocked = false; sx = e.clientX; sy = e.clientY;
  });
  book.addEventListener('pointerup', e => {
    if (e.pointerId !== swipePointer) return;
    const blocked = swipeBlocked; swipePointer = null; swipeBlocked = false;
    if (sx === null || blocked) { sx = null; return; }
    let dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
    if (inReader && reader.rotated) [dx, dy] = [dy, -dx];   // the book is turned 90 degrees on screen
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) { dx > 0 ? forward() : backward(); }
  });
  book.addEventListener('pointercancel', e => { if (e.pointerId === swipePointer) { swipePointer = null; swipeBlocked = false; sx = null; } });

  const nav = el('div', { class: 'pg-nav' }, [prev, el('div', { class: 'pg-center' }, [jump, ind]), next]);
  nav.hidden = !isOpen;

  // Tap the outer page edges to turn: left edge = forward, right edge = back.
  // These narrow zones sit over the margins only, so coin buttons in the page body stay clickable.
  const edgePrev = el('button', {
    class: 'page-edge page-edge-right', type: 'button',
    'aria-label': 'דף אחד אחורה', title: 'דף אחורה',
    onclick: e => { e.stopPropagation(); backward(); }
  });
  const edgeNext = el('button', {
    class: 'page-edge page-edge-left', type: 'button',
    'aria-label': 'דף אחד קדימה', title: 'דף קדימה',
    onclick: e => { e.stopPropagation(); forward(); }
  });
  const edges = el('div', { class: 'page-edges', 'aria-hidden': isOpen ? 'false' : 'true' }, [edgeNext, edgePrev]);
  edges.hidden = !isOpen;

  view.append(el('div', { class: 'desk' }, [book, edges, nav]));
  if (isOpen) paint();
  if (inReader && !isOpen && bk.autoOpen) { bk.autoOpen = false; setTimeout(() => cover.click(), 60); }
}

/* ---------- full-screen reading mode ---------- */
// The open book is wider than tall (two sheets side by side), so a phone held upright is the wrong shape.
// Reading mode goes full screen and asks for landscape; where the phone can't lock orientation,
// the book itself is turned 90 degrees and the reader turns the phone.
const reader = { rotated: false, portrait: false, pushed: false, zoom: 1, panX: 0, panY: 0 };

function resetReaderZoom() {
  reader.zoom = 1; reader.panX = 0; reader.panY = 0;
  applyReaderZoom(true);
}
let readerZoomFrame = 0;
function applyReaderZoom(immediate = false) {
  const paint = () => {
    readerZoomFrame = 0;
    const desk = $('#readerStage .desk'); if (!desk) return;
    desk.style.setProperty('--reader-zoom', String(reader.zoom));
    desk.style.setProperty('--reader-pan-x', reader.panX + 'px');
    desk.style.setProperty('--reader-pan-y', reader.panY + 'px');
    desk.classList.toggle('zoomed', reader.zoom > 1.01);
  };
  if (immediate) {
    if (readerZoomFrame) cancelAnimationFrame(readerZoomFrame);
    paint(); return;
  }
  if (!readerZoomFrame) readerZoomFrame = requestAnimationFrame(paint);
}
function installReaderZoom() {
  const stage = $('#readerStage'); if (!stage || stage.dataset.zoomReady) return;
  stage.dataset.zoomReady = '1';
  let touches = new Map(), pinch = false, startDist = 0, startZoom = 1, startPanX = 0, startPanY = 0, startMid = null;
  let swipeStart = null;

  const vals = () => [...touches.values()];
  const dist = () => { const p=vals(); return p.length<2 ? 0 : Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y); };
  const mid = () => { const p=vals(); return p.length<2 ? null : {x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2}; };

  stage.addEventListener('touchstart', e => {
    if (!st.reader) return;
    touches.clear();
    for (const t of e.touches) touches.set(t.identifier,{x:t.clientX,y:t.clientY});
    if (e.touches.length === 1) {
      pinch = false;
      swipeStart = { x:e.touches[0].clientX, y:e.touches[0].clientY };
    } else if (e.touches.length >= 2) {
      pinch = true; swipeStart = null;
      stage.classList.add('pinching');
      startDist=dist(); startZoom=reader.zoom; startPanX=reader.panX; startPanY=reader.panY; startMid=mid();
      e.preventDefault();
    }
  }, {passive:false});

  stage.addEventListener('touchmove', e => {
    touches.clear();
    for (const t of e.touches) touches.set(t.identifier,{x:t.clientX,y:t.clientY});
    if (pinch && e.touches.length >= 2 && startDist) {
      const m=mid(); reader.zoom=Math.max(1,Math.min(3.5,startZoom*dist()/startDist));
      reader.panX=startPanX+(m.x-startMid.x); reader.panY=startPanY+(m.y-startMid.y);
      if (reader.zoom<=1.01) { reader.zoom=1; reader.panX=reader.panY=0; }
      applyReaderZoom(); e.preventDefault();
    }
  }, {passive:false});

  stage.addEventListener('touchend', e => {
    if (!st.reader) return;
    if (!pinch && swipeStart && e.changedTouches.length === 1) {
      let dx=e.changedTouches[0].clientX-swipeStart.x, dy=e.changedTouches[0].clientY-swipeStart.y;
      if (reader.rotated) [dx,dy]=[dy,-dx];
      if (Math.abs(dx)>40 && Math.abs(dx)>Math.abs(dy)*1.25) {
        const book=stage.querySelector('.book');
        if (book) {
          // Reuse the book's established pointer swipe direction by clicking the matching navigation control.
          const nav=stage.querySelector('.pg-nav');
          const buttons=nav ? nav.querySelectorAll('button') : [];
          if (buttons.length>=2) (dx>0 ? buttons[1] : buttons[0]).click();
        }
      }
    }
    if (e.touches.length < 2) { pinch=false; startDist=0; stage.classList.remove('pinching'); applyReaderZoom(true); }
    if (!e.touches.length) { touches.clear(); swipeStart=null; }
  }, {passive:false});
  stage.addEventListener('touchcancel', () => { touches.clear(); pinch=false; startDist=0; swipeStart=null; stage.classList.remove('pinching'); applyReaderZoom(true); });

  stage.addEventListener('dblclick', e => {
    if (!st.reader || e.target.closest('.pg-nav,.reader-x')) return;
    if (reader.zoom>1.01) resetReaderZoom();
    else { reader.zoom=2; reader.panX=reader.panY=0; applyReaderZoom(); }
  });
  stage.addEventListener('wheel', e => {
    if (!st.reader || (!e.ctrlKey && Math.abs(e.deltaY)<1)) return;
    reader.zoom=Math.max(1,Math.min(3.5,reader.zoom*(e.deltaY<0?1.12:.89)));
    if (reader.zoom<=1.01) { reader.zoom=1; reader.panX=reader.panY=0; }
    applyReaderZoom(); e.preventDefault();
  }, {passive:false});
}
function enterReader() {
  const bk = st.book[st.tab];
  reader.portrait = window.innerHeight > window.innerWidth * 1.05;
  reader.rotated = false;
  st.reader = true; bk.autoOpen = true; resetReaderZoom(); installReaderZoom();
  $('#reader').hidden = false; document.body.classList.add('reading');
  const de = document.documentElement;
  if (de.requestFullscreen && !document.fullscreenElement) {
    de.requestFullscreen({ navigationUI: 'hide' })
      .catch(() => {}).finally(layoutReader);
  }
  try { history.pushState({ reader: 1 }, ''); reader.pushed = true; } catch (e) {}
  render();
}
function exitReader(fromHistory) {
  if (!st.reader) return;
  st.reader = false; resetReaderZoom();
  const bk = st.book[st.tab]; if (bk) bk.open = false;
  $('#reader').hidden = true; $('#readerStage').textContent = ''; document.body.classList.remove('reading');
  // turn the screen back upright first (a lock only works while still full screen), then leave full screen;
  // the installed app's default orientation is portrait, so it stays upright afterwards
  const so = screen.orientation;
  const upright = so && so.lock && document.fullscreenElement ? so.lock('portrait-primary').catch(() => {}) : Promise.resolve();
  upright.finally(() => {
    try { if (so && so.unlock) so.unlock(); } catch (e) {}
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    window.scrollTo({ top: 0 });
  });
  if (reader.pushed && !fromHistory) { reader.pushed = false; history.back(); } else reader.pushed = false;
  render();
}
function layoutReader() {
  if (!st.reader) return;
  const stage = $('#readerStage'), W = window.innerWidth, H = window.innerHeight;
  const portrait = H > W * 1.05;
  const changed = reader.portrait !== portrait;
  reader.portrait = portrait;
  reader.rotated = false;
  stage.style.width = W + 'px'; stage.style.height = H + 'px';
  stage.style.transform = 'translate(-50%, -50%)';
  if (changed) {
    resetReaderZoom();
    render();
  }
  const book = stage.querySelector('.book');
  if (book) {
    const pw = portrait
      ? Math.max(160, Math.min(W - 4, (H - 12) * 242 / 312))
      : Math.max(80, Math.min((W - 132) / 2, (H - 34) * 242 / 312));
    book.style.setProperty('--pw', pw + 'px');
  }
  applyReaderZoom();
}
window.addEventListener('resize', layoutReader);
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && st.reader) exitReader(false); });
window.addEventListener('popstate', () => {
  if (sheetHistoryPushed) { closeSheet(true); return; }
  if (st.reader) { reader.pushed = false; exitReader(true); }
});

let toastTimer = 0;
function toast(text) {
  const t = $('#toast'); t.textContent = text; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2400);
}

/* ---------- detail sheet ---------- */
let sheetHistoryPushed = false;
function closeSheet(fromHistory = false) {
  const dlg = $('#sheet');
  if (dlg.open) dlg.close();
  if (sheetHistoryPushed && !fromHistory) {
    sheetHistoryPushed = false;
    history.back();
  } else if (fromHistory) sheetHistoryPushed = false;
}
function openSheet(id, msg) {
  const item = findItem(id); if (!item) return;
  const rec = st.owned.get(id);
  const body = $('#sheetBody'); body.textContent = '';
  body.append(el('button', { class: 'sheet-x', type: 'button', 'aria-label': 'סגור', text: '✕', onclick: () => closeSheet() }));
  const hasPhoto = rec && (st.photos.get(id) || st.photos.get(id + REV));
  body.append(el('div', { class: 'sheet-head' }, [
    hasPhoto ? el('button', { class: 'slot own m-' + item.metal + ' head-photo', type: 'button', 'aria-label': 'הצג את התמונה בגדול', onclick: () => openLightbox(item, st.photos.get(id) ? 'front' : 'back') }, [coinEl(item)])
      : el('span', { class: 'slot m-' + item.metal + (rec ? ' own' : '') }, [coinEl(item)]),
    el('div', {}, [el('h2', { text: item.title }), el('p', { text: item.sub })]),
  ]));
  const facts = el('dl', { class: 'facts' });
  const add = (k, v) => { if (v) facts.append(el('dt', { text: k }), el('dd', { text: v })); };
  add('מתכת', item.metalName); add('עיצוב', item.design);
  body.append(facts);
  body.append(el('div', { class: 'status ' + (rec ? 'yes' : 'no'), text: rec ? '✓ באלבום' : 'עוד לא באלבום' }));
  if (item.rare) body.append(el('div', { class: 'rare-note' }, [el('span', { 'aria-hidden': 'true', text: '◆' }), item.rare]));

  const f = el('form', { class: 'fields' });
  let grade = rec?.grade || '';
  const gradeBox = el('div', { class: 'grades', role: 'group', 'aria-labelledby': 'f-grade-l' });
  for (const g of GRADES) {
    const gb = el('button', { type: 'button', 'aria-pressed': String(g === grade), text: g || '?', title: g || 'לא ידוע' });
    gb.addEventListener('click', () => { grade = g; gradeBox.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === gb))); });
    gradeBox.append(gb);
  }
  const paid = el('input', { id: 'f-paid', type: 'number', min: '0', step: 'any', inputmode: 'decimal', placeholder: 'למשל 180' });
  if (typeof rec?.paid === 'number') paid.value = rec.paid;
  const date = el('input', { id: 'f-date', type: 'date' }); if (rec?.acquired) date.value = rec.acquired;
  const note = el('textarea', { id: 'f-note', rows: '2', placeholder: 'מאיפה, וריאנט, פגמים...' }); note.value = rec?.note || '';
  f.append(
    el('div', { class: 'field' }, [el('label', { id: 'f-grade-l', text: 'מצב המטבע' }), gradeBox]),
    el('div', { class: 'row2' }, [
      el('div', { class: 'field' }, [el('label', { for: 'f-paid', text: 'כמה שילמתי (₪)' }), paid]),
      el('div', { class: 'field' }, [el('label', { for: 'f-date', text: 'תאריך רכישה' }), date]),
    ]),
    el('div', { class: 'field' }, [el('label', { for: 'f-note', text: 'הערות' }), note]),
    photoSection(item),
  );
  const msgEl = el('div', { class: 'msg' + (msg ? ' ok' : ''), text: msg || '' });
  const save = el('button', { class: 'btn ' + (rec ? 'primary' : 'accent'), type: 'submit', text: rec ? 'שמור שינויים' : '+ הכנס לאלבום' });

  const left = el('div', { class: 'confirm' });
  if (rec) {
    const rm = el('button', { class: 'btn danger', type: 'button', text: 'הסר מהאוסף' });
    rm.addEventListener('click', () => {
      left.textContent = '';
      left.append(el('span', { text: 'להסיר את המטבע מהאוסף?' }),
        el('button', { class: 'btn danger', type: 'button', text: 'כן, הסר', onclick: () => removeOwned(item, msgEl) }),
        el('button', { class: 'btn', type: 'button', text: 'ביטול', onclick: () => openSheet(id) }));
    });
    left.append(rm);
  }
  f.append(el('div', { class: 'actions' }, [el('div', { class: 'confirm' }, [save]), left]), msgEl);
  f.addEventListener('submit', e => {
    e.preventDefault();
    saveOwned(item, { grade, paid: paid.value, acquired: date.value, note: note.value.trim() }, msgEl, save);
  });
  body.append(f);
  const dlg = $('#sheet');
  if (!dlg.open) {
    dlg.showModal();
    if (st.reader && !sheetHistoryPushed) {
      try { history.pushState({ reader: 1, sheet: id }, ''); sheetHistoryPushed = true; } catch (e) {}
    }
  }
}

async function saveOwned(item, v, msgEl, btn) {
  const n = v.paid === '' ? null : Number(v.paid);
  if (n !== null && (!isFinite(n) || n < 0)) { msgEl.className = 'msg err'; msgEl.textContent = 'הסכום צריך להיות מספר חיובי.'; return; }
  const rec = { series: item.series, grade: v.grade, paid: n, acquired: v.acquired, note: v.note, updatedAt: nowIso() };
  btn.disabled = true;
  try {
    const isNew = !st.owned.has(item.id);
    await Store.put('owned', item.id, rec);
    st.owned.set(item.id, rec);
    if (isNew) { st.justAdded = item.id; $('#sheet').close(); render(); toast(item.title + ' נכנס לאלבום ✓'); }
    else { $('#sheet').close(); render(); toast('השינויים נשמרו ✓'); }
  } catch (e) {
    btn.disabled = false; msgEl.className = 'msg err'; msgEl.textContent = 'השמירה נכשלה. ייתכן שהזיכרון בטלפון מלא.';
  }
}
async function removeOwned(item, msgEl) {
  try {
    await Store.del('owned', item.id); st.owned.delete(item.id);
    await deletePhotos(item.id);
    if (item.custom) { await Store.del('extras', item.extraId); st.extras.delete(item.extraId); $('#sheet').close(); render(); return; }
    render(); openSheet(item.id, 'הוסר מהאוסף.');
  } catch (e) { msgEl.className = 'msg err'; msgEl.textContent = 'ההסרה נכשלה. נסה שוב.'; }
}

/* ---------- photos (obverse + reverse) ---------- */
const REV = ':r';                       // photos store key suffix for the reverse side
function setPhotoUrl(key, blob) {
  const old = st.photos.get(key); if (old) URL.revokeObjectURL(old);
  if (blob) st.photos.set(key, URL.createObjectURL(blob)); else st.photos.delete(key);
}
async function deletePhotos(id) {
  for (const k of [id, id + REV]) { await Store.del('photos', k); setPhotoUrl(k, null); }
}
function photoSection(item) {
  const own = st.owned.has(item.id);
  const front = own && st.photos.get(item.id), back = own && st.photos.get(item.id + REV);
  const camIn = el('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
  const galIn = el('input', { type: 'file', accept: 'image/*', hidden: true });
  let mode = 'both';
  for (const input of [camIn, galIn]) input.addEventListener('change', async () => {
    const f = input.files && input.files[0]; input.value = '';
    if (f) await takePhotos(item, f, mode);
  });
  const pick = (m, from) => { mode = m; (from === 'gallery' ? galIn : camIn).click(); };
  const sourceBtns = (m, cls) => [
    el('button', { class: 'btn ' + cls, type: 'button', text: '📷 מצלמה', onclick: () => pick(m, 'camera') }),
    el('button', { class: 'btn ' + cls, type: 'button', text: '🖼 מהגלריה', onclick: () => pick(m, 'gallery') }),
  ];
  const sideTools = (m, label) => el('div', { class: 'ph-src ph-side-tools' }, [
    el('span', { class: 'muted', text: label + ':' }), ...sourceBtns(m, ''),
  ]);
  const kids = [camIn, galIn];
  if (front || back) {
    const thumb = (url, t, side) => el('figure', { class: 'ph' }, [url
      ? el('button', { class: 'ph-open', type: 'button', 'aria-label': 'הצג את ה' + t + ' בגדול', onclick: () => openLightbox(item, side) }, [el('img', { src: url, alt: t })])
      : el('span', { class: 'ph-missing', text: '?' }), el('figcaption', { text: t })]);
    kids.push(el('div', { class: 'ph-pair' }, [thumb(front, 'צד קדמי', 'front'), thumb(back, 'צד אחורי', 'back')]));
    kids.push(sideTools('front', front ? 'צלם/העלה מחדש צד קדמי' : 'הוסף צד קדמי'));
    kids.push(sideTools('back', back ? 'צלם/העלה מחדש צד אחורי' : 'הוסף צד אחורי'));
    if (front && back) kids.push(el('button', { class: 'btn swap-photos', type: 'button', text: '⇄ החלף בין קדמי לאחורי', onclick: async () => {
      await swapCoinPhotos(item); openSheet(item.id, 'הצדדים הוחלפו.');
    }}));
    kids.push(el('div', { class: 'ph-src' }, [el('span', { class: 'muted', text: 'צלם מחדש את שני הצדדים:' }), ...sourceBtns('both', '')]));
    kids.push(el('div', { class: 'confirm' }, [el('button', { class: 'btn danger', type: 'button', text: 'מחק תמונות', onclick: async () => {
      await deletePhotos(item.id); render(); openSheet(item.id, 'התמונות נמחקו.');
    } })]));
  } else {
    kids.push(el('div', { class: 'photo-cta' }, [
      el('b', { text: 'תמונות המטבע (2 צדדים)' }),
      el('div', { class: 'confirm' }, sourceBtns('both', 'accent')),
      el('span', { class: 'muted', text: 'צלם קודם את הצד הקדמי ומיד אחריו את האחורי. רק אחרי ששתי התמונות צולמו תעבור לעריכה שלהן.' }),
    ]));
  }
  return el('div', { class: 'photo-slot' }, kids);
}

function askForSecondSide() {
  return new Promise(resolve => {
    const dlg = $('#cropper'), body = $('#cropperBody');
    const input = el('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
    const gallery = el('input', { type: 'file', accept: 'image/*', hidden: true });
    let done = false;
    const finish = v => { if (done) return; done = true; if (dlg.open) dlg.close(); resolve(v); };
    input.addEventListener('change', () => finish(input.files && input.files[0] || null));
    gallery.addEventListener('change', () => finish(gallery.files && gallery.files[0] || null));
    body.textContent = '';
    body.append(
      el('span', { class: 'step', text: 'צילום 2 מתוך 2' }),
      el('h2', { text: 'עכשיו הצד האחורי' }),
      el('p', { class: 'muted', text: 'הפוך את המטבע וצלם מיד את הצד השני. אחרי זה נערוך את שתי התמונות ברצף.' }),
      input, gallery,
      el('div', { class: 'confirm' }, [
        el('button', { class: 'btn accent', type: 'button', text: '📷 מצלמה', onclick: () => input.click() }),
        el('button', { class: 'btn accent', type: 'button', text: '🖼 מהגלריה', onclick: () => gallery.click() }),
        el('button', { class: 'btn', type: 'button', text: 'ביטול', onclick: () => finish(null) }),
      ]),
    );
    dlg.addEventListener('cancel', () => finish(null), { once: true });
    dlg.showModal();
  });
}

async function saveCoinPhoto(item, side, blob) {
  const key = side === 'back' ? item.id + REV : item.id;
  await Store.put('photos', key, blob); setPhotoUrl(key, blob);
}
async function ensureOwnedForPhoto(item) {
  if (st.owned.has(item.id)) return false;
  const rec = { series: item.series, grade: '', paid: null, acquired: '', note: '', updatedAt: nowIso() };
  await Store.put('owned', item.id, rec); st.owned.set(item.id, rec); st.justAdded = item.id; return true;
}
async function swapCoinPhotos(item) {
  const entries = new Map(await Store.all('photos'));
  const frontBlob = entries.get(item.id), backBlob = entries.get(item.id + REV);
  if (!frontBlob || !backBlob) return;
  await Store.put('photos', item.id, backBlob);
  await Store.put('photos', item.id + REV, frontBlob);
  setPhotoUrl(item.id, backBlob); setPhotoUrl(item.id + REV, frontBlob); render();
}
async function takePhotos(item, firstFile, mode) {
  const dlg = $('#cropper'), body = $('#cropperBody');
  let front = null, back = null, second = null;
  try {
    if (mode === 'both') {
      // Capture both originals first; editing starts only after both sides are available.
      second = await askForSecondSide();
      if (!second) { toast('לא נשמר. צריך לצלם את שני הצדדים.'); return; }
      front = await Photo.crop(firstFile, dlg, body, el, 'עריכה 1 מתוך 2: הצד הקדמי');
      if (!front) return;
      back = await Photo.crop(second, dlg, body, el, 'עריכה 2 מתוך 2: הצד האחורי');
      if (!back) { toast('לא נשמר. צריך לאשר את שתי התמונות.'); return; }
    } else {
      const label = mode === 'front' ? 'עריכת הצד הקדמי' : 'עריכת הצד האחורי';
      const edited = await Photo.crop(firstFile, dlg, body, el, label);
      if (!edited) return;
      if (mode === 'front') front = edited; else back = edited;
    }
  } catch (e) { toast('לא הצלחתי לפתוח את התמונה. נסה תמונה אחרת.'); return; }
  try {
    if (front) await saveCoinPhoto(item, 'front', front);
    if (back) await saveCoinPhoto(item, 'back', back);
    const isNew = await ensureOwnedForPhoto(item);
    render(); openSheet(item.id, isNew ? 'התמונות נשמרו והמטבע נכנס לאלבום.' : 'התמונה נשמרה.');
  } catch (e) { toast('שמירת התמונות נכשלה. ייתכן שהזיכרון בטלפון מלא.'); }
}

/* ---------- full-screen photo ---------- */
function openLightbox(item, side) {
  const dlg = $('#lightbox'), body = $('#lightboxBody');
  const urls = { front: st.photos.get(item.id), back: st.photos.get(item.id + REV) };
  let cur = urls[side] ? side : (urls.front ? 'front' : 'back');
  const img = el('img', { class: 'lb-img', alt: '' });
  const cap = el('div', { class: 'lb-cap' });
  const tabs = el('div', { class: 'lb-tabs', role: 'group', 'aria-label': 'צד' });
  const show = s => {
    if (!urls[s]) return; cur = s; img.src = urls[s]; img.alt = item.title + ', ' + (s === 'front' ? 'צד קדמי' : 'צד אחורי');
    tabs.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.s === s)));
  };
  for (const [s, t] of [['front', 'קדמי'], ['back', 'אחורי']]) if (urls[s]) tabs.append(el('button', { type: 'button', 'data-s': s, text: t, onclick: e => { e.stopPropagation(); show(s); } }));
  cap.append(el('b', { text: item.title }), el('span', { text: item.sub || '' }));
  body.replaceChildren(
    el('button', { class: 'lb-x', type: 'button', 'aria-label': 'סגור', text: '✕', onclick: () => dlg.close() }),
    img, cap, tabs.children.length > 1 ? tabs : null);
  // swipe between the two sides; a tap on the dark background closes
  let sx = null;
  img.onpointerdown = e => { sx = e.clientX; };
  img.onpointerup = e => { if (sx !== null && Math.abs(e.clientX - sx) > 40) show(cur === 'front' ? 'back' : 'front'); sx = null; };
  body.onclick = e => { if (e.target === body) dlg.close(); };
  show(cur);
  dlg.showModal();
}

/* ---------- customize a catalog album ---------- */
function openCustomize(col) {
  if (!col || col.kind !== 'catalog') return;
  const cat = CATALOGS[col.id], h = hiddenOf(col.id);
  if (!cat.list) { toast('הקטלוג עוד נטען, נסה שוב בעוד רגע.'); return; }
  const groupsHidden = new Set(h.groups), itemsHidden = new Set(h.items);
  const body = $('#adderBody'); body.textContent = '';
  const count = el('p', { class: 'muted' });
  const refreshCount = () => {
    const n = cat.list.filter(it => !groupsHidden.has(it.group) && !itemsHidden.has(it.id) && (varBox.checked || !it.variant)).length;
    count.textContent = 'באלבום יופיעו ' + n + ' מתוך ' + cat.list.length + ' מטבעות.';
  };
  const nVar = cat.list.filter(it => it.variant).length;
  const varBox = el('input', { type: 'checkbox', id: 'cz-var' }); varBox.checked = col.showVariants !== false;
  const varRow = nVar ? el('label', { class: 'cz-var', for: 'cz-var' }, [varBox, el('span', {}, [el('b', { text: 'הצג וריאנטים' }), el('small', { text: ' (' + nVar + ' מטבעות: מטבעות שונות, סגסוגות, תאריכים גדולים/קטנים וכו\')' })])]) : null;
  const list = el('div', { class: 'cz-list' });
  for (const g of cat.groups) {
    const items = cat.list.filter(it => it.group === g.key);
    const gBox = el('input', { type: 'checkbox', id: 'cz-' + g.key });
    gBox.checked = !groupsHidden.has(g.key);
    const itemBoxes = items.map(it => {
      const b = el('input', { type: 'checkbox', id: 'czi-' + it.id }); b.checked = !itemsHidden.has(it.id); b.disabled = !gBox.checked;
      b.addEventListener('change', () => { b.checked ? itemsHidden.delete(it.id) : itemsHidden.add(it.id); refreshCount(); });
      return el('label', { class: 'cz-item', for: 'czi-' + it.id }, [b, el('span', { text: it.title + (st.owned.has(it.id) ? ' ✓' : '') })]);
    });
    gBox.addEventListener('change', () => {
      gBox.checked ? groupsHidden.delete(g.key) : groupsHidden.add(g.key);
      itemBoxes.forEach(lb => { lb.querySelector('input').disabled = !gBox.checked; });
      refreshCount();
    });
    list.append(el('details', { class: 'cz-group' }, [
      el('summary', {}, [el('label', { class: 'cz-g', for: 'cz-' + g.key, onclick: e => e.stopPropagation() }, [gBox, el('b', { text: g.name })]), el('span', { class: 'cz-n', text: items.length + ' מטבעות' })]),
      el('div', { class: 'cz-items' }, itemBoxes),
    ]));
  }
  const setAll = on => { list.querySelectorAll('.cz-g input').forEach(b => { if (b.checked !== on) { b.checked = on; b.dispatchEvent(new Event('change')); } }); };
  const save = el('button', { class: 'btn accent', type: 'button', text: 'שמור', onclick: async () => {
    col.hidden = { groups: [...groupsHidden], items: [...itemsHidden] };
    col.showVariants = varBox.checked;
    await saveCollections(); $('#adder').close(); render(); toast('האלבום עודכן');
  } });
  body.append(
    el('h2', { text: 'התאמת האלבום: ' + col.name }),
    el('p', { class: 'muted', text: 'סמן רק את מה שאתה אוסף. אפשר להוריד ' + cat.groupLabel + ' שלם, או לפתוח אותו ולבחור מטבעות בודדים. מטבעות שמוסתרים לא נמחקים, והם יחזרו אם תסמן אותם שוב.' }),
    el('div', { class: 'confirm' }, [
      el('button', { class: 'btn', type: 'button', text: 'סמן הכול', onclick: () => setAll(true) }),
      el('button', { class: 'btn', type: 'button', text: 'נקה הכול', onclick: () => setAll(false) }),
    ]),
    varRow, list, count,
    el('div', { class: 'confirm' }, [save, el('button', { class: 'btn', type: 'button', text: 'ביטול', onclick: () => $('#adder').close() })]),
  );
  varBox.addEventListener('change', refreshCount);
  refreshCount();
  $('#adder').showModal();
}

/* ---------- assistant (rule-based, see bot.js) ---------- */
const botApi = {
  collections: () => st.collections,
  current: () => curCol(),
  library: () => Object.entries(CATALOGS).map(([id, c]) => ({ id, name: c.name })),
  addCatalog: id => addCatalog(id),
  groups: id => (CATALOGS[id] && CATALOGS[id].groups) || [],
  groupLabel: id => (CATALOGS[id] && CATALOGS[id].groupLabel) || 'קבוצה',
  items: (id, includeHidden) => includeHidden && CATALOGS[id] ? (CATALOGS[id].list || []).concat([...st.extras.values()].filter(x => x.series === id)) : allItems(id),
  isOwned: id => st.owned.has(id),
  isHidden: (colId, item) => !visibleIn(colId)(item),
  hidden: id => { const h = hiddenOf(id); return { groups: [...h.groups], items: [...h.items] }; },
  async setHidden(id, h) {
    const col = colById(id), prev = col.hidden ? JSON.parse(JSON.stringify(col.hidden)) : { groups: [], items: [] };
    col.hidden = h; await saveCollections(); render();
    return async () => { col.hidden = prev; await saveCollections(); render(); };
  },
  async setOwned(ids, own) {
    const changed = [];
    for (const id of ids) {
      const item = findItem(id) || { series: st.tab };
      if (own && !st.owned.has(id)) {
        const rec = { series: item.series, grade: '', paid: null, acquired: '', note: '', updatedAt: nowIso() };
        await Store.put('owned', id, rec); st.owned.set(id, rec); changed.push([id, null]);
      } else if (!own && st.owned.has(id)) {
        const old = st.owned.get(id); await Store.del('owned', id); st.owned.delete(id); changed.push([id, old]);
      }
    }
    render();
    return async () => {
      for (const [id, old] of changed) { if (old) { await Store.put('owned', id, old); st.owned.set(id, old); } else { await Store.del('owned', id); st.owned.delete(id); } }
      render();
    };
  },
  stats: id => {
    if (id) return seriesStats(id);
    let have = 0, total = 0; for (const c of st.collections) { const x = seriesStats(c.id); have += x.have; total += x.total; }
    return { have, total, pct: total ? Math.round(have / total * 100) : 0 };
  },
};
const botLog = [];
function openBot() {
  const dlg = $('#botDlg'), body = $('#botBody');
  const msgs = el('div', { class: 'bot-msgs', role: 'log', 'aria-live': 'polite' });
  const input = el('input', { id: 'bot-in', autocomplete: 'off', placeholder: 'למשל: השאר רק ויקטוריה' });
  const say = (who, text, undo) => {
    const b = el('div', { class: 'bot-msg ' + who }, [el('span', { text })]);
    if (undo) {
      const u = el('button', { class: 'btn bot-undo', type: 'button', text: 'בטל' });
      u.addEventListener('click', async () => { u.disabled = true; await undo(); u.textContent = 'בוטל'; });
      b.append(u);
    }
    msgs.append(b); msgs.scrollTop = msgs.scrollHeight;
  };
  const send = async text => {
    text = (text || '').trim(); if (!text) return;
    botLog.push(['me', text]); say('me', text); input.value = '';
    let res; try { res = await Bot.handle(text, botApi); } catch (e) { res = { reply: 'משהו השתבש. נסה לנסח אחרת.' }; }
    botLog.push(['bot', res.reply]); say('bot', res.reply, res.undo);
  };
  const form = el('form', { class: 'bot-form' }, [input, el('button', { class: 'btn accent', type: 'submit', text: 'שלח' })]);
  form.addEventListener('submit', e => { e.preventDefault(); send(input.value); });
  const chips = el('div', { class: 'bot-chips' }, ['כמה יש לי', 'מה חסר לי', 'עזרה'].map(t => el('button', { class: 'chip', type: 'button', text: t, onclick: () => send(t) })));
  body.replaceChildren(
    el('div', { class: 'bot-head' }, [el('b', { text: 'העוזר של האלבום' }), el('button', { class: 'lb-x bot-x', type: 'button', 'aria-label': 'סגור', text: '✕', onclick: () => dlg.close() })]),
    msgs, chips, form);
  if (!botLog.length) say('bot', 'שלום! אני יכול להסתיר או להחזיר חלקים מהאלבום, לסמן מטבעות שיש לך, ולספר מה חסר. כתוב "עזרה" לדוגמאות.');
  else for (const [w, t] of botLog) say(w, t);
  dlg.showModal(); setTimeout(() => input.focus(), 50);
}

/* ---------- add dialog ---------- */
function openAdder() {
  const body = $('#adderBody'); body.textContent = '';
  body.append(el('h2', { text: 'הוספת מטבע לאוסף' }));
  if (!st.collections.length) { openLibrary(); return; }
  const seriesSel = el('select', { id: 'a-series' }, st.collections.map(c => el('option', { value: c.id, text: c.name })));
  seriesSel.value = curCol().id;
  const coinSel = el('select', { id: 'a-coin' });
  const fillCoins = () => {
    coinSel.textContent = '';
    const missing = allItems(seriesSel.value).filter(i => !st.owned.has(i.id));
    coinSel.append(el('option', { value: '', text: missing.length ? 'בחר מטבע שחסר לך...' : 'יש לך את כל המטבעות בסדרה' }));
    for (const i of missing) coinSel.append(el('option', { value: i.id, text: i.title + (i.series === 'crowns' ? ' · ' + i.sub : '') }));
  };
  seriesSel.addEventListener('change', fillCoins); fillCoins();
  const msgEl = el('div', { class: 'msg' });
  const go = el('button', { class: 'btn primary', type: 'button', text: 'המשך', onclick: () => {
    if (!coinSel.value) { msgEl.className = 'msg err'; msgEl.textContent = 'בחר מטבע מהרשימה.'; return; }
    $('#adder').close(); openSheet(coinSel.value);
  } });
  body.append(
    el('div', { class: 'field' }, [el('label', { for: 'a-series', text: 'סדרה' }), seriesSel]),
    el('div', { class: 'field' }, [el('label', { for: 'a-coin', text: 'מטבע מהקטלוג' }), coinSel]),
    el('div', { class: 'confirm' }, [go, el('button', { class: 'btn', type: 'button', text: 'ביטול', onclick: () => $('#adder').close() })]),
    msgEl,
    el('hr', { class: 'sep' }),
    el('h3', { text: 'מטבע שלא ברשימה' }),
    el('p', { class: 'muted', text: 'באוסף משלך כל המטבעות נוספים כך. באוסף מהספרייה: וריאנט, פרוף או טעות הטבעה.' }),
  );
  const label = el('input', { id: 'a-label', placeholder: 'למשל: קראון 1889 עם שפה LII' });
  const year = el('input', { id: 'a-year', type: 'number', min: '1800', max: '1970', inputmode: 'numeric', placeholder: 'שנה' });
  const diam = el('input', { id: 'a-diam', type: 'number', min: '10', max: '60', step: '0.1', inputmode: 'decimal', placeholder: 'למשל 38.6' });
  const metal = el('select', { id: 'a-metal' }, [['silver', 'כסף'], ['cuni', 'קופרו-ניקל'], ['bronze', 'ברונזה']].map(([v, t]) => el('option', { value: v, text: t })));
  const msg2 = el('div', { class: 'msg' });
  const addCustom = el('button', { class: 'btn', type: 'button', text: 'הוסף מטבע מותאם' });
  addCustom.addEventListener('click', async () => {
    if (!label.value.trim()) { msg2.className = 'msg err'; msg2.textContent = 'כתוב שם למטבע.'; return; }
    addCustom.disabled = true;
    try {
      const id = newId();
      const x = { series: seriesSel.value, label: label.value.trim(), year: year.value ? Number(year.value) : null, metal: metal.value, diam: diam.value ? Number(diam.value) : null };
      await Store.put('extras', id, x);
      const item = extraToItem(id, x); st.extras.set(id, item);
      const rec = { series: x.series, grade: '', paid: null, acquired: '', note: '', updatedAt: nowIso() };
      await Store.put('owned', item.id, rec); st.owned.set(item.id, rec);
      $('#adder').close(); st.tab = x.series; render(); openSheet(item.id, 'נוסף לאוסף. אפשר להשלים פרטים.');
    } catch (e) { addCustom.disabled = false; msg2.className = 'msg err'; msg2.textContent = 'ההוספה נכשלה. נסה שוב.'; }
  });
  body.append(el('div', { class: 'field' }, [el('label', { for: 'a-label', text: 'שם' }), label]),
    el('div', { class: 'row2' }, [el('div', { class: 'field' }, [el('label', { for: 'a-year', text: 'שנה' }), year]), el('div', { class: 'field' }, [el('label', { for: 'a-metal', text: 'מתכת' }), metal])]),
    el('div', { class: 'field' }, [el('label', { for: 'a-diam', text: 'קוטר (מ"מ), קובע את גודל הכיס באלבום' }), diam]),
    addCustom, msg2);
  if (curCol().kind === 'own') setTimeout(() => label.focus(), 50);
  $('#adder').showModal();
}

/* ---------- backup menu ---------- */
async function snapshot() {
  const owned = {}, extras = {}, photos = {};
  for (const [k, v] of st.owned) owned[k] = v;
  for (const [k, v] of st.extras) extras[k] = { series: v.series, label: v.title, year: v.y || null, metal: v.metal, diam: v.diam || null };
  for (const [k, blob] of await Store.all('photos')) photos[k] = await Photo.toDataURL(blob);
  return { app: 'coin-album', version: 3, exportedAt: nowIso(), collections: st.collections, owned, extras, photos };
}
function openMenu(msg) {
  const body = $('#menuBody'); body.textContent = '';
  const have = st.owned.size;
  const msgEl = el('div', { class: 'msg' + (msg ? ' ok' : ''), text: msg || '' });
  const exportBtn = el('button', { class: 'btn primary', type: 'button', text: 'שמור גיבוי לקובץ', onclick: async () => {
    const blob = new Blob([JSON.stringify(await snapshot())], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: 'coin-album-' + new Date().toISOString().slice(0, 10) + '.json' });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    try { localStorage.setItem('album.lastBackup', nowIso()); } catch (e) {}
    msgEl.className = 'msg ok'; msgEl.textContent = 'הקובץ נשמר בתיקיית ההורדות.';
  } });
  const file = el('input', { type: 'file', accept: 'application/json,.json', id: 'm-file', hidden: true });
  const importBtn = el('button', { class: 'btn', type: 'button', text: 'שחזר מגיבוי', onclick: () => file.click() });
  const confirmBox = el('div', { class: 'confirm' });
  file.addEventListener('change', async () => {
    const f = file.files && file.files[0]; if (!f) return;
    let data;
    try { data = JSON.parse(await f.text()); } catch (e) { data = null; }
    if (!data || data.app !== 'coin-album' || typeof data.owned !== 'object') {
      msgEl.className = 'msg err'; msgEl.textContent = 'הקובץ הזה לא גיבוי של האלבום.'; file.value = ''; return;
    }
    const n = Object.keys(data.owned).length;
    confirmBox.textContent = '';
    confirmBox.append(el('span', { text: 'הגיבוי מכיל ' + n + ' מטבעות ויחליף את מה שיש עכשיו באפליקציה (' + have + '). להמשיך?' }),
      el('button', { class: 'btn danger', type: 'button', text: 'כן, שחזר', onclick: async () => {
        try {
          const photos = {};
          for (const [k, url] of Object.entries(data.photos || {})) photos[k] = await Photo.fromDataURL(url);
          await Store.replaceAll(data.owned, data.extras || {}, photos);
          if (Array.isArray(data.collections)) await Store.put('meta', 'collections', data.collections);
          else await Store.del('meta', 'collections');   // older backups: work the collections out from the coins
          await load(); render(); openMenu('השחזור הושלם: ' + n + ' מטבעות.');
        }
        catch (e) { msgEl.className = 'msg err'; msgEl.textContent = 'השחזור נכשל.'; }
      } }),
      el('button', { class: 'btn', type: 'button', text: 'ביטול', onclick: () => openMenu() }));
    file.value = '';
  });
  let last = ''; try { last = localStorage.getItem('album.lastBackup') || ''; } catch (e) {}
  const colRows = st.collections.map(c => {
    const row = el('div', { class: 'col-row' }, [el('span', { text: c.name + (c.kind === 'own' ? ' (אוסף משלך)' : '') })]);
    const rm = el('button', { class: 'btn danger', type: 'button', text: 'הסר', onclick: () => {
      row.replaceChildren(el('span', { text: c.kind === 'own' ? 'להסיר את "' + c.name + '" ואת כל המטבעות שבו?' : 'להסיר את "' + c.name + '" מהאלבום? המטבעות שסימנת יישמרו אם תוסיף אותו שוב.' }),
        el('button', { class: 'btn danger', type: 'button', text: 'כן, הסר', onclick: async () => { await removeCollection(c); openMenu('האוסף הוסר.'); } }),
        el('button', { class: 'btn', type: 'button', text: 'ביטול', onclick: () => openMenu() }));
    } });
    row.append(rm); return row;
  });
  body.append(
    el('h2', { text: 'האוספים שלי' }),
    ...(colRows.length ? colRows : [el('p', { class: 'muted', text: 'עוד אין אוספים.' })]),
    el('button', { class: 'btn', type: 'button', text: '+ אוסף חדש', onclick: () => { $('#menu').close(); openLibrary(); } }),
    el('hr', { class: 'sep' }),
    el('h2', { text: 'גיבוי' }),
    el('p', { class: 'muted', text: 'האוסף והתמונות שמורים רק בטלפון הזה. כדאי לשמור גיבוי מדי פעם ולשלוח אותו לעצמך (למשל במייל או בדרייב). התמונות נכללות בגיבוי.' }),
    el('p', { class: 'muted', text: 'באוסף: ' + have + ' מטבעות. ' + (last ? 'גיבוי אחרון: ' + new Date(last).toLocaleDateString('he-IL') + '.' : 'עדיין לא נשמר גיבוי.') }),
    el('div', { class: 'confirm' }, [exportBtn, importBtn]), file, confirmBox, msgEl,
    el('div', { class: 'confirm' }, [el('button', { class: 'btn', type: 'button', text: 'סגור', onclick: () => $('#menu').close() })]),
  );
  if (!$('#menu').open) $('#menu').showModal();
}

/* ---------- collections: library, own collections, first launch ---------- */
function notice(kids) { const n = $('#notice'); n.textContent = ''; if (!kids) { n.hidden = true; return; } n.append(...[].concat(kids)); n.hidden = false; }
async function saveCollections() { await Store.put('meta', 'collections', st.collections); }
async function ensureCatalog(key) {
  try { await loadCatalogFile(key); } catch (e) { toast('לא הצלחתי לטעון את הקטלוג. בדוק חיבור לאינטרנט ונסה שוב.'); }
}
async function addCatalog(key) {
  await ensureCatalog(key);
  if (!colById(key)) { st.collections.push({ id: key, kind: 'catalog', name: CATALOGS[key].name, sub: CATALOGS[key].sub }); await saveCollections(); }
  st.tab = key; try { localStorage.setItem('album.tab', key); } catch (e) {}
  render(); toast('"' + CATALOGS[key].name + '" נוסף לאלבום');
}
async function addOwnCollection(name, sub) {
  const id = 'u-' + newId().slice(0, 8);
  st.collections.push({ id, kind: 'own', name, sub }); await saveCollections();
  st.tab = id; try { localStorage.setItem('album.tab', id); } catch (e) {}
  render(); toast('האוסף "' + name + '" נוצר');
}
async function removeCollection(c) {
  if (c.kind === 'own') {
    for (const [xid, it] of [...st.extras]) if (it.series === c.id) {
      await Store.del('extras', xid); await Store.del('owned', it.id); await deletePhotos(it.id); st.extras.delete(xid); st.owned.delete(it.id);
    }
  }
  st.collections = st.collections.filter(x => x.id !== c.id); await saveCollections(); render();
}
function libraryContent(onDone) {
  const cards = Object.entries(CATALOGS).map(([key, c]) => {
    const has = !!colById(key);
    return el('div', { class: 'lib-card ' + c.theme }, [
      el('b', { text: c.name }), el('span', { class: 'lib-sub', text: c.sub }), el('p', { text: c.about }),
      el('button', { class: 'btn ' + (has ? '' : 'gold'), type: 'button', text: has ? 'כבר באלבום שלך' : '+ הוסף לאלבום שלי', disabled: has,
        onclick: async () => { await addCatalog(key); onDone && onDone(); } }),
    ]);
  });
  const name = el('input', { id: 'l-name', placeholder: 'למשל: שטרות שואה, מטבעות ירושלים' });
  const sub = el('input', { id: 'l-sub', placeholder: 'תיאור קצר (לא חובה)' });
  const msg = el('div', { class: 'msg' });
  const own = el('form', { class: 'lib-own fields' }, [
    el('b', { text: 'אוסף משלך' }),
    el('p', { class: 'muted', text: 'תן לאוסף שם, ואז הוסף לו מטבעות אחד-אחד. לכל אוסף כריכה וספר משלו.' }),
    el('div', { class: 'field' }, [el('label', { for: 'l-name', text: 'שם האוסף' }), name]),
    el('div', { class: 'field' }, [el('label', { for: 'l-sub', text: 'תיאור' }), sub]),
    el('button', { class: 'btn accent', type: 'submit', text: 'צור אוסף' }), msg,
  ]);
  own.addEventListener('submit', async e => {
    e.preventDefault();
    if (!name.value.trim()) { msg.className = 'msg err'; msg.textContent = 'כתוב שם לאוסף.'; name.focus(); return; }
    await addOwnCollection(name.value.trim(), sub.value.trim()); onDone && onDone();
  });
  return [el('div', { class: 'lib-grid' }, cards), own];
}
function openLibrary() {
  const body = $('#adderBody');
  const close = () => $('#adder').close();

  function shell(title, sub, content, back) {
    body.textContent = '';
    body.append(
      el('h2', { text: title }),
      el('p', { class: 'muted', text: sub }),
      content,
      el('div', { class: 'confirm' }, [
        ...(back ? [el('button', { class: 'btn', type: 'button', text: '→ חזרה', onclick: back })] : []),
        el('button', { class: 'btn', type: 'button', text: 'סגור', onclick: close }),
      ])
    );
  }

  function showCatalogs() {
    const cards = libraryContent(close)[0];
    shell('אוסף מהמאגר', 'בחר אחד מהקטלוגים המוכנים והוסף אותו לאלבומים שלך.', cards, choose);
  }

  function showOwn() {
    const own = libraryContent(close)[1];
    shell('אוסף בעיצוב אישי', 'צור אלבום משלך ותוסיף אליו את המטבעות שאתה רוצה.', own, choose);
  }

  function choose() {
    const choices = el('div', { class: 'lib-grid collection-choices' }, [
      el('button', { class: 'lib-choice', type: 'button', onclick: showOwn }, [
        el('span', { class: 'lib-choice-icon', 'aria-hidden': 'true', text: '✦' }),
        el('b', { text: 'אוסף בעיצוב אישי' }),
        el('span', { text: 'צור אוסף משלך, עם שם ותוכן שאתה קובע.' }),
      ]),
      el('button', { class: 'lib-choice', type: 'button', onclick: showCatalogs }, [
        el('span', { class: 'lib-choice-icon', 'aria-hidden': 'true', text: '▦' }),
        el('b', { text: 'אוסף קיים מהמאגר' }),
        el('span', { text: 'בחר מנדט, פרוטה, קראונים וקטלוגים מוכנים נוספים.' }),
      ]),
    ]);
    shell('אוסף חדש', 'איך תרצה להתחיל את האוסף?', choices, null);
  }

  choose();
  if (!$('#adder').open) $('#adder').showModal();
}
function welcome() {
  return el('div', { class: 'welcome' }, [
    el('h2', { text: 'ברוך הבא לאלבום שלך' }),
    el('p', { class: 'muted', text: 'כל מה שתסמן, תצלם ותכתוב נשמר רק בטלפון הזה. כדי להתחיל, בחר קטלוג מוכן או צור אוסף משלך.' }),
    ...libraryContent(null),
  ]);
}
// Which collections a device keeps. Devices from before collections existed get the two catalogs they were using.
async function loadCollections() {
  let cols = null; try { cols = await Store.get('meta', 'collections'); } catch (e) {}
  if (!Array.isArray(cols)) {
    let used = false; try { used = !!(await Store.get('meta', 'starterOffered')); } catch (e) {}
    used = used || st.owned.size > 0 || st.extras.size > 0;
    cols = used ? Object.keys(CATALOGS).map(k => ({ id: k, kind: 'catalog', name: CATALOGS[k].name, sub: CATALOGS[k].sub })) : [];
    await Store.put('meta', 'collections', cols);
  }
  st.collections = cols.filter(c => c.kind === 'own' || CATALOGS[c.id]);
}

/* ---------- boot ---------- */
async function load() {
  const [owned, extras, photos] = await Promise.all([Store.all('owned'), Store.all('extras'), Store.all('photos')]);
  st.owned = owned;
  for (const id of [...st.photos.keys()]) setPhotoUrl(id, null);
  for (const [id, blob] of photos) setPhotoUrl(id, blob);
  st.extras = new Map([...extras].map(([id, x]) => [id, x]));
  await loadCollections();
  st.extras = new Map([...extras].map(([id, x]) => [id, extraToItem(id, x)]));   // needs the collections for names
  for (const c of st.collections) if (c.kind === 'catalog' && CATALOGS[c.id].src) ensureCatalog(c.id).then(render);
}

$('#addBtn').addEventListener('click', openAdder);
$('#botBtn').addEventListener('click', openBot);
$('#customizeBtn').addEventListener('click', () => openCustomize(curCol()));
$('#readerClose').addEventListener('click', () => exitReader(false));
$('#menuBtn').addEventListener('click', () => openMenu());
document.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => { st.filter = c.dataset.f; render(); }));
document.querySelectorAll('.vt').forEach(c => c.addEventListener('click', () => { st.view = c.dataset.v; try { localStorage.setItem('album.view', st.view); } catch (e) {} render(); }));
for (const d of [$('#sheet'), $('#adder'), $('#menu')]) d.addEventListener('click', e => { if (e.target === d) d.close(); });

render();
load().then(() => { st.ready = true; render(); Store.persist(); })
  .catch(() => notice(el('span', { text: 'לא הצלחתי לפתוח את האחסון בטלפון. אם הדפדפן במצב גלישה בסתר, פתח אותו במצב רגיל.' })));

if ('serviceWorker' in navigator) {
  // When a new version takes over, reload once so the screen shows it straight away.
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
    .then(reg => { document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); }); })
    .catch(() => {}));
}
})();
