// Reference data: which coins exist in each series (not what is owned).
'use strict';

const S925 = { metal: 'silver', metalName: 'כסף 925' };
const S500 = { metal: 'silver', metalName: 'כסף 500' };
const CUNI = { metal: 'cuni', metalName: 'קופרו-ניקל' };
const METAL_NAME = { bronze: 'ברונזה', cuni: 'קופרו-ניקל', silver: 'כסף', alu: 'אלומיניום', bimetal: 'דו-מתכתי', bimetal1: 'דו-מתכתי', gold: 'זהב', ngold: 'זהב נורדי', copper: 'נחושת', steel: 'פלדה' };

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
// Mintages 1902-1965 (Royal Mint figures as listed on Wikipedia, "Crown (British coin)"); earlier years are not listed there.
const CROWN_MINTAGE = { 1902: 256020, 1927: 15030, 1928: 9034, 1929: 4994, 1930: 4847, 1931: 4056, 1932: 2395, 1933: 7132, 1934: 932,
  1935: 714769, 1936: 2473, 1937: 418699, 1951: 1983540, 1953: 5962621, 1960: 1024038, 1965: 19640000 };
const CROWNS = [];
for (const r of CROWN_REIGNS) for (const c of r.coins) {
  const m = c.m || r.m;
  CROWNS.push({ id: c.id || ('c-' + c.y), series: 'crowns', group: r.key, reign: r.key, cypher: r.cypher, y: c.y, tag: c.tag || '', diam: CROWN_DIAM,
    rare: c.rare || '', metal: m.metal, metalName: m.metalName, noKey: c.tag === 'פרוף', mintage: CROWN_MINTAGE[c.y] || null,
    title: 'קראון ' + c.y + (c.tag ? ' (' + c.tag + ')' : ''), sub: r.name, design: c.design || r.design });
}

// The Mandate series (Royal Mint, London). Years, mintages and specs follow Numista / KM.
// Item ids ('m-<value>-<year>', 'b' for the 1942 bronze 10 mils) are stable: collections and photos point at them.
const MANDATE_DENOMS = [
  { d: 1, diam: 21, metal: 'bronze', metalName: 'ברונזה', holed: false, km: 'KM# 1', weight: 3.23, thickness: 1.36,
    composition: '95.5% נחושת, 3% בדיל, 1.5% אבץ', edge: 'חלק',
    years: { 1927: 10000000, 1935: 704000, 1937: 1200000, 1939: 3700000, 1940: 396000, 1941: 1920000, 1942: 4480000,
             1943: 2800000, 1944: 1400000, 1946: 1632000, 1947: 2880000 },
    melted1947: 'הוטבעו 2,880,000 אך כמעט כולם הותכו; ידועים כ-5 עותקים ועוד כמה במוזיאונים.', survivors1947: 5 },
  { d: 2, diam: 28, metal: 'bronze', metalName: 'ברונזה', holed: false, km: 'KM# 2', weight: 7.8, thickness: 1.6,
    composition: '95.5% נחושת, 3% בדיל, 1.5% אבץ', edge: 'חלק',
    years: { 1927: 5000000, 1941: 1600000, 1942: 2400000, 1945: 960000, 1946: 960000, 1947: 480000 },
    melted1947: 'הוטבעו 480,000 אך כמעט כולם הותכו; ידוע עותק אחד.', survivors1947: 1 },
  { d: 5, diam: 20, metal: 'cuni', metalName: 'קופרו-ניקל, מחורר', holed: true, km: 'KM# 3', weight: 2.91, thickness: 1.34,
    composition: '75% נחושת, 25% ניקל', edge: 'חלק',
    years: { 1927: 10000000, 1934: 500000, 1935: 2700000, 1939: 2000000, 1941: 400000, 1942: 2700000, 1944: 1000000, 1946: 1000000, 1947: 1000000 },
    war: { 1942: 'bronze', 1944: 'bronze' }, warKm: 'KM# 3a', warWeight: 2.9,
    melted1947: 'הוטבעו מיליון אך כמעט כולם הותכו; ידועים 3 עותקים.', survivors1947: 3 },
  { d: 10, diam: 27, metal: 'cuni', metalName: 'קופרו-ניקל, מחורר', holed: true, km: 'KM# 4', weight: 6.5, thickness: 1.5,
    composition: '75% נחושת, 25% ניקל', edge: 'חלק',
    years: { 1927: 5000000, 1933: 500000, 1934: 500000, 1935: 1150000, 1937: 750000, 1939: 1000000, 1940: 1500000, 1941: 400000,
             1942: 600000, 1943: 1000000, 1946: 1000000, 1947: 1000000 },
    war: { 1943: 'bronze' }, both: { 1942: 1000000 }, warKm: 'KM# 4a', warWeight: 6.47,
    melted1947: 'הוטבעו מיליון אך כמעט כולם הותכו; ידוע עותק אחד.', survivors1947: 1 },
  { d: 20, diam: 30.5, metal: 'cuni', metalName: 'קופרו-ניקל, מחורר', holed: true, km: 'KM# 5', weight: 11.33, thickness: 2.2,
    composition: '75% נחושת, 25% ניקל', edge: 'חלק',
    years: { 1927: 1500000, 1933: 250000, 1934: 125000, 1935: 575000, 1940: 200000, 1941: 100000, 1942: 1100000, 1944: 1000000 },
    war: { 1942: 'bronze', 1944: 'bronze' }, warKm: 'KM# 5a', warWeight: 11.3 },
  { d: 50, diam: 23.5, metal: 'silver', metalName: 'כסף 720', holed: false, km: 'KM# 6', weight: 5.83, thickness: 1.37,
    composition: '72% כסף, 28% נחושת', edge: 'מחורץ',
    years: { 1927: 8000000, 1931: 500000, 1933: 1000000, 1934: 398861, 1935: 5600000, 1939: 3000000, 1940: 2000000, 1942: 5000000 } },
  { d: 100, diam: 28.5, metal: 'silver', metalName: 'כסף 720', holed: false, km: 'KM# 7', weight: 11.7, thickness: 2.2,
    composition: '72% כסף, 28% נחושת', edge: 'מחורץ',
    years: { 1927: 2000000, 1931: 250000, 1933: 500000, 1934: 200000, 1935: 2850000, 1939: 1500000, 1940: 1000000, 1942: 2500000 } },
];
// Proof strikes recorded for the 1927 set (66-68 pieces).
const MANDATE_PROOF_1927 = { 1: 68, 2: 68, 5: 66, 10: 66, 20: 66, 50: 66, 100: 66 };

// Key / Semi-Key, one rule for every album: within each coin type (same value and design: the catalog's typeKey, per
// country) the Key Date is the circulation date with the lowest mintage and the Semi-Key is the next lowest.
// Proofs, varieties, errors and coins struck only for sets do not compete. `effective` lets a series count survivors
// instead of the struck number (the melted 1947 Mandate issues). A series needs 2 dated mintages for a Key and 3 for a Semi-Key.
const SET_ONLY = /לסטים|בסטים|sets? only|שלא למחזור|לא הונפק למחזור|מהדורת אספנים|כסף 40%/i;
function markSeriesKeys(list, seriesOf = it => [it.group, it.country || '', it.typeKey || ''].join('|')) {
  const fmt = n => n.toLocaleString('en-US');
  const series = new Map();
  for (const it of list) {
    it.rarityTier = ''; it.rarityReason = '';
    if (it.proof || it.noKey || it.variant || it.error) continue;
    const n = it.effective != null ? it.effective : (it.mintageCirculated != null ? it.mintageCirculated : it.mintage);
    if (!(n > 0) || SET_ONLY.test((it.design || it.note || '') + ' ' + (it.tag || '') + ' ' + (it.title || ''))) continue;
    const k = seriesOf(it);
    if (!series.has(k)) series.set(k, []);
    series.get(k).push([n, it]);
  }
  for (const rows of series.values()) {
    if (rows.length < 2) continue;
    const values = [...new Set(rows.map(r => r[0]))].sort((a, b) => a - b);
    for (const [n, it] of rows) {
      const shown = it.effective != null ? (it.effectiveText || fmt(n)) : fmt(n) + ' מטבעות';
      if (n === values[0]) { it.rarityTier = 'key'; it.rarityReason = 'Key Date של הסדרה: הכמות הנמוכה ביותר (' + shown + ').'; }
      else if (rows.length >= 3 && n === values[1]) { it.rarityTier = 'semi-key'; it.rarityReason = 'Semi-Key: הכמות השנייה הנמוכה בסדרה (' + shown + ').'; }
    }
  }
  return list;
}

const MANDATE = [];
for (const den of MANDATE_DENOMS) for (const [ys, mintage] of Object.entries(den.years)) {
  const y = Number(ys);
  const variants = den.both && den.both[y] ? ['cuni', 'bronze'] : [(den.war && den.war[y]) || den.metal];
  for (const metal of variants) {
    const isAlt = variants.length > 1 && metal === 'bronze';
    const war = metal !== den.metal;
    const count = isAlt ? den.both[y] : mintage;
    const rare = y === 1947 ? (den.melted1947 || 'רוב ההנפקה הותכה, נדיר מאוד') : '';
    // the 1947 issues were melted almost entirely: rank them by the few known survivors
    const effective = y === 1947 && den.survivors1947 ? den.survivors1947 : null;
    const metalName = metal === den.metal ? den.metalName : (METAL_NAME[metal] + (den.holed ? ', מחורר (הנפקת מלחמה)' : ''));
    MANDATE.push({ id: 'm-' + den.d + '-' + y + (isAlt ? 'b' : ''), series: 'mandate', group: 'd' + den.d, d: den.d, y, metal, metalName, diam: den.diam,
      holed: den.holed, tag: variants.length > 1 ? METAL_NAME[metal] : '', rare, variant: isAlt, effective,
      effectiveText: effective ? 'הותך; ידועים ' + effective + ' עותקים בלבד' : '',
      mintage: count, mintageProof: y === 1927 ? MANDATE_PROOF_1927[den.d] : null,
      composition: war ? 'ברונזה' : den.composition, weight: war ? den.warWeight : den.weight, thickness: den.thickness,
      catalog: war ? den.warKm : den.km, edge: den.edge, mint: 'המטבעה המלכותית, לונדון',
      title: den.d + (den.d === 1 ? ' מיל ' : ' מילים ') + y + (variants.length > 1 ? ' (' + METAL_NAME[metal] + ')' : ''),
      sub: 'מנדט בריטי, פלשתינה (א"י)' });
  }
}
markSeriesKeys(MANDATE, it => it.group + '|' + it.metal);   // the bronze war issues are their own type
markSeriesKeys(CROWNS, it => it.group + '|' + it.tag);   // a type = reign and design (the 1935 jubilee crown is its own)
attachImages('mandate', MANDATE); attachImages('crowns', CROWNS);   // optional pictures, arrive after the first render
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
//                items: [{ id, group, y, label, metal, diam, variant?, mint?, mintMark?, mintVariant?, typeKey?, rare?, tag?, note?, holed? }] }
// Register one here with { src } and it appears in the library; its coins load on demand.
const CATALOG_FILES = {
  pruta: { src: 'catalogs/pruta.json', name: 'מטבעות הפרוטה', sub: '1948–1960, תש״ח–תשי״ז', groupLabel: 'ערך',
    about: '25 המיל של 1948 וסדרת הפרוטה: כל ערך בכל שנה, וריאנטים (פנינה, שפה, שרשרת), מטבעות הכסף ו-Key Dates.' },
  lira: { src: 'catalogs/lira.json', name: 'אגורות ולירות', sub: '1960–1980, תש"ך–תש"ם', groupLabel: 'ערך',
    about: 'סדרת האגורה והלירה של מדינת ישראל. מטבעות מחזור לפי ערך, עם הכנה לשנים, וריאנטים ומטבעות.' },
  oldshekel: { src: 'catalogs/old-shekel.json', name: 'השקל הישן', sub: '1980–1985, תש"ם–תשמ"ה', groupLabel: 'ערך',
    about: 'סדרת האגורות החדשות והשקל הישן. תשעה עריכים בסדרת המחזור.' },
  ukpre: { src: 'catalogs/uk-predecimal.json', name: 'בריטניה — לפני העשרוני', sub: '1797–1970, פרת׳ינג עד חצי קראון', groupLabel: 'ערך',
    about: 'פרת׳ינג, חצי פני, פני, 6 פני, שילינג (אנגלי וסקוטי), פלורין וחצי קראון לפי שנה, עם המלך והמתכת של כל שנה.' },
  ukdec: { src: 'catalogs/uk-decimal.json', name: 'בריטניה — מטבעות עשרוניים', sub: '1968–היום, ½ פני עד 2 לירות', groupLabel: 'ערך',
    about: 'מטבעות הליש״ט העשרוניים לפי שנה, כל עיצובי 50 הפני, סדרת A–Z, הלירה העגולה ובת 12 הצלעות ומטבעות 2 לירות להנצחה.' },
  us: { src: 'catalogs/us.json', name: 'ארצות הברית', sub: '1793–היום, מחצי סנט ועד דולר', groupLabel: 'ערך',
    about: 'כל מטבעות המחזור של ארה״ב לפי סוג, שנה ומטבעה, כולל מדינות, פארקים, וריאנטים ושגיאות מפורסמים ומטבעות פרוף.' },
  ottoman: { src: 'catalogs/ottoman.json', name: 'האימפריה העות׳מאנית', sub: '1326–1923, מאקצ׳ה ועד 500 קורוש', groupLabel: 'ערך',
    about: 'מטבעות האימפריה העות׳מאנית מאורהאן ועד מהמט השישי, לכל תאריך ושנת מלכות, עם מטבעה, מתכת ו-Key Dates. אפשר לסדר לפי סולטן.' },
  egypt: { src: 'catalogs/egypt.json', name: 'מצרים', sub: '1517–היום, מהתקופה העות׳מאנית ועד הרפובליקה', groupLabel: 'ערך',
    about: 'מטבעות מצרים: התקופה העות׳מאנית, הסולטנות, הממלכה והרפובליקה, כולל מטבעות ההנצחה למחזור. אפשר לסדר לפי שליט.' },
  euro: { src: 'catalogs/euro.json', name: 'יורו', sub: '1999–היום, כל מדינות גוש האירו', groupLabel: 'ערך',
    about: 'כל מטבעות האירו של 25 המדינות לפי ערך ושנה, סימני המטבעה של גרמניה וכל מטבעות ההנצחה של 2 יורו.' },
  newshekel: { src: 'catalogs/new-shekel.json', name: 'השקל החדש', sub: '1985–היום, התשמ״ה–', groupLabel: 'ערך',
    about: 'כל מטבעות המחזור של השקל החדש לפי שנה, מטבעות החנוכה והזיכרון, וריאנטים, טעויות יישור ו-Key Dates.' },
};
for (const [key, f] of Object.entries(CATALOG_FILES)) CATALOGS[key] = Object.assign({ list: null, groups: [], theme: 'file', groupLabel: 'קבוצה' }, f);

// Reference pictures (catalogs/images/<key>.json, made by tools/add_images.py): one free picture per coin type.
async function attachImages(key, list) {
  try {
    const res = await fetch('catalogs/images/' + key + '.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const map = await res.json();
    for (const it of list) { const img = map[it.country + '§' + (it.typeKey || it.group)] || map[it.typeKey] || map[it.group]; if (img) it.img = img; }
  } catch (e) { /* pictures are optional */ }
}

async function loadCatalogFile(key) {
  const cat = CATALOGS[key];
  if (!cat || !cat.src || cat.list) return cat;
  const res = await fetch(cat.src, { cache: 'no-cache' });
  if (!res.ok) throw new Error('catalog ' + key + ' ' + res.status);
  const data = await res.json();

  // Large catalogs (Euro / US and future world catalogs) are split into shards.
  // The manifest keeps the album metadata while each shard carries only its own items.
  let rawItems = data.items || [];
  if (Array.isArray(data.shards) && data.shards.length) {
    const chunks = await Promise.all(data.shards.map(async src => {
      const r = await fetch(src, { cache: 'no-cache' });
      if (!r.ok) throw new Error('catalog shard ' + src + ' ' + r.status);
      const j = await r.json();
      return Array.isArray(j) ? j : (j.items || []);
    }));
    rawItems = chunks.flat();
  }

  Object.assign(cat, { name: data.name || cat.name, sub: data.sub || cat.sub, about: data.about || cat.about,
    theme: data.theme || cat.theme, groupLabel: data.groupLabel || cat.groupLabel, groups: data.groups || [],
    countries: data.countries || [], countryLabel: data.countryLabel || '', countriesLabel: data.countriesLabel || '', sourceAttribution: data.sourceAttribution || '', catalogVersion: data.catalogVersion || '',
    defaultSort: data.defaultSort || null });
  // Big catalogs keep the physical specs once per group (e.g. every 2 euro coin) instead of on every item.
  const specs = data.groupSpecs || {};
  if (Object.keys(specs).length) rawItems = rawItems.map(it => Object.assign({}, specs[it.group] || {}, it));
  // missing measurements stay missing (Number(null) would show as 0)
  const num = v => v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
  cat.list = rawItems.map(it => ({
    id: key + '-' + it.id, series: key, group: it.group, country: it.country || '', denomination: it.denomination || '',
    y: it.y, tag: it.tag || '', rare: it.rare || '', variant: !!it.variant,
    mint: it.mint || '', mintMark: it.mintMark || '', mintVariant: !!it.mintVariant, typeKey: it.typeKey || '',
    error: !!it.error, errorName: it.errorName || '', errorCategory: it.errorCategory || '', proof: !!it.proof,
    rarityTier: it.rarityTier || '', rarityReason: it.rarityReason || '',
    metal: it.metal || 'silver', metalName: it.metalName || METAL_NAME[it.metal] || '', composition: it.composition || '',
    weight: num(it.weight),
    diam: Number(it.diam) || 25, thickness: num(it.thickness),
    mintage: it.mintage == null ? null : Number(it.mintage), mintageText: it.mintageText || '',
    mintageCirculated: it.mintageCirculated == null ? null : Number(it.mintageCirculated),
    mintageBU: it.mintageBU == null ? null : Number(it.mintageBU),
    mintageProof: it.mintageProof == null ? null : Number(it.mintageProof),
    catalog: it.catalog || '', edge: it.edge || '', orientation: it.orientation || '', holed: !!it.holed,
    commemorative: !!it.commemorative, designId: it.designId || '', issueDate: it.issueDate || '',
    title: it.label, sub: cat.name + (it.variant ? ' · וריאנט' : ''), design: it.note || '',
  }));
  markSeriesKeys(cat.list);
  await attachImages(key, cat.list);
  for (const it of cat.list) it.rare = it.rarityTier ? it.rarityReason.replace(/^[^(]*\(|\)\.$/g, '') : '';
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
