// Reference data: which coins exist in each series (not what is owned).
'use strict';

const S925 = { metal: 'silver', metalName: 'כסף 925' };
const S500 = { metal: 'silver', metalName: 'כסף 500' };
const CUNI = { metal: 'cuni', metalName: 'קופרו-ניקל' };
const METAL_NAME = { bronze: 'ברונזה', cuni: 'קופרו-ניקל', silver: 'כסף', alu: 'אלומיניום' };

const CROWN_REIGNS = [
  { key: 'g3', cypher: 'GIIIR', name: "ג'ורג' השלישי", years: '1818–1820', design: "ג'ורג' הקדוש והדרקון (פיסטרוצ'י)", m: S925,
    coins: [{ y: 1818 }, { y: 1819 }, { y: 1820 }] },
  { key: 'g4', cypher: 'GIVR', name: "ג'ורג' הרביעי", years: '1821–1826', design: "ג'ורג' הקדוש והדרקון / סמל ממלכתי", m: S925,
    coins: [{ y: 1821 }, { y: 1822 }, { y: 1826, id: 'c-1826p', tag: 'פרוף', rare: 'הוטבע כפרוף בלבד' }] },
  { key: 'w4', cypher: 'WIVR', name: 'ויליאם הרביעי', years: '1831', design: 'מגן ממלכתי', m: S925,
    coins: [{ y: 1831, id: 'c-1831p', tag: 'פרוף', rare: 'הוטבע כפרוף בלבד, נדיר מאוד' }] },
  { key: 'vyh', cypher: 'VR', name: 'ויקטוריה, ראש צעיר', years: '1839–1847', design: 'מגן מוכתר', m: S925,
    coins: [{ y: 1839, id: 'c-1839p', tag: 'פרוף', rare: 'הוטבע כפרוף בלבד' }, { y: 1844 }, { y: 1845 }, { y: 1847 }] },
  { key: 'vgo', cypher: 'VR', name: 'ויקטוריה, הקראון הגותי', years: '1847–1853', design: 'עיצוב גותי, מהיפים בסדרה', m: S925,
    coins: [{ y: 1847, id: 'c-1847g', tag: 'גותי' }, { y: 1853, id: 'c-1853p', tag: 'פרוף', rare: 'הוטבע כפרוף בלבד' }] },
  { key: 'vjh', cypher: 'VR', name: 'ויקטוריה, ראש היובל', years: '1887–1892', design: "ג'ורג' הקדוש והדרקון", m: S925,
    coins: [{ y: 1887 }, { y: 1888 }, { y: 1889 }, { y: 1890 }, { y: 1891 }, { y: 1892 }] },
  { key: 'voh', cypher: 'VRI', name: 'ויקטוריה, ראש זקן', years: '1893–1900', design: "ג'ורג' הקדוש והדרקון, שנת שלטון על השפה", m: S925,
    coins: [{ y: 1893 }, { y: 1894 }, { y: 1895 }, { y: 1896 }, { y: 1897 }, { y: 1898 }, { y: 1899 }, { y: 1900 }] },
  { key: 'e7', cypher: 'ERVII', name: 'אדוארד השביעי', years: '1902', design: "ג'ורג' הקדוש והדרקון", m: S925,
    coins: [{ y: 1902 }] },
  { key: 'g5', cypher: 'GVR', name: "ג'ורג' החמישי", years: '1927–1936', design: 'קראון הזר (Wreath), יובל 1935', m: S500,
    coins: [
      { y: 1927, id: 'c-1927p', tag: 'פרוף', rare: 'פרוף בלבד, כ-15,000' },
      { y: 1928, rare: '9,034 הוטבעו' }, { y: 1929, rare: '4,994 הוטבעו' }, { y: 1930, rare: '4,847 הוטבעו' },
      { y: 1931, rare: '4,056 הוטבעו' }, { y: 1932, rare: '2,395 הוטבעו' }, { y: 1933, rare: '7,132 הוטבעו' },
      { y: 1934, rare: '932 הוטבעו, מהנדירים בסדרה' },
      { y: 1935, tag: 'יובל', design: "יובל הכסף, ג'ורג' הקדוש בסגנון ארט דקו" },
      { y: 1936, rare: '2,473 הוטבעו' }] },
  { key: 'g6', cypher: 'GVIR', name: "ג'ורג' השישי", years: '1937–1951', design: 'הכתרה 1937, פסטיבל בריטניה 1951', m: S500,
    coins: [{ y: 1937, tag: 'הכתרה' }, { y: 1951, tag: 'פסטיבל', m: CUNI }] },
  { key: 'e2', cypher: 'EIIR', name: 'אליזבת השנייה', years: '1953–1965', design: "הכתרה, תערוכה, צ'רצ'יל", m: CUNI,
    coins: [{ y: 1953, tag: 'הכתרה' }, { y: 1960, tag: 'תערוכה' }, { y: 1965, tag: "צ'רצ'יל" }] },
];

const CROWN_DIAM = 38.6;   // mm
const CROWNS = [];
for (const r of CROWN_REIGNS) for (const c of r.coins) {
  const m = c.m || r.m;
  CROWNS.push({ id: c.id || ('c-' + c.y), series: 'crowns', group: r.key, reign: r.key, cypher: r.cypher, y: c.y, tag: c.tag || '', diam: CROWN_DIAM,
    rare: c.rare || '', metal: m.metal, metalName: m.metalName,
    title: 'קראון ' + c.y + (c.tag ? ' (' + c.tag + ')' : ''), sub: r.name, design: c.design || r.design });
}

const MANDATE_DENOMS = [
  { d: 1, diam: 21, metal: 'bronze', metalName: 'ברונזה', holed: false, years: [1927, 1935, 1937, 1939, 1940, 1941, 1942, 1943, 1944, 1945, 1946, 1947] },
  { d: 2, diam: 28, metal: 'bronze', metalName: 'ברונזה', holed: false, years: [1927, 1941, 1942, 1945, 1946, 1947] },
  { d: 5, diam: 20, metal: 'cuni', metalName: 'קופרו-ניקל, מחורר', holed: true, years: [1927, 1934, 1935, 1939, 1941, 1942, 1944, 1946, 1947],
    war: { 1942: 'bronze', 1944: 'bronze' } },
  { d: 10, diam: 27, metal: 'cuni', metalName: 'קופרו-ניקל, מחורר', holed: true, years: [1927, 1933, 1934, 1935, 1937, 1939, 1940, 1941, 1942, 1943, 1946, 1947],
    war: { 1943: 'bronze' }, both: [1942] },
  { d: 20, diam: 30.5, metal: 'cuni', metalName: 'קופרו-ניקל, מחורר', holed: true, years: [1927, 1933, 1934, 1935, 1940, 1941, 1942, 1944],
    war: { 1942: 'bronze', 1944: 'bronze' } },
  { d: 50, diam: 23.6, metal: 'silver', metalName: 'כסף 720', holed: false, years: [1927, 1931, 1933, 1934, 1935, 1939, 1940, 1942] },
  { d: 100, diam: 29, metal: 'silver', metalName: 'כסף 720', holed: false, years: [1927, 1931, 1933, 1934, 1935, 1939, 1940, 1942] },
];

const MANDATE = [];
for (const den of MANDATE_DENOMS) for (const y of den.years) {
  const variants = (den.both || []).includes(y) ? ['cuni', 'bronze'] : [(den.war && den.war[y]) || den.metal];
  for (const metal of variants) {
    const isAlt = variants.length > 1 && metal === 'bronze';
    let rare = '';
    if (y === 1947) rare = den.d === 1 ? 'רוב ההנפקה הותכה, ידועים כ-5 עותקים' : 'רוב ההנפקה הותכה, נדיר מאוד';
    if (den.d === 1 && y === 1945) rare = 'שנה שלא מופיעה בכל הקטלוגים, לאמת';
    const metalName = metal === den.metal ? den.metalName : (METAL_NAME[metal] + (den.holed ? ', מחורר (הנפקת מלחמה)' : ''));
    MANDATE.push({ id: 'm-' + den.d + '-' + y + (isAlt ? 'b' : ''), series: 'mandate', group: 'd' + den.d, d: den.d, y, metal, metalName, diam: den.diam,
      holed: den.holed, tag: variants.length > 1 ? METAL_NAME[metal] : '', rare, variant: isAlt,
      title: den.d + (den.d === 1 ? ' מיל ' : ' מילים ') + y + (variants.length > 1 ? ' (' + METAL_NAME[metal] + ')' : ''),
      sub: 'מנדט בריטי, פלשתינה (א"י)' });
  }
}
const MANDATE_YEARS = [...new Set(MANDATE.map(c => c.y))].sort((a, b) => a - b);

// The catalog library: ready-made checklists anyone can add to their album. Which catalogs a person
// collects, and what they own, is personal and lives only on their device (see store.js), never here.
const CATALOGS = {
  crowns: { name: 'קראונים בריטיים', sub: '1818–1965, חמישה שילינג', list: CROWNS, theme: 'crowns', groupLabel: 'מלך',
    groups: CROWN_REIGNS.map(r => ({ key: r.key, name: r.name + ' (' + r.years + ')' })),
    about: '43 קראונים מג\'ורג\' השלישי ועד אליזבת השנייה, כולל פרופים ושנים נדירות.' },
  mandate: { name: 'מטבעות המנדט', sub: '1927–1947, כל הערכים והשנים', list: MANDATE, theme: 'mandate', groupLabel: 'ערך',
    groups: MANDATE_DENOMS.map(d => ({ key: 'd' + d.d, name: d.d + (d.d === 1 ? ' מיל' : ' מילים') + ' · ' + d.metalName.split(',')[0] })),
    about: '64 מטבעות: 1, 2, 5, 10, 20, 50 ו-100 מיל בכל שנות ההטבעה.' },
};
const GRADES = ['', 'G', 'VG', 'F', 'VF', 'XF', 'AU', 'UNC', 'פרוף'];

// Big catalogs live in their own JSON files (catalogs/<key>.json) and load when first needed.
// File format: { name, sub, about, theme, groupLabel, groups: [{ key, name }],
//                items: [{ id, group, y, label, metal, diam, variant?, rare?, tag?, note?, holed? }] }
// Register one here with { src } and it appears in the library; its coins load on demand.
const CATALOG_FILES = {
  pruta: { src: 'catalogs/pruta.json', name: 'מטבעות הפרוטה', sub: '1949–1960, תש"ט–תשט"ו', groupLabel: 'ערך',
    about: 'סדרת הפרוטה: כל ערך בכל שנה, כולל וריאנט הפנינה של 1949. מקור: Numista.' },
};
for (const [key, f] of Object.entries(CATALOG_FILES)) CATALOGS[key] = Object.assign({ list: null, groups: [], theme: 'file', groupLabel: 'קבוצה' }, f);

async function loadCatalogFile(key) {
  const cat = CATALOGS[key];
  if (!cat || !cat.src || cat.list) return cat;
  const res = await fetch(cat.src, { cache: 'no-cache' });
  if (!res.ok) throw new Error('catalog ' + key + ' ' + res.status);
  const data = await res.json();
  Object.assign(cat, { name: data.name || cat.name, sub: data.sub || cat.sub, about: data.about || cat.about,
    theme: data.theme || cat.theme, groupLabel: data.groupLabel || cat.groupLabel, groups: data.groups || [] });
  cat.list = (data.items || []).map(it => ({
    id: key + '-' + it.id, series: key, group: it.group, y: it.y, tag: it.tag || '', rare: it.rare || '', variant: !!it.variant,
    metal: it.metal || 'silver', metalName: it.metalName || METAL_NAME[it.metal] || '', diam: Number(it.diam) || 25, holed: !!it.holed,
    title: it.label, sub: cat.name + (it.variant ? ' · וריאנט' : ''), design: it.note || '',
  }));
  return cat;
}


// Album pages (sheet 242 x 312 mm): coins sit in square cardboard coin holders, and the sheet's pockets
// hold the holders. A page always uses the smallest layout whose holder window fits its largest coin:
//   P20: 20 pockets for 50 x 50 mm holders (window 17.5 - 39.5 mm)
//   P12: 12 pockets for 67 x 67 mm holders, for coins too big for a 39.5 mm window.
const ALBUM_PAGE = { w: 242, h: 312 };
const SHEET_TYPES = {
  P20: { key: 'P20', pockets: 20, cols: 4, rows: 5, holder: 50, maxWindow: 39.5 },
  P12: { key: 'P12', pockets: 12, cols: 3, rows: 4, holder: 67, maxWindow: 60 },
};
const HOLDER_WINDOWS = [17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 39.5];   // 50 x 50 mm holders
