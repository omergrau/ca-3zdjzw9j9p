'use strict';
(() => {
const st = { tab: 'crowns', filter: 'all', owned: new Map(), extras: new Map(), photos: new Map(), ready: false };
try { const t = localStorage.getItem('album.tab'); if (t && SERIES[t]) st.tab = t; } catch (e) {}

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

function extraToItem(id, x) {
  return { id: 'x-' + id, extraId: id, series: x.series, y: x.year || '', tag: 'תוספת', rare: '', metal: x.metal || 'silver',
    metalName: METAL_NAME[x.metal] || '', title: x.label || 'מטבע נוסף', sub: x.series === 'crowns' ? 'קראון, תוספת' : 'מנדט, תוספת',
    design: '', holed: false, custom: true };
}
function allItems(series) {
  return SERIES[series].list.concat([...st.extras.values()].filter(x => x.series === series));
}
function findItem(id) { return allItems('crowns').concat(allItems('mandate')).find(i => i.id === id); }

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
  const c = seriesStats('crowns'), m = seriesStats('mandate');
  const have = c.have + m.have, total = c.total + m.total;
  const missingRare = allItems('crowns').concat(allItems('mandate')).filter(i => i.rare && !st.owned.has(i.id)).length;
  const stat = (cls, n, t) => el('div', { class: 'stat ' + cls }, [el('b', { text: String(n) }), el('span', { text: t })]);
  host.append(stat('gold', have, 'מטבעות באלבום'), stat('', (total ? Math.round(have / total * 100) : 0) + '%', 'מכל הסדרות'), stat('copper', total - have, 'עוד חסרים'));
}

function renderTabs() {
  const host = $('#tabs'); host.textContent = '';
  for (const [key, s] of Object.entries(SERIES)) {
    const x = seriesStats(key);
    const ring = el('span', { class: 'ring', style: '--p:' + x.pct }, [el('span', { text: x.pct + '%' })]);
    host.append(el('button', { class: 'tab ' + key, role: 'tab', type: 'button', 'aria-selected': String(st.tab === key),
      onclick: () => { st.tab = key; try { localStorage.setItem('album.tab', key); } catch (e) {} render(); } }, [
      ring,
      el('span', { class: 't-name', text: s.name }),
      el('span', { class: 't-sub', text: s.sub }),
      el('span', { class: 't-count', text: x.have + ' מתוך ' + x.total }),
    ]));
  }
}

function renderLegend() {
  const L = $('#legend'); L.textContent = '';
  const g = m => 'radial-gradient(circle at 32% 28%, var(--' + m + '-a), var(--' + m + '-b) 55%, var(--' + m + '-c))';
  const mk = (bg, t) => el('span', {}, [el('i', { class: 'mini', style: 'background:' + bg }), t]);
  if (st.tab === 'crowns') L.append(mk(g('silver'), 'כסף'), mk(g('cuni'), 'קופרו-ניקל'));
  else L.append(mk(g('bronze'), 'ברונזה'), mk(g('cuni'), 'קופרו-ניקל'), mk(g('silver'), 'כסף'));
  L.append(mk('radial-gradient(circle at 50% 35%, #555a66, #23262d)', 'חסר'), mk('radial-gradient(circle at 35% 30%, #ffc2c8, var(--ruby) 60%, #a3192a)', 'נדיר / הערה'));
}

function trayHead(title, sub, extra) {
  return el('div', { class: 'tray-head' }, [el('h2', { text: title }), extra || null, el('p', { text: sub })]);
}

function renderCrowns(view) {
  const tray = el('div', { class: 'tray' }, [trayHead('קראונים בריטיים', 'חמישה שילינג. לכל מלך המונוגרמה המלכותית שלו.')]);
  for (const r of CROWN_REIGNS) {
    const items = CROWNS.filter(c => c.reign === r.key), have = items.filter(i => st.owned.has(i.id)).length;
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
  table.append(el('thead', {}, [el('tr', {}, [el('th', { text: '' }), ...MANDATE_YEARS.map(y => el('th', { scope: 'col', text: String(y) }))])]));
  const tb = el('tbody');
  for (const den of MANDATE_DENOMS) {
    const items = MANDATE.filter(c => c.d === den.d), have = items.filter(i => st.owned.has(i.id)).length;
    const tr = el('tr', {}, [el('th', { scope: 'row' }, [den.d + (den.d === 1 ? ' מיל' : ' מילים'), el('small', { text: have + '/' + items.length + ' · ' + den.metalName.split(',')[0] })])]);
    for (const y of MANDATE_YEARS) {
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
  document.body.dataset.series = st.tab;
  renderStats(); renderTabs(); renderLegend();
  document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.f === st.filter)));
  const view = $('#view'); view.textContent = '';
  if (st.tab === 'crowns') renderCrowns(view); else renderMandate(view);
  renderExtras(view);
  st.justAdded = null;
}

let toastTimer = 0;
function toast(text) {
  const t = $('#toast'); t.textContent = text; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2400);
}

/* ---------- detail sheet ---------- */
function openSheet(id, msg) {
  const item = findItem(id); if (!item) return;
  const rec = st.owned.get(id);
  const body = $('#sheetBody'); body.textContent = '';
  body.append(el('div', { class: 'sheet-head' }, [
    el('span', { class: 'slot m-' + item.metal + (rec ? ' own' : '') }, [coinEl(item)]),
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
  const close = el('button', { class: 'btn', type: 'button', text: 'סגור', onclick: () => $('#sheet').close() });
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
  f.append(el('div', { class: 'actions' }, [el('div', { class: 'confirm' }, [save, close]), left]), msgEl);
  f.addEventListener('submit', e => {
    e.preventDefault();
    saveOwned(item, { grade, paid: paid.value, acquired: date.value, note: note.value.trim() }, msgEl, save);
  });
  body.append(f);
  const dlg = $('#sheet'); if (!dlg.open) dlg.showModal();
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
    else { render(); openSheet(item.id, 'השינויים נשמרו.'); }
  } catch (e) {
    btn.disabled = false; msgEl.className = 'msg err'; msgEl.textContent = 'השמירה נכשלה. ייתכן שהזיכרון בטלפון מלא.';
  }
}
async function removeOwned(item, msgEl) {
  try {
    await Store.del('owned', item.id); st.owned.delete(item.id);
    await Store.del('photos', item.id); setPhotoUrl(item.id, null);
    if (item.custom) { await Store.del('extras', item.extraId); st.extras.delete(item.extraId); $('#sheet').close(); render(); return; }
    render(); openSheet(item.id, 'הוסר מהאוסף.');
  } catch (e) { msgEl.className = 'msg err'; msgEl.textContent = 'ההסרה נכשלה. נסה שוב.'; }
}

/* ---------- photos ---------- */
function setPhotoUrl(id, blob) {
  const old = st.photos.get(id); if (old) URL.revokeObjectURL(old);
  if (blob) st.photos.set(id, URL.createObjectURL(blob)); else st.photos.delete(id);
}
function photoSection(item) {
  const has = st.owned.has(item.id) && st.photos.has(item.id);
  const input = el('input', { type: 'file', accept: 'image/*', hidden: true });
  input.addEventListener('change', async () => {
    const f = input.files && input.files[0]; input.value = '';
    if (f) await takePhoto(item, f);
  });
  const pick = el('button', { class: 'btn ' + (has ? '' : 'accent'), type: 'button', text: has ? 'החלף תמונה' : '📷 צלם או בחר תמונה', onclick: () => input.click() });
  const kids = [input];
  if (has) {
    const del = el('button', { class: 'btn danger', type: 'button', text: 'מחק תמונה', onclick: async () => {
      await Store.del('photos', item.id); setPhotoUrl(item.id, null); render(); openSheet(item.id, 'התמונה נמחקה.');
    } });
    kids.push(el('div', { class: 'confirm' }, [pick, del]));
  } else {
    kids.push(el('div', { class: 'photo-cta' }, [pick, el('span', { class: 'muted', text: 'המטבע יזוהה ויחתך אוטומטית. רק העיגול שלו נשמר.' })]));
  }
  return el('div', { class: 'photo-slot' }, kids);
}
async function takePhoto(item, file) {
  let blob;
  try { blob = await Photo.crop(file, $('#cropper'), $('#cropperBody'), el); }
  catch (e) { toast('לא הצלחתי לפתוח את התמונה. נסה תמונה אחרת.'); return; }
  if (!blob) return;
  try {
    await Store.put('photos', item.id, blob); setPhotoUrl(item.id, blob);
    const isNew = !st.owned.has(item.id);
    if (isNew) {
      const rec = { series: item.series, grade: '', paid: null, acquired: '', note: '', updatedAt: nowIso() };
      await Store.put('owned', item.id, rec); st.owned.set(item.id, rec); st.justAdded = item.id;
    }
    render(); openSheet(item.id, isNew ? 'התמונה נשמרה והמטבע נכנס לאלבום.' : 'התמונה נשמרה.');
  } catch (e) { toast('שמירת התמונה נכשלה. ייתכן שהזיכרון בטלפון מלא.'); }
}

/* ---------- add dialog ---------- */
function openAdder() {
  const body = $('#adderBody'); body.textContent = '';
  body.append(el('h2', { text: 'הוספת מטבע לאוסף' }));
  const seriesSel = el('select', { id: 'a-series' }, Object.entries(SERIES).map(([k, s]) => el('option', { value: k, text: s.name })));
  seriesSel.value = st.tab;
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
    el('p', { class: 'muted', text: 'למשל וריאנט, פרוף או טעות הטבעה. הוא יופיע תחת "מטבעות שהוספת".' }),
  );
  const label = el('input', { id: 'a-label', placeholder: 'למשל: קראון 1889 עם שפה LII' });
  const year = el('input', { id: 'a-year', type: 'number', min: '1800', max: '1970', inputmode: 'numeric', placeholder: 'שנה' });
  const metal = el('select', { id: 'a-metal' }, [['silver', 'כסף'], ['cuni', 'קופרו-ניקל'], ['bronze', 'ברונזה']].map(([v, t]) => el('option', { value: v, text: t })));
  const msg2 = el('div', { class: 'msg' });
  const addCustom = el('button', { class: 'btn', type: 'button', text: 'הוסף מטבע מותאם' });
  addCustom.addEventListener('click', async () => {
    if (!label.value.trim()) { msg2.className = 'msg err'; msg2.textContent = 'כתוב שם למטבע.'; return; }
    addCustom.disabled = true;
    try {
      const id = newId();
      const x = { series: seriesSel.value, label: label.value.trim(), year: year.value ? Number(year.value) : null, metal: metal.value };
      await Store.put('extras', id, x);
      const item = extraToItem(id, x); st.extras.set(id, item);
      const rec = { series: x.series, grade: '', paid: null, acquired: '', note: '', updatedAt: nowIso() };
      await Store.put('owned', item.id, rec); st.owned.set(item.id, rec);
      $('#adder').close(); st.tab = x.series; render(); openSheet(item.id, 'נוסף לאוסף. אפשר להשלים פרטים.');
    } catch (e) { addCustom.disabled = false; msg2.className = 'msg err'; msg2.textContent = 'ההוספה נכשלה. נסה שוב.'; }
  });
  body.append(el('div', { class: 'field' }, [el('label', { for: 'a-label', text: 'שם' }), label]),
    el('div', { class: 'row2' }, [el('div', { class: 'field' }, [el('label', { for: 'a-year', text: 'שנה' }), year]), el('div', { class: 'field' }, [el('label', { for: 'a-metal', text: 'מתכת' }), metal])]),
    addCustom, msg2);
  $('#adder').showModal();
}

/* ---------- backup menu ---------- */
async function snapshot() {
  const owned = {}, extras = {}, photos = {};
  for (const [k, v] of st.owned) owned[k] = v;
  for (const [k, v] of st.extras) extras[k] = { series: v.series, label: v.title, year: v.y || null, metal: v.metal };
  for (const [k, blob] of await Store.all('photos')) photos[k] = await Photo.toDataURL(blob);
  return { app: 'coin-album', version: 2, exportedAt: nowIso(), owned, extras, photos };
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
          await Store.replaceAll(data.owned, data.extras || {}, photos); await load(); render(); openMenu('השחזור הושלם: ' + n + ' מטבעות.');
        }
        catch (e) { msgEl.className = 'msg err'; msgEl.textContent = 'השחזור נכשל.'; }
      } }),
      el('button', { class: 'btn', type: 'button', text: 'ביטול', onclick: () => openMenu() }));
    file.value = '';
  });
  let last = ''; try { last = localStorage.getItem('album.lastBackup') || ''; } catch (e) {}
  body.append(
    el('h2', { text: 'גיבוי' }),
    el('p', { class: 'muted', text: 'האוסף והתמונות שמורים רק בטלפון הזה. כדאי לשמור גיבוי מדי פעם ולשלוח אותו לעצמך (למשל במייל או בדרייב). התמונות נכללות בגיבוי.' }),
    el('p', { class: 'muted', text: 'באוסף: ' + have + ' מטבעות. ' + (last ? 'גיבוי אחרון: ' + new Date(last).toLocaleDateString('he-IL') + '.' : 'עדיין לא נשמר גיבוי.') }),
    el('div', { class: 'confirm' }, [exportBtn, importBtn]), file, confirmBox, msgEl,
    el('div', { class: 'confirm' }, [el('button', { class: 'btn', type: 'button', text: 'סגור', onclick: () => $('#menu').close() })]),
  );
  if (!$('#menu').open) $('#menu').showModal();
}

/* ---------- first launch ---------- */
function notice(kids) { const n = $('#notice'); n.textContent = ''; if (!kids) { n.hidden = true; return; } n.append(...[].concat(kids)); n.hidden = false; }
async function maybeOfferStarter() {
  let done = false; try { done = !!(await Store.get('meta', 'starterOffered')); } catch (e) {}
  if (done || st.owned.size) return;
  const years = STARTER_OWNED.map(id => id.replace('c-', '')).join(', ');
  notice([
    el('span', { text: 'לסמן את הקראונים שכבר יש לך (' + years + ')? המחירים לא נכללים, אפשר להוסיף אותם בכרטיס של כל מטבע.' }),
    el('button', { class: 'btn primary', type: 'button', text: 'כן, סמן', onclick: async () => {
      for (const id of STARTER_OWNED) {
        const rec = { series: 'crowns', grade: '', paid: null, acquired: '', note: '', updatedAt: nowIso() };
        await Store.put('owned', id, rec); st.owned.set(id, rec);
      }
      await Store.put('meta', 'starterOffered', true); notice(null); render();
    } }),
    el('button', { class: 'btn', type: 'button', text: 'לא, תודה', onclick: async () => { await Store.put('meta', 'starterOffered', true); notice(null); } }),
  ]);
}

/* ---------- boot ---------- */
async function load() {
  const [owned, extras, photos] = await Promise.all([Store.all('owned'), Store.all('extras'), Store.all('photos')]);
  st.owned = owned;
  for (const id of [...st.photos.keys()]) setPhotoUrl(id, null);
  for (const [id, blob] of photos) setPhotoUrl(id, blob);
  st.extras = new Map([...extras].map(([id, x]) => [id, extraToItem(id, x)]));
}

$('#addBtn').addEventListener('click', openAdder);
$('#menuBtn').addEventListener('click', () => openMenu());
document.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => { st.filter = c.dataset.f; render(); }));
for (const d of [$('#sheet'), $('#adder'), $('#menu')]) d.addEventListener('click', e => { if (e.target === d) d.close(); });

render();
load().then(() => { st.ready = true; render(); maybeOfferStarter(); Store.persist(); })
  .catch(() => notice(el('span', { text: 'לא הצלחתי לפתוח את האחסון בטלפון. אם הדפדפן במצב גלישה בסתר, פתח אותו במצב רגיל.' })));

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
})();
