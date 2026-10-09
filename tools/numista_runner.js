// Paste into a Numista tab (javascript_exec). Collects list pages and type pages with same-origin fetch, one request
// at a time, paced by a Worker timer (not throttled in hidden tabs). Results live in localStorage — export them to
// tools/data often (__export), the browser pane can lose its storage.
// each wait has its own id, so several loops (a run and a chain waiting for it) can sleep at once
window.__sleepW2 = window.__sleepW2 || new Worker(URL.createObjectURL(new Blob(['onmessage=e=>setTimeout(()=>postMessage(e.data[0]),e.data[1])'])));
window.__sleepN = window.__sleepN || 0; window.__sleepCb = window.__sleepCb || {};
__sleepW2.onmessage = e => { const f = __sleepCb[e.data]; delete __sleepCb[e.data]; f && f(); };
window.__sleep = ms => new Promise(r => { const id = ++__sleepN; __sleepCb[id] = r; __sleepW2.postMessage([id, ms]); });
window.__T = e => (e ? e.textContent : '').replace(/\s+/g, ' ').trim();
window.__parse = (html, id) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const ft = doc.querySelector('#fiche_caracteristiques table');
  if (!ft) return null;
  const feat = {};
  for (const r of ft.rows) if (r.cells.length > 1) feat[__T(r.cells[0])] = __T(r.cells[1]).slice(0, 160);
  const sec = name => { const h = [...doc.querySelectorAll('h3')].find(h => __T(h) === name); if (!h) return ''; let t = '', n = h.nextElementSibling; while (n && n.tagName !== 'H3') { t += ' ' + __T(n); n = n.nextElementSibling; } return t.trim().slice(0, 120); };
  const rows = [...doc.querySelectorAll('table.collection tr.date_row')].map(r => {
    const g = s => __T(r.querySelector(s));
    return [g('.date'), g('.tirage'), g('.comment')];
  }).filter(r => r[0] !== 'Undetermined' || r[1] || r[2]);
  return { id, t: __T(doc.querySelector('h1')), f: feat, edge: sec('Edge'), mint: sec('Mint') || sec('Mints'), rows };
};
window.__get = async url => {
  const r = await fetch(url, { credentials: 'include' });
  const h = await r.text();
  if (!r.ok || h.includes('Checking connection')) throw new Error('BLOCKED ' + r.status + ' ' + url);
  return h;
};
// list pages of one or more issuers -> { id: 'issuer :: section :: text' }
window.__runList = async (bases, store, delay) => {
  window.__state = 'list';
  const out = JSON.parse(localStorage.getItem(store) || '{}');
  try {
    for (const base of bases) for (let p = 1; ; p++) {
      const doc = new DOMParser().parseFromString(await __get('/catalogue/' + base + '-' + p + '.html'), 'text/html');
      let cur = '';
      for (const el of doc.querySelectorAll('h2, h3, a')) {
        if (el.tagName !== 'A') { const t = __T(el); if (/\(\d{4}-/.test(t)) cur = t; continue; }
        const href = el.getAttribute('href') || '';
        if (!/^\/\d+$/.test(href)) continue;
        const block = el.closest('.resultat_recherche, li, div');
        const txt = __T(block || el);
        if (/ Coins( ›|\s|$)/.test(' ' + txt)) out[href.slice(1)] = base + ' :: ' + cur + ' :: ' + txt.slice(0, 160);
      }
      localStorage.setItem(store, JSON.stringify(out));
      window.__state = 'list ' + base + ' p' + p + ' total ' + Object.keys(out).length;
      if (![...doc.querySelectorAll('a')].some(a => __T(a) === 'Next')) break;
      await __sleep(delay);
    }
    window.__state = 'LIST DONE ' + Object.keys(out).length;
  } catch (e) { window.__state = e.message; }
};
// type pages for the ids in queueKey -> store
window.__run = async (queueKey, store, delay) => {
  window.__state = 'types';
  const q = JSON.parse(localStorage.getItem(queueKey) || '[]');
  try {
    for (const id of q) {
      if (window.__stop) { window.__state = 'stopped'; return; }
      const all = JSON.parse(localStorage.getItem(store) || '{}');
      if (all[id]) continue;
      const rec = __parse(await __get('/' + id), id);
      if (!rec) throw new Error('unparsed ' + id);
      all[id] = rec; localStorage.setItem(store, JSON.stringify(all));
      window.__state = 'types ' + Object.keys(all).length + '/' + q.length + ' ' + rec.t;
      await __sleep(delay);
    }
    window.__state = 'TYPES DONE';
  } catch (e) { window.__state = e.message; }
};
// gzip+base64 of a store (optionally only ids not exported yet), for writing to tools/data
window.__export = async (store, from = 0, n = 1e9) => {
  const all = Object.values(JSON.parse(localStorage.getItem(store) || '{}')).slice(from, from + n);
  const buf = new Uint8Array(await new Response(new Blob([JSON.stringify(all)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  let b = ''; for (let i = 0; i < buf.length; i++) b += String.fromCharCode(buf[i]);
  window.__b64 = btoa(b); return all.length + ' items, ' + window.__b64.length + ' chars';
};
// compact export: drops page fields the builders never read (technique, designer...); `ids` limits it to some types
window.__slim = x => {
  const DROP = ['Technique', 'Orientation', 'Demonetized', 'Number', 'Shape', 'Engraver', 'Designer', 'Series', 'Commemorated topic'];
  return { id: x.id, t: x.t, rows: x.rows, edge: (x.edge || '').split(' ©')[0].slice(0, 80), mint: (x.mint || '').slice(0, 80),
    f: Object.fromEntries(Object.entries(x.f).filter(([k]) => !DROP.includes(k))
      .map(([k, v]) => [k, k === 'References' ? (v.match(/(KM#\s*[\w.]+|Schön#\s*[\w.]+)/g) || []).join(', ') : v])) };
};
window.__exportSlim = async (store, ids) => {
  const all = JSON.parse(localStorage.getItem(store) || '{}');
  const vals = (ids || Object.keys(all)).filter(k => all[k]).map(k => __slim(all[k]));
  const buf = new Uint8Array(await new Response(new Blob([JSON.stringify(vals)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  let b = ''; for (let i = 0; i < buf.length; i++) b += String.fromCharCode(buf[i]);
  window.__b64 = btoa(b); return [vals.length, window.__b64.length];
};
