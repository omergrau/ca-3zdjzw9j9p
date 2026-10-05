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

const ALBUM_COLORS = ['burgundy', 'blue', 'purple', 'green'];
const CATALOG_COLOR = { crowns: 'purple', mandate: 'green', pruta: 'blue' };
function albumColor(col) {
  if (!col) return 'burgundy';
  return ALBUM_COLORS.includes(col.color) ? col.color : (CATALOG_COLOR[col.id] || (col.kind === 'own' ? 'blue' : 'burgundy'));
}
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
function albumSettings(col) {
  const legacyVariants = col?.showVariants !== false;
  return Object.assign({ scope: 'all-years', variants: legacyVariants, mints: true }, col?.settings || {});
}
function showsVariants(series) { const c = colById(series); return albumSettings(c).variants !== false; }
function visibleIn(series) {
  const h = hiddenOf(series), c = colById(series), settings = albumSettings(c), v = settings.variants !== false, m = settings.mints !== false;
  return it => !h.groups.has(it.group) && !h.items.has(it.id) && (v || !it.variant) && (m || !it.mintVariant);
}
function allItems(series) {
  let base = CATALOGS[series] && CATALOGS[series].list && colById(series) ? CATALOGS[series].list.filter(visibleIn(series)) : [];
  const settings = albumSettings(colById(series));
  if (settings.scope === 'one-per-type') {
    const seen = new Set();
    base = base.filter(it => {
      if (st.owned.has(it.id)) return true;
      const k = it.typeKey || it.group || it.d || it.denomination || it.title.replace(/\b(18|19|20)\d{2}\b/g, '').trim();
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
  }
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
    host.append(el('button', { class: 'tab ' + themeOf(s) + ' album-' + albumColor(s), role: 'tab', type: 'button', 'aria-selected': String(st.tab === key),
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
  renderSort();
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
/* ---------- album order ----------
   Each collection keeps its own order: by the catalog's grouping (denomination, or reign for the crowns)
   or by year. Catalogs that span countries can also go country first, on top of either order. */
function sortModes(series) {
  const col = colById(series), cat = CATALOGS[series];
  if (!col || col.kind === 'own' || !cat) return [['added', 'סדר הוספה'], ['year', 'שנה']];
  return series === 'crowns' ? [['year', 'שנה'], ['group', cat.groupLabel]] : [['group', cat.groupLabel || 'ערך'], ['year', 'שנה']];
}
function hasCountries(series) { const cat = CATALOGS[series]; return !!(cat && cat.countries && cat.countries.length > 1); }
function sortOf(series) {
  const col = colById(series), modes = sortModes(series), s = (col && col.sort) || {};
  return { by: modes.some(m => m[0] === s.by) ? s.by : modes[0][0], country: !!s.country && hasCountries(series) };
}
async function setSort(series, sort) {
  const col = colById(series); if (!col) return;
  col.sort = sort;
  if (st.book && st.book[series]) st.book[series].p = 0;   // the pages move, so start from the first one
  await saveCollections(); render();
}
// where a coin's denomination stands in its catalog (groups are listed from the smallest value up)
function valueRank(it) {
  if (it.series === 'mandate') return it.d || 0;
  const cat = CATALOGS[it.series], i = cat && cat.groups ? cat.groups.findIndex(g => g.key === it.group) : -1;
  return i < 0 ? 0 : i;
}
const byYear = (a, b) => (Number(a.y) || 0) - (Number(b.y) || 0) || valueRank(a) - valueRank(b);
const byValue = (a, b) => valueRank(a) - valueRank(b) || (Number(a.y) || 0) - (Number(b.y) || 0);
function yearSpan(items) {
  const ys = items.map(i => Number(i.y)).filter(Boolean);
  if (!ys.length) return '';
  const lo = Math.min(...ys), hi = Math.max(...ys);
  return lo === hi ? String(lo) : lo + '–' + hi;
}
// Sections of the album, in order. A section starts on a new page; `years` sections title each page by its years.
function albumSections(series) {
  const extras = allItems(series).filter(i => i.custom);
  const col = colById(series), s = sortOf(series), years = s.by === 'year';
  if (col && col.kind === 'own') return extras.length ? [{ title: col.name, items: years ? [...extras].sort(byYear) : extras, years }] : [];
  const cat = CATALOGS[series], vis = visibleIn(series);
  const list = (cat && cat.list ? cat.list : []).filter(vis);
  const out = [];
  if (s.country) {
    const known = new Set(cat.countries.map(c => c.key));
    for (const c of cat.countries) out.push({ title: c.name, items: list.filter(i => i.country === c.key).sort(years ? byYear : byValue), years });
    out.push({ title: 'ללא מדינה', items: list.filter(i => !known.has(i.country)).sort(years ? byYear : byValue), years });
  }
  else if (years) out.push({ title: cat.name, items: [...list].sort(byYear), years });
  else if (series === 'mandate') for (const den of MANDATE_DENOMS) out.push({ title: den.d + (den.d === 1 ? ' מיל' : ' מילים') + ' · ' + den.metalName.split(',')[0] + ' · ' + den.diam + ' מ"מ', items: list.filter(c => c.d === den.d) });
  else for (const g of cat.groups || []) out.push({ title: g.name, items: list.filter(c => c.group === g.key) });
  if (extras.length) out.push({ title: 'מטבעות שהוספת', items: years ? [...extras].sort(byYear) : extras, years });
  return out.filter(x => x.items.length);
}
function renderSort() {
  const box = $('#sortBox'), col = curCol();
  box.hidden = st.view !== 'album' || !col;
  if (box.hidden) return;
  const series = col.id, s = sortOf(series);
  box.replaceChildren(
    el('span', { class: 'sort-lbl', text: 'מיון:' }),
    el('div', { class: 'sort-opts' }, sortModes(series).map(([k, t]) => el('button', { class: 'so', type: 'button', 'aria-pressed': String(s.by === k), text: t,
      onclick: () => { if (s.by !== k) setSort(series, { by: k, country: s.country }); } }))),
    hasCountries(series) ? el('button', { class: 'so-country', type: 'button', 'aria-pressed': String(s.country), text: '🌍 לפי מדינה',
      title: 'מקבץ כל מדינה בנפרד, בתוך המיון שבחרת', onclick: () => setSort(series, { by: s.by, country: !s.country }) }) : null,
  );
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
      el('span', { class: 'pg-title', text: p.sec.title + (p.sec.years ? ' · ' + yearSpan(p.items) : p.parts > 1 ? ' (' + p.part + '/' + p.parts + ')' : '') }),
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

  const book = el('div', { class: 'book album-' + albumColor(curCol()) + (isOpen ? ' open' : '') + (singlePage ? ' single-page' : ''), role: 'region', 'aria-label': 'אלבום ' + curCol().name });
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
    if (rail) {
      let cur = null;
      for (const b of rail.children) if (Number(b.dataset.p) <= bk.p) cur = b;
      for (const b of rail.children) b.toggleAttribute('aria-current', b === cur);
      if (cur && cur.scrollIntoView) cur.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
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
  // Page turns: 558 ms for a leaf, 198 ms for the one-page slide.
  // A tap during a turn isn't lost: the running turn snaps to its end and the next one starts right away.
  const TURN_MS = 558, SLIDE_MS = 198;
  let running = [];
  const queued = [];
  const track = a => { running.push(a); return a.finished; };
  function hurry(next) {
    if (queued.length < 4) queued.push(next);
    for (const a of running) { try { a.finish(); } catch (e) {} }
  }
  function settle() {
    running = []; busy = false;
    const next = queued.shift();
    if (next) next();
  }
  function animate(lf, from, to) {
    const dur = reduce ? 1 : TURN_MS;
    const a = lf.animate([{ transform: 'rotateY(' + from + 'deg)' }, { transform: 'rotateY(' + to + 'deg)' }],
      { duration: dur, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'forwards' });
    const sh = lf.querySelector('.leaf-shade');
    track(sh.animate([{ opacity: 0 }, { opacity: .55, offset: .5 }, { opacity: 0 }], { duration: dur, fill: 'forwards' }));
    return track(a);
  }

  // Forward: the left page (front of p) turns over to the right, showing its back.
  async function forward() {
    if (busy) { hurry(forward); return; }
    if (bk.p >= pages.length) { queued.length = 0; return; }   // the end of the album: drop extra taps
    busy = true;
    if (singlePage) {
      bk.p++;
      left.replaceChildren(leftFor(bk.p));
      if (!reduce) await track(left.animate([{opacity:.25,transform:'translateX(-10%)'},{opacity:1,transform:'translateX(0)'}],
        {duration:SLIDE_MS,easing:'ease-out'}));
      paint(); settle(); return;
    }
    const lf = leaf(pageFront(pages[bk.p], bk.p), pageBack(pages[bk.p], bk.p), 'left');
    left.replaceChildren(leftFor(bk.p + 1));
    await animate(lf, 0, 180);
    bk.p++; lf.remove(); paint(); settle();
  }
  // Back: the right page (back of p-1) turns over to the left, showing page p-1's front. At p = 0 the cover closes.
  async function backward() {
    if (busy) { hurry(backward); return; }
    busy = true;
    if (singlePage && bk.p > 0) {
      bk.p--;
      left.replaceChildren(leftFor(bk.p));
      if (!reduce) await track(left.animate([{opacity:.25,transform:'translateX(10%)'},{opacity:1,transform:'translateX(0)'}],
        {duration:SLIDE_MS,easing:'ease-out'}));
      paint(); settle(); return;
    }
    if (bk.p === 0) {
      queued.length = 0;   // the cover is closing; nothing to turn after it
      const lf = leaf(coverInside(), coverFace(), 'right');
      right.replaceChildren();
      await animate(lf, 0, -180);
      bk.open = false; busy = false; render(); return;
    }
    const lf = leaf(pageBack(pages[bk.p - 1], bk.p - 1), pageFront(pages[bk.p - 1], bk.p - 1), 'right');
    right.replaceChildren(rightFor(bk.p - 1));
    await animate(lf, 0, -180);
    bk.p--; lf.remove(); paint(); settle();
  }
  function coverFace() { const c = cover.cloneNode(true); c.className = 'cover as-face'; return c; }

  const prev = el('button', { class: 'btn ghost', type: 'button', text: '→ אחורה', onclick: backward });
  const next = el('button', { class: 'btn ghost', type: 'button', text: 'קדימה ←', onclick: forward });

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
      if (rail) rail.hidden = false;
      if (zoomCtl) zoomCtl.hidden = false;
    });
  } else { book.append(right, left); }

  // Swipe: in a Hebrew book you pull the left page to the right to go forward.
  let sx = null, sy = 0;
  let swipePointer = null, swipeBlocked = false;
  book.addEventListener('pointerdown', e => {
    if ((!bk.open && !(singlePage && inReader)) || (inReader && reader.zoom > 1.01)) return;
    // One finger owns page turning. A second finger cancels the pending swipe so pinch-zoom can take over.
    if (swipePointer !== null && swipePointer !== e.pointerId) { swipeBlocked = true; sx = null; return; }
    swipePointer = e.pointerId; swipeBlocked = false; sx = e.clientX; sy = e.clientY;
  });
  book.addEventListener('pointerup', e => {
    if (e.pointerId !== swipePointer) return;
    const blocked = swipeBlocked; swipePointer = null; swipeBlocked = false;
    if (sx === null || blocked || (inReader && reader.zoom > 1.01)) { sx = null; return; }
    let dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
    if (inReader && reader.rotated) [dx, dy] = [dy, -dx];
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      if (!bk.open && singlePage && dx > 0) cover.click();
      else if (bk.open) dx > 0 ? forward() : backward();
    }
  });
  book.addEventListener('pointercancel', e => { if (e.pointerId === swipePointer) { swipePointer = null; swipeBlocked = false; sx = null; } });

  const nav = el('div', { class: 'pg-nav' }, [prev, ind, next]);
  nav.hidden = !isOpen;

  // Side index: jump straight to a value / year / country without turning every page on the way.
  const marks = inReader ? railMarks(pages) : [];
  const rail = marks.length > 1 ? el('nav', { class: 'pg-rail', 'aria-label': 'בחירת עמוד באלבום' }, marks.map(m => el('button', {
    type: 'button', 'data-p': String(m.p), text: m.label, title: m.label + ' (דף ' + (m.p + 1) + ')',
    onclick: e => { e.stopPropagation(); if (busy || !bk.open) return; resetReaderZoom(); bk.p = m.p; paint(); },
  }))) : null;
  if (rail) {
    rail.hidden = !isOpen;
    // Drag the top roller naturally with one finger/mouse; tapping an item still jumps to it.
    let rx = 0, rscroll = 0, dragged = false;
    rail.addEventListener('pointerdown', e => { rx = e.clientX; rscroll = rail.scrollLeft; dragged = false; rail.setPointerCapture?.(e.pointerId); });
    rail.addEventListener('pointermove', e => { if (!rail.hasPointerCapture?.(e.pointerId)) return; const dx = e.clientX - rx; if (Math.abs(dx) > 4) dragged = true; rail.scrollLeft = rscroll - dx; });
    rail.addEventListener('click', e => { if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; } }, true);
  }
  // Zoom buttons, for when two fingers are busy (and on a computer).
  const zoomCtl = inReader ? el('div', { class: 'zoom-ctl' }, [
    el('button', { type: 'button', text: '+', 'aria-label': 'הגדל', onclick: e => { e.stopPropagation(); zoomAt(null, reader.zoom * 1.6); } }),
    el('button', { type: 'button', text: '−', 'aria-label': 'הקטן', onclick: e => { e.stopPropagation(); zoomAt(null, reader.zoom / 1.6); } }),
  ]) : null;
  if (zoomCtl) zoomCtl.hidden = !isOpen;

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

  view.append(el('div', { class: 'desk' + (rail ? ' has-top-rail' : '') }, [book, edges, nav, rail, zoomCtl]));
  if (isOpen) paint();
}

// Index marks for the side rail: where each section starts (a value, a reign, a country),
// or, in a year-ordered album, the first year on each page.
function railMarks(pages) {
  const s = sortOf(st.tab), out = [];
  pages.forEach((p, i) => {
    const extra = p.items[0] && p.items[0].custom && p.sec.title === 'מטבעות שהוספת';
    const label = extra ? 'תוספות'
      : p.sec.years && !s.country ? String(yearSpan(p.items)).split('–')[0]
      : p.sec.title.split(' · ')[0].replace(/\s*\(.*\)\s*$/, '');
    if (label && (!out.length || out[out.length - 1].label !== label)) out.push({ label, p: i });
  });
  return out;
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
const MAX_ZOOM = 5;
// The book scales around its own centre, so to keep the point under a finger in place the pan moves too:
// a page point that sits d away from the centre (in page units) shows at centre + pan + zoom * d.
function bookCentre() {
  const book = $('#readerStage .book'); if (!book) return null;
  const host = book.offsetParent; if (!host) return null;
  const r = host.getBoundingClientRect();   // offsets ignore the transform, so this is the unzoomed centre
  return { x: r.left + book.offsetLeft + book.offsetWidth / 2, y: r.top + book.offsetTop + book.offsetHeight / 2, w: book.offsetWidth, h: book.offsetHeight };
}
function clampPan() {
  const c = bookCentre(); if (!c) return;
  const mx = c.w * reader.zoom / 2, my = c.h * reader.zoom / 2;   // the screen centre always stays over the book
  reader.panX = Math.max(-mx, Math.min(mx, reader.panX));
  reader.panY = Math.max(-my, Math.min(my, reader.panY));
}
// Zoom to z keeping the screen point (x, y) still; with no point, around the middle of the screen.
function zoomAt(pt, z) {
  const c = bookCentre(); if (!c) return;
  z = Math.max(1, Math.min(MAX_ZOOM, z));
  if (z <= 1.01) { resetReaderZoom(); return; }
  const p = pt || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const dx = (p.x - c.x - reader.panX) / reader.zoom, dy = (p.y - c.y - reader.panY) / reader.zoom;
  reader.zoom = z; reader.panX = p.x - c.x - z * dx; reader.panY = p.y - c.y - z * dy;
  clampPan(); applyReaderZoom();
}
// Taps in the reader: one tap on a coin opens its card, two quick taps zoom in there (or back out).
// The single tap waits a moment so it can tell the two apart.
const readerTaps = { last: null, timer: 0, passing: false };
// A tap on a page's outer margin turns the page, like flicking a real album's edge:
// the left page's left edge goes forward, the right page's right edge goes back
// (with one page on screen, its two edges). Coins near the edge still open their card.
function readerEdgeTurn(x, y, target) {
  if (reader.zoom > 1.01 || (target && target.closest && target.closest('.pocket.slot'))) return false;
  const stage = $('#readerStage');
  if (!stage.querySelector('.book.open')) return false;
  const [prevBtn, nextBtn] = stage.querySelectorAll('.pg-nav > .btn');
  if (!prevBtn || !nextBtn) return false;
  const L = stage.querySelector('.book .side.left > .pg'), R = stage.querySelector('.book .side.right > .pg');
  const inBand = (r, side) => {
    if (y < r.top || y > r.bottom) return false;
    const band = Math.max(22, r.width * 0.14);
    return side === 'left' ? x >= r.left - 40 && x <= r.left + band : x >= r.right - band && x <= r.right + 40;   // the dark margin just outside the page counts too
  };
  const l = L && L.getBoundingClientRect(), r = R && R.getBoundingClientRect();
  if (l && inBand(l, 'left')) { if (!nextBtn.disabled) nextBtn.click(); return true; }
  const back = r || l;   // single page: its right edge goes back
  if (back && inBand(back, 'right')) { if (!prevBtn.disabled) prevBtn.click(); return true; }
  return false;
}
function readerTap(x, y, target) {
  if (readerEdgeTurn(x, y, target)) { readerTaps.last = null; return true; }
  const now = performance.now(), last = readerTaps.last;
  if (last && now - last.t < 320 && Math.hypot(x - last.x, y - last.y) < 40) {
    clearTimeout(readerTaps.timer); readerTaps.last = null;
    if (reader.zoom > 1.01) resetReaderZoom(); else zoomAt({ x, y }, 2.5);
    return true;
  }
  readerTaps.last = { t: now, x, y };
  const pocket = target && target.closest && target.closest('.book .pocket.slot');
  if (!pocket) return false;
  clearTimeout(readerTaps.timer);
  readerTaps.timer = setTimeout(() => { readerTaps.last = null; readerTaps.passing = true; pocket.click(); readerTaps.passing = false; }, 320);
  return true;
}
const READER_CONTROLS = '.pg-nav, .reader-x, .pg-rail, .zoom-ctl, .page-edges, .cover';
function installReaderZoom() {
  const stage = $('#readerStage'); if (!stage || stage.dataset.zoomReady) return;
  stage.dataset.zoomReady = '1';
  let touches = new Map(), pinch = false, startDist = 0, startZoom = 1, startPanX = 0, startPanY = 0, startMid = null, anchor = null, centre = null;
  let swipeStart = null, panStart = null, gestureMoved = false, suppressClickUntil = 0;
  const TAP_SLOP = 8;

  const vals = () => [...touches.values()];
  const dist = () => { const p=vals(); return p.length<2 ? 0 : Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y); };
  const mid = () => { const p=vals(); return p.length<2 ? null : {x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2}; };

  stage.addEventListener('touchstart', e => {
    if (!st.reader) return;
    touches.clear();
    for (const t of e.touches) touches.set(t.identifier,{x:t.clientX,y:t.clientY});
    if (e.touches.length === 1) {
      pinch = false; gestureMoved = false;
      const p = { x:e.touches[0].clientX, y:e.touches[0].clientY, t: performance.now() };
      if (e.target.closest(READER_CONTROLS)) { swipeStart = null; panStart = null; return; }   // let buttons work while zoomed
      if (reader.zoom > 1.01) {
        swipeStart = null;
        panStart = { ...p, panX: reader.panX, panY: reader.panY };
        e.preventDefault();
      } else {
        panStart = null;
        swipeStart = p;
      }
    } else if (e.touches.length >= 2) {
      pinch = true; gestureMoved = true; swipeStart = null; panStart = null;
      stage.classList.add('pinching');
      startDist=dist(); startZoom=reader.zoom; startPanX=reader.panX; startPanY=reader.panY; startMid=mid();
      // the page point between the two fingers stays between them
      centre = bookCentre();
      anchor = centre ? { x: (startMid.x - centre.x - startPanX) / startZoom, y: (startMid.y - centre.y - startPanY) / startZoom } : null;
      e.preventDefault();
    }
  }, {passive:false});

  stage.addEventListener('touchmove', e => {
    touches.clear();
    for (const t of e.touches) touches.set(t.identifier,{x:t.clientX,y:t.clientY});
    if (pinch && e.touches.length >= 2 && startDist) {
      gestureMoved = true;
      const m=mid(); reader.zoom=Math.max(1,Math.min(MAX_ZOOM,startZoom*dist()/startDist));
      if (anchor) { reader.panX = m.x - centre.x - reader.zoom * anchor.x; reader.panY = m.y - centre.y - reader.zoom * anchor.y; }
      else { reader.panX=startPanX+(m.x-startMid.x); reader.panY=startPanY+(m.y-startMid.y); }
      if (reader.zoom<=1.01) { reader.zoom=1; reader.panX=reader.panY=0; } else clampPan();
      applyReaderZoom(); e.preventDefault();
    } else if (!pinch && panStart && e.touches.length === 1 && reader.zoom > 1.01) {
      const dx = e.touches[0].clientX - panStart.x, dy = e.touches[0].clientY - panStart.y;
      if (Math.hypot(dx, dy) > TAP_SLOP) gestureMoved = true;
      reader.panX = panStart.panX + dx;
      reader.panY = panStart.panY + dy;
      clampPan(); applyReaderZoom(); e.preventDefault();
    }
  }, {passive:false});

  stage.addEventListener('touchend', e => {
    if (!st.reader) return;
    if (gestureMoved || pinch) suppressClickUntil = performance.now() + 450;
    // zoomed in, the touches don't make clicks (they pan), so a short still touch counts as a tap here
    else if (panStart && e.changedTouches.length === 1 && !e.touches.length) {
      const t = e.changedTouches[0];
      if (performance.now() - panStart.t < 350) readerTap(t.clientX, t.clientY, document.elementFromPoint(t.clientX, t.clientY));
    }
    if (!pinch && reader.zoom <= 1.01 && swipeStart && e.changedTouches.length === 1) {
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
    if (!e.touches.length) { touches.clear(); swipeStart=null; panStart=null; }
  }, {passive:false});
  stage.addEventListener('touchcancel', () => { touches.clear(); pinch=false; gestureMoved=false; startDist=0; swipeStart=null; panStart=null; stage.classList.remove('pinching'); applyReaderZoom(true); });

  stage.addEventListener('click', e => {
    if (performance.now() < suppressClickUntil) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  }, true);

  stage.addEventListener('click', e => {
    if (!st.reader || readerTaps.passing || e.target.closest(READER_CONTROLS)) return;
    if (readerTap(e.clientX, e.clientY, e.target)) { e.stopPropagation(); e.preventDefault(); }
  }, true);
  stage.addEventListener('wheel', e => {
    if (!st.reader || (!e.ctrlKey && Math.abs(e.deltaY)<1)) return;
    zoomAt({ x: e.clientX, y: e.clientY }, reader.zoom * (e.deltaY < 0 ? 1.12 : .89));
    e.preventDefault();
  }, {passive:false});
}
function enterReader() {
  const bk = st.book[st.tab];
  reader.portrait = window.innerHeight > window.innerWidth * 1.05;
  reader.rotated = false;
  bk.open = false; bk.p = 0; bk.autoOpen = false;
  st.reader = true; resetReaderZoom(); installReaderZoom();
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
  if (sheetPopping) { sheetPopping = false; return; }   // our own step back after closing the card, not "leave the album"
  if (sheetHistoryPushed) { closeSheet(true); return; }
  if (st.reader) { reader.pushed = false; exitReader(true); }
});

let toastTimer = 0;
function toast(text) {
  const t = $('#toast'); t.textContent = text; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2400);
}

/* ---------- detail sheet ---------- */
let sheetHistoryPushed = false, sheetPopping = false;
function closeSheet(fromHistory = false) {
  const dlg = $('#sheet');
  if (dlg.open) dlg.close();
  if (sheetHistoryPushed && !fromHistory) {
    sheetHistoryPushed = false; sheetPopping = true;
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
  const add = (k, v) => { if (v !== '' && v != null) facts.append(el('dt', { text: k }), el('dd', { text: String(v) })); };
  const fmtNum = n => Number(n).toLocaleString('he-IL');
  add('מתכת', item.metalName);
  add('הרכב', item.composition);
  add('משקל', item.weight != null ? item.weight + ' גרם' : '');
  add('קוטר', item.diam ? item.diam + ' מ״מ' : '');
  add('עובי', item.thickness != null ? item.thickness + ' מ״מ' : '');
  add('כמות הנפקה', item.mintageText || (item.mintage != null ? fmtNum(item.mintage) : ''));
  add('מטבעה', item.mint);
  add('סימן מטבעה', item.mintMark);
  add('שפה', item.edge);
  add('כיוון', item.orientation);
  add('קטלוג', item.catalog);
  add('פרטים', item.design);
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
  for (const k of [id, id + REV]) { await Store.del('photos', k); await Store.del('sources', k); setPhotoUrl(k, null); }
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
      : el('span', { class: 'ph-missing', text: '?' }), el('figcaption', { text: t }),
      url ? el('button', { class: 'btn ph-edit', type: 'button', text: '✂ ערוך חיתוך', 'aria-label': 'ערוך את החיתוך והיישור של ה' + t, onclick: () => editPhoto(item, side) }) : null]);
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

// `res` is what Photo.crop resolves: the round photo, the original it was cut from, and the crop params.
async function saveCoinPhoto(item, side, res) {
  const key = side === 'back' ? item.id + REV : item.id;
  await Store.put('photos', key, res.photo); setPhotoUrl(key, res.photo);
  await Store.put('sources', key, { blob: res.source, params: res.params });
}
// Open the crop again for a saved photo. With the original kept, the circle can grow back too;
// older photos (and ones restored from a backup) only have the round crop, so they can only be tightened or turned.
async function editPhoto(item, side) {
  const key = side === 'back' ? item.id + REV : item.id, title = 'עריכת ה' + (side === 'back' ? 'צד האחורי' : 'צד הקדמי');
  const src = await Store.get('sources', key), photo = await Store.get('photos', key);
  if (!src && !photo) return;
  let res;
  try {
    if (src) res = await Photo.crop(src.blob, $('#cropper'), $('#cropperBody'), el, title, { isSource: true, init: src.params });
    else {
      const bmp = await createImageBitmap(photo), half = bmp.width / 2; if (bmp.close) bmp.close();
      res = await Photo.crop(photo, $('#cropper'), $('#cropperBody'), el, title, { isSource: true, init: { cx: half, cy: half, r: half, deg: 0 } });
    }
  } catch (e) { toast('לא הצלחתי לפתוח את התמונה לעריכה.'); return; }
  if (!res) { openSheet(item.id); return; }
  try { await saveCoinPhoto(item, side, res); render(); openSheet(item.id, 'התמונה עודכנה.'); }
  catch (e) { toast('שמירת התמונה נכשלה. ייתכן שהזיכרון בטלפון מלא.'); }
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
  // the originals travel with their photos, so "edit" keeps opening the right picture
  const [sf, sb] = await Promise.all([Store.get('sources', item.id), Store.get('sources', item.id + REV)]);
  if (sb) await Store.put('sources', item.id, sb); else await Store.del('sources', item.id);
  if (sf) await Store.put('sources', item.id + REV, sf); else await Store.del('sources', item.id + REV);
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
    let pool = cat.list.filter(it => !groupsHidden.has(it.group) && !itemsHidden.has(it.id) && (varBox.checked || !it.variant) && (mintBox.checked || !it.mintVariant));
    if (scope.value === 'one-per-type') {
      const seen = new Set(); pool = pool.filter(it => { const k = it.typeKey || it.group || it.d || it.denomination || it.title.replace(/\b(18|19|20)\d{2}\b/g, '').trim(); if (seen.has(k)) return false; seen.add(k); return true; });
    }
    const n = pool.length;
    count.textContent = 'באלבום יופיעו ' + n + ' מתוך ' + cat.list.length + ' מטבעות.';
  };
  const settings = albumSettings(col);
  const nVar = cat.list.filter(it => it.variant).length;
  const nMint = cat.list.filter(it => it.mint || it.mintMark || it.mintVariant).length;
  const scope = el('select', { class: 'cz-select', id: 'cz-scope' }, [
    el('option', { value: 'all-years', text: 'כל השנים וההנפקות' }),
    el('option', { value: 'one-per-type', text: 'אחד מכל סוג / ערך' }),
  ]);
  scope.value = settings.scope || 'all-years';
  const varBox = el('input', { type: 'checkbox', id: 'cz-var' }); varBox.checked = settings.variants !== false;
  const mintBox = el('input', { type: 'checkbox', id: 'cz-mint' }); mintBox.checked = settings.mints !== false;
  const varRow = nVar ? el('label', { class: 'cz-var', for: 'cz-var' }, [varBox, el('span', {}, [el('b', { text: 'וריאנטים' }), el('small', { text: ' כולל וריאנטים מוכרים של אותה הנפקה' })])]) : null;
  const mintRow = nMint ? el('label', { class: 'cz-var', for: 'cz-mint' }, [mintBox, el('span', {}, [el('b', { text: 'מטבעות וסימני מטבעה' }), el('small', { text: ' הפרד הנפקות לפי Mint / Mint Mark כשיש לכך משמעות אספנית' })])]) : null;
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
    col.showVariants = varBox.checked; // backwards compatibility with existing backups
    col.settings = { scope: scope.value, variants: varBox.checked, mints: mintBox.checked };
    await saveCollections(); $('#adder').close(); render(); toast('האלבום עודכן');
  } });
  body.append(
    el('h2', { text: 'הגדרות האלבום: ' + col.name }),
    el('p', { class: 'muted', text: 'הגדר פעם אחת איך אתה אוסף את הסדרה. אפשר לחזור ולשנות את ההגדרות בכל זמן; מטבעות שכבר סימנת כבבעלותך לעולם לא נמחקים.' }),
    el('label', { class: 'cz-setting' }, [
      el('span', {}, [el('b', { text: 'מבנה האוסף' }), el('small', { text: ' בחר אם להשלים כל שנה והנפקה או להחזיק נציג אחד מכל סוג.' })]),
      scope
    ]),
    el('div', { class: 'confirm' }, [
      el('button', { class: 'btn', type: 'button', text: 'סמן הכול', onclick: () => setAll(true) }),
      el('button', { class: 'btn', type: 'button', text: 'נקה הכול', onclick: () => setAll(false) }),
    ]),
    varRow, mintRow, list, count,
    el('div', { class: 'confirm' }, [save, el('button', { class: 'btn', type: 'button', text: 'ביטול', onclick: () => $('#adder').close() })]),
  );
  for (const ctl of [varBox, mintBox, scope]) ctl.addEventListener('change', refreshCount);
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
function openMenu(msg, section) {
  const dlg = $('#menu'), body = $('#menuBody');
  const close = () => dlg.close();
  const home = () => openMenu(msg);
  body.textContent = '';

  const head = (title, back = true) => el('div', { class: 'menu-head' }, [
    back ? el('button', { class: 'menu-back', type: 'button', text: '→', 'aria-label': 'חזרה', onclick: home }) : null,
    el('b', { text: title }),
    el('button', { class: 'menu-close', type: 'button', text: '✕', 'aria-label': 'סגור', onclick: close }),
  ]);

  if (!section) {
    const item = (icon, title, sub, key) => el('button', { class: 'menu-category', type: 'button', onclick: () => openMenu('', key) }, [
      el('span', { class: 'menu-category-icon', text: icon, 'aria-hidden': 'true' }),
      el('span', { class: 'menu-category-copy' }, [el('b', { text: title }), el('small', { text: sub })]),
      el('span', { class: 'menu-chevron', text: '‹', 'aria-hidden': 'true' }),
    ]);
    body.append(
      head('תפריט', false),
      el('div', { class: 'menu-categories' }, [
        item('▦', 'האוספים שלי', 'הוספה, ניהול והסרת אוספים', 'collections'),
        item('↥', 'גיבוי ונתונים', 'שמירה ושחזור של האוסף והתמונות', 'backup'),
        item('⚙', 'אפליקציה', 'מידע והגדרות כלליות', 'app'),
      ])
    );
  } else if (section === 'collections') {
    const colRows = st.collections.map(c => {
      const row = el('div', { class: 'col-row' }, [el('span', { text: c.name + (c.kind === 'own' ? ' (אוסף משלך)' : '') })]);
      const rm = el('button', { class: 'btn danger', type: 'button', text: 'הסר', onclick: () => {
        row.replaceChildren(el('span', { text: c.kind === 'own' ? 'להסיר את "' + c.name + '" ואת כל המטבעות שבו?' : 'להסיר את "' + c.name + '" מהאלבום?' }),
          el('button', { class: 'btn danger', type: 'button', text: 'כן, הסר', onclick: async () => { await removeCollection(c); openMenu('האוסף הוסר.', 'collections'); } }),
          el('button', { class: 'btn', type: 'button', text: 'ביטול', onclick: () => openMenu('', 'collections') }));
      } });
      row.append(rm); return row;
    });
    body.append(head('האוספים שלי'), ...(colRows.length ? colRows : [el('p', { class: 'muted', text: 'עוד אין אוספים.' })]),
      el('button', { class: 'btn primary menu-wide', type: 'button', text: '+ אוסף חדש', onclick: () => { close(); openLibrary(); } }));
  } else if (section === 'backup') {
    const have = st.owned.size;
    const msgEl = el('div', { class: 'msg' + (msg ? ' ok' : ''), text: msg || '' });
    const file = el('input', { type: 'file', accept: 'application/json,.json', hidden: true });
    const confirmBox = el('div', { class: 'confirm' });
    const exportBtn = el('button', { class: 'btn primary menu-wide', type: 'button', text: 'שמור גיבוי לקובץ', onclick: async () => {
      const blob = new Blob([JSON.stringify(await snapshot())], { type: 'application/json' });
      const a = el('a', { href: URL.createObjectURL(blob), download: 'coin-album-' + new Date().toISOString().slice(0,10) + '.json' });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      try { localStorage.setItem('album.lastBackup', nowIso()); } catch (e) {}
      msgEl.className = 'msg ok'; msgEl.textContent = 'הגיבוי נשמר.';
    } });
    file.addEventListener('change', async () => {
      const f=file.files&&file.files[0]; if(!f) return; let data;
      try { data=JSON.parse(await f.text()); } catch(e) { data=null; }
      if(!data||data.app!=='coin-album'||typeof data.owned!=='object') { msgEl.className='msg err'; msgEl.textContent='הקובץ הזה אינו גיבוי תקין.'; return; }
      const n=Object.keys(data.owned).length; confirmBox.textContent='';
      confirmBox.append(el('span',{text:'לשחזר '+n+' מטבעות ולהחליף את הנתונים הנוכחיים?'}),
        el('button',{class:'btn danger',type:'button',text:'כן, שחזר',onclick:async()=>{ try {
          const photos={}; for(const [k,url] of Object.entries(data.photos||{})) photos[k]=await Photo.fromDataURL(url);
          await Store.replaceAll(data.owned,data.extras||{},photos);
          if(Array.isArray(data.collections)) await Store.put('meta','collections',data.collections); else await Store.del('meta','collections');
          await load(); render(); openMenu('השחזור הושלם: '+n+' מטבעות.','backup');
        } catch(e) { msgEl.className='msg err'; msgEl.textContent='השחזור נכשל.'; }}}),
        el('button',{class:'btn',type:'button',text:'ביטול',onclick:()=>openMenu('','backup')}));
    });
    let last=''; try { last=localStorage.getItem('album.lastBackup')||''; } catch(e) {}
    body.append(head('גיבוי ונתונים'),
      el('p',{class:'muted',text:'האוסף והתמונות נשמרים במכשיר. גיבוי מאפשר להעביר או לשחזר אותם.'}),
      el('div',{class:'menu-info',text:'באוסף: '+have+' מטבעות'+(last?' · גיבוי אחרון: '+new Date(last).toLocaleDateString('he-IL'):' · עדיין לא נשמר גיבוי')}),
      exportBtn, el('button',{class:'btn menu-wide',type:'button',text:'שחזר מגיבוי',onclick:()=>file.click()}), file, confirmBox, msgEl);
  } else {
    body.append(head('אפליקציה'),
      el('div',{class:'menu-info'},[
        el('b',{text:'Coin Collector'}),
        el('span',{text:'ניהול אוסף המטבעות שלך'}),
      ]),
      el('p',{class:'muted',text:'האפליקציה פועלת מקומית ושומרת את נתוני האוסף במכשיר.'}));
  }
  if (!dlg.open) dlg.showModal();
}

/* ---------- collections: library, own collections, first launch ---------- */
function notice(kids) { const n = $('#notice'); n.textContent = ''; if (!kids) { n.hidden = true; return; } n.append(...[].concat(kids)); n.hidden = false; }
async function saveCollections() { await Store.put('meta', 'collections', st.collections); }
async function ensureCatalog(key) {
  try { await loadCatalogFile(key); } catch (e) { toast('לא הצלחתי לטעון את הקטלוג. בדוק חיבור לאינטרנט ונסה שוב.'); }
}
async function addCatalog(key) {
  await ensureCatalog(key);
  if (!colById(key)) { st.collections.push({ id: key, kind: 'catalog', name: CATALOGS[key].name, sub: CATALOGS[key].sub, color: CATALOG_COLOR[key] || 'burgundy',
      settings: { scope: 'all-years', variants: true, mints: true } }); await saveCollections(); }
  st.tab = key; try { localStorage.setItem('album.tab', key); } catch (e) {}
  render(); toast('"' + CATALOGS[key].name + '" נוסף לאלבום');
}
async function addOwnCollection(name, sub) {
  const id = 'u-' + newId().slice(0, 8);
  const used = st.collections.filter(c => c.kind === 'own').length;
  st.collections.push({ id, kind: 'own', name, sub, color: ALBUM_COLORS[used % ALBUM_COLORS.length] }); await saveCollections();
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
    const col = colById(key) || { id: key, kind: 'catalog', color: CATALOG_COLOR[key] || 'burgundy' };
    return el('div', { class: 'lib-card catalog-row album-' + albumColor(col) }, [
      el('span', { class: 'catalog-swatch', 'aria-hidden': 'true' }),
      el('span', { class: 'catalog-copy' }, [
        el('b', { text: c.name }),
        el('span', { class: 'lib-sub', text: c.sub }),
        el('small', { text: c.about })
      ]),
      has
        ? el('span', { class: 'catalog-owned', text: 'נוסף' })
        : el('button', { class: 'catalog-add', type: 'button', 'aria-label': 'הוסף ' + c.name, text: '+',
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
  return [el('div', { class: 'lib-grid catalog-list' }, cards), own];
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
  let colorsChanged = false;
  st.collections.forEach((c, i) => {
    if (!ALBUM_COLORS.includes(c.color)) {
      c.color = CATALOG_COLOR[c.id] || (c.kind === 'own' ? ALBUM_COLORS[i % ALBUM_COLORS.length] : 'burgundy');
      colorsChanged = true;
    }
  });
  if (colorsChanged) await saveCollections();
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
