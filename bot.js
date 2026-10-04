// The album assistant: understands short Hebrew requests and turns them into album actions.
// No AI and no server: plain pattern matching over the catalog's groups, years and denominations.
'use strict';

const Bot = (() => {
  const norm = s => String(s || '').replace(/[׳'"״`.,:;!?()\[\]·\-–]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const has = (text, words) => words.some(w => text.includes(w));

  const W = {
    help: ['עזרה', 'מה אתה יודע', 'מה אפשר', 'איך משתמשים'],
    reset: ['הצג הכול', 'הצג הכל', 'תציג הכול', 'תציג הכל', 'החזר הכול', 'החזר הכל', 'אפס'],
    only: ['השאר רק', 'תשאיר רק', 'רק את', 'אני אוסף רק', 'אוסף רק'],
    unown: ['אין לי', 'מכרתי', 'הסר מהאוסף', 'תסיר מהאוסף', 'הוצא מהאוסף'],
    own: ['יש לי', 'סמן', 'תסמן', 'קניתי', 'קיבלתי', 'הוסף לאוסף', 'תוסיף לאוסף'],
    hide: ['הסתר', 'תסתיר', 'הורד', 'תוריד', 'הסר', 'תסיר', 'בלי', 'אל תציג', 'לא אוסף'],
    show: ['הצג', 'תציג', 'החזר', 'תחזיר', 'הוסף בחזרה'],
    missing: ['מה חסר', 'חסרים', 'חסר לי', 'מה עוד חסר'],
    count: ['כמה יש', 'כמה מטבעות', 'מה המצב', 'סטטוס'],
    addCol: ['הוסף אוסף', 'תוסיף אוסף', 'פתח אוסף', 'תפתח אוסף', 'הוסף את האוסף', 'הוסף קטלוג', 'תוסיף קטלוג'],
  };

  // years: 1935, ranges 1930-1940 / 1930 עד 1940
  function years(text) {
    const out = new Set();
    const range = /(1[89]\d\d|20\d\d)\s*(?:-|–|עד)\s*(1[89]\d\d|20\d\d)/g;
    let m, rest = text;
    while ((m = range.exec(text))) { for (let y = +m[1]; y <= +m[2]; y++) out.add(y); rest = rest.replace(m[0], ' '); }
    for (const y of rest.match(/\b(1[89]\d\d|20\d\d)\b/g) || []) out.add(+y);
    return out;
  }

  const STOP = new Set(['מיל', 'מילים', 'קראון', 'קראונים', 'מטבעות']);
  // groups whose name shares a meaningful word with the request (or a denomination like "50 מיל")
  function matchGroups(text, groups) {
    const t = ' ' + norm(text) + ' ';
    const found = new Set();
    for (const m of t.matchAll(/(\d+)\s*(?:מיל|מילים)/g)) { const g = groups.find(g => g.key === 'd' + m[1]); if (g) found.add(g.key); }
    for (const g of groups) {
      const words = norm(g.name).split(' ').filter(w => w.length >= 3 && !/^\d+$/.test(w) && !STOP.has(w));
      // multi-word names (ג'ורג' החמישי) need the distinguishing word too
      const ordinal = words.find(w => /^ה(ראשון|שני|שלישי|רביעי|חמישי|שישי|שביעי|שנייה)$/.test(w));
      const main = words.filter(w => w !== ordinal);
      if (main.some(w => t.includes(' ' + w + ' ') || t.includes(w)) && (!ordinal || t.includes(ordinal))) found.add(g.key);
    }
    return found;
  }

  function pickCollection(text, api) {
    const t = norm(text);
    for (const c of api.collections()) if (t.includes(norm(c.name))) return c;
    if (t.includes('קראון')) { const c = api.collections().find(c => c.id === 'crowns'); if (c) return c; }
    if (t.includes('מנדט')) { const c = api.collections().find(c => c.id === 'mandate'); if (c) return c; }
    // otherwise: the collection whose groups the request names (e.g. "100 מיל" belongs to the Mandate),
    // preferring the open one when both match
    const cur = api.current();
    if (cur && matchGroups(text, api.groups(cur.id)).size) return cur;
    for (const c of api.collections()) if (matchGroups(text, api.groups(c.id)).size) return c;
    return cur;
  }

  // the coins a request points at (inside one collection): by group, by year, or both
  function target(text, col, api) {
    const groups = matchGroups(text, api.groups(col.id));
    const ys = years(text);
    const all = api.items(col.id, true);
    let items = all;
    if (groups.size) items = items.filter(i => groups.has(i.group));
    if (ys.size) items = items.filter(i => ys.has(Number(i.y)));
    if (!groups.size && !ys.size) items = [];
    return { groups, ys, items };
  }

  const list = (arr, n = 12) => arr.slice(0, n).join(', ') + (arr.length > n ? ' ועוד ' + (arr.length - n) : '');

  function help() {
    return 'אני יכול לעזור לך לנהל את האלבום. נסה למשל:\n' +
      '• "השאר רק ויקטוריה" או "השאר רק 50 מיל"\n' +
      '• "הסתר את 1947" או "הסתר את ג\'ורג\' השלישי"\n' +
      '• "הצג הכול" (מחזיר את כל מה שהוסתר)\n' +
      '• "יש לי קראון 1889" או "סמן 100 מיל 1935"\n' +
      '• "אין לי 1887"\n' +
      '• "מה חסר לי בויקטוריה"\n' +
      '• "כמה יש לי"\n' +
      '• "הוסף אוסף מטבעות המנדט"';
  }

  async function handle(input, api) {
    const text = ' ' + norm(input) + ' ';
    if (!norm(input)) return { reply: 'כתוב לי מה לעשות, או "עזרה" לדוגמאות.' };
    if (has(text, W.help)) return { reply: help() };

    // add a catalog from the library
    if (has(text, W.addCol)) {
      const lib = api.library().find(c => text.includes(norm(c.name)) || norm(c.name).split(' ').some(w => w.length >= 4 && text.includes(w)));
      if (!lib) return { reply: 'איזה אוסף? בספרייה יש: ' + api.library().map(c => c.name).join(', ') + '. אפשר גם ליצור אוסף משלך מהכרטיס "+ אוסף חדש".' };
      if (api.collections().some(c => c.id === lib.id)) return { reply: '"' + lib.name + '" כבר נמצא באלבום שלך.' };
      await api.addCatalog(lib.id);
      return { reply: 'הוספתי את "' + lib.name + '" לאלבום.' };
    }

    const col = pickCollection(input, api);
    if (!col) return { reply: 'עוד אין לך אוספים. כתוב למשל "הוסף אוסף קראונים בריטיים".' };
    const isCatalog = col.kind === 'catalog';

    if (has(text, W.count)) {
      const s = api.stats(col.id), all = api.stats();
      return { reply: 'ב"' + col.name + '": ' + s.have + ' מתוך ' + s.total + ' (' + s.pct + '%). בכל האלבום: ' + all.have + ' מתוך ' + all.total + '.' };
    }

    if (has(text, W.missing)) {
      const t = target(input, col, api);
      const pool = (t.items.length ? t.items : api.items(col.id, false)).filter(i => !api.isOwned(i.id) && !api.isHidden(col.id, i));
      if (!pool.length) return { reply: 'לא חסר לך כלום כאן. כל הכבוד!' };
      return { reply: 'חסרים לך ' + pool.length + ': ' + list(pool.map(i => i.title)) };
    }

    if (has(text, W.reset)) {
      if (!isCatalog) return { reply: 'באוסף משלך אין מטבעות מוסתרים.' };
      const undo = await api.setHidden(col.id, { groups: [], items: [] });
      return { reply: 'החזרתי את כל המטבעות של "' + col.name + '" לאלבום.', undo };
    }

    // own / not own
    const unown = has(text, W.unown), own = !unown && has(text, W.own);
    if (own || unown) {
      const t = target(input, col, api);
      if (!t.items.length) return { reply: 'לא הבנתי איזה מטבע. כתוב גם שנה, למשל "יש לי 1889" או "יש לי 100 מיל 1935".' };
      if (t.items.length > 15) return { reply: 'זה ' + t.items.length + ' מטבעות. כדי לא לסמן בטעות, תהיה יותר ספציפי (ערך או שנה).' };
      const undo = await api.setOwned(t.items.map(i => i.id), own);
      return { reply: (own ? 'סימנתי שיש לך: ' : 'הורדתי מהאוסף: ') + list(t.items.map(i => i.title)), undo };
    }

    // hide / show / keep only (album customization)
    const only = has(text, W.only), hide = !only && has(text, W.hide), show = !only && !hide && has(text, W.show);
    if (only || hide || show) {
      if (!isCatalog) return { reply: 'התאמה של האלבום אפשרית באוספים מהספרייה. באוסף משלך פשוט מוחקים או מוסיפים מטבעות.' };
      const t = target(input, col, api);
      if (!t.groups.size && !t.ys.size) return { reply: 'לא מצאתי מה להסתיר או להציג. אפשר לכתוב שם של ' + api.groupLabel(col.id) + ' או שנה, למשל "השאר רק ויקטוריה" או "הסתר את 1947".' };
      const cur = api.hidden(col.id), groups = new Set(cur.groups), items = new Set(cur.items);
      const allGroups = api.groups(col.id).map(g => g.key), all = api.items(col.id, true);
      if (only) {
        if (t.groups.size && !t.ys.size) { groups.clear(); allGroups.forEach(g => { if (!t.groups.has(g)) groups.add(g); }); }
        else { const keep = new Set(t.items.map(i => i.id)); all.forEach(i => { if (!keep.has(i.id)) items.add(i.id); else items.delete(i.id); }); t.groups.forEach(g => groups.delete(g)); }
      } else if (t.groups.size && !t.ys.size) {
        t.groups.forEach(g => hide ? groups.add(g) : groups.delete(g));
      } else {
        t.items.forEach(i => hide ? items.add(i.id) : items.delete(i.id));
        if (show) t.groups.forEach(g => groups.delete(g));
      }
      const undo = await api.setHidden(col.id, { groups: [...groups], items: [...items] });
      const s = api.stats(col.id);
      return { reply: (only ? 'השארתי באלבום רק את מה שביקשת.' : hide ? 'הסתרתי.' : 'החזרתי לאלבום.') + ' עכשיו ב"' + col.name + '" יש ' + s.total + ' מטבעות.', undo };
    }

    return { reply: 'לא הבנתי. ' + help() };
  }

  return { handle, years, matchGroups };
})();
