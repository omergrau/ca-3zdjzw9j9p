# Builds the Ottoman Empire catalog (catalogs/ottoman.json) from tools/data/ottoman_numista.json:
# Numista type pages (standard circulation, circulating commemorative and non-circulating types; patterns,
# counterfeits and local countermarks left out), one album slot per date row.
# Groups are denominations ordered by value; the "countries" axis is the sultan, so the album can be split by reign.
import collections, io, json, os, re, statistics

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'data', 'ottoman_numista.json')
OUT = os.path.join(HERE, '..', 'catalogs', 'ottoman.json')

SULTANS = [  # Numista name prefix -> key, Hebrew name
    ('Osman I ', 'osman1', 'עוסמאן הראשון'), ('Orhan', 'orhan', 'אורהאן'), ('Murad I ', 'murad1', 'מוראד הראשון'),
    ('Bayezid I ', 'bayezid1', 'באיזיד הראשון'), ('Mehmed I ', 'mehmed1', 'מהמט הראשון'), ('Murad II ', 'murad2', 'מוראד השני'),
    ('Mehmed II ', 'mehmed2', 'מהמט השני (הכובש)'), ('Bayezid II', 'bayezid2', 'באיזיד השני'), ('Selim I ', 'selim1', 'סלים הראשון'),
    ('Suleiman I ', 'suleiman1', 'סולימאן הראשון (המפואר)'), ('Selim II ', 'selim2', 'סלים השני'), ('Murad III', 'murad3', 'מוראד השלישי'),
    ('Mehmed III', 'mehmed3', 'מהמט השלישי'), ('Ahmed I ', 'ahmed1', 'אחמד הראשון'), ('Mustafa I ', 'mustafa1', 'מוסטפא הראשון'),
    ('Osman II ', 'osman2', 'עוסמאן השני'), ('Murad IV', 'murad4', 'מוראד הרביעי'), ('Ibrahim', 'ibrahim', 'איברהים'),
    ('Mehmed IV', 'mehmed4', 'מהמט הרביעי'), ('Suleiman II', 'suleiman2', 'סולימאן השני'), ('Ahmed II ', 'ahmed2', 'אחמד השני'),
    ('Mustafa II ', 'mustafa2', 'מוסטפא השני'), ('Ahmed III', 'ahmed3', 'אחמד השלישי'), ('Mahmud I ', 'mahmud1', 'מחמוד הראשון'),
    ('Osman III', 'osman3', 'עוסמאן השלישי'), ('Mustafa III', 'mustafa3', 'מוסטפא השלישי'), ('Abdul Hamid I ', 'abdulhamid1', 'עבדול חמיד הראשון'),
    ('Selim III', 'selim3', 'סלים השלישי'), ('Mustafa IV', 'mustafa4', 'מוסטפא הרביעי'), ('Mahmud II ', 'mahmud2', 'מחמוד השני'),
    ('Abdulmejid', 'abdulmejid', 'עבדול מג׳יד הראשון'), ('Abdülaziz', 'abdulaziz', 'עבדול עזיז'), ('Murad V', 'murad5', 'מוראד החמישי'),
    ('Abdul Hamid II', 'abdulhamid2', 'עבדול חמיד השני'), ('Mehmed V ', 'mehmed5', 'מהמט החמישי (רשאד)'),
    ('Mehmed VI', 'mehmed6', 'מהמט השישי (וחיד א-דין)'),
]
# Types without a "Sultan" field: named in the title (interregnum princes, pretenders) or anonymous
TITLE_RULER = [('Musa', 'interregnum', 'תקופת המעבר (1402–1413)'), ('Suleiman Çelebi', 'interregnum', 'תקופת המעבר (1402–1413)'),
               ('Mehmed Çelebi', 'interregnum', 'תקופת המעבר (1402–1413)'), ('Mehmed Celebi', 'interregnum', 'תקופת המעבר (1402–1413)'),
               ('Mustafa Çelebi', 'interregnum', 'תקופת המעבר (1402–1413)'), ('Cem Sultan', 'bayezid2', 'באיזיד השני')]
ANON = ('anon', 'אנונימי / לא מזוהה')

UNITS = [  # (regex on the value name, Hebrew, value in akçe when Numista gives no ratio)
    (r'Mangir|Manghir|Mangır', 'מנגיר', 0.125), (r'Akce|Akçe', 'אקצ׳ה', 1), (r'Maydin', 'מיידין', 1), (r'Fals|Falus', 'פלס', 0.1),
    (r'Para', 'פארה', 3), (r'Kuru[sşș]h?|Kurush|Piastre', 'קורוש', 120), (r'Zolota', 'זולוטה', 90), (r'Dirha?m|Dirhem', 'דירהם', 5),
    (r'Zeri Mahbub|Zer-i Mahbub', 'זרי מחבוב', 420), (r'Findik', 'פינדיק', 600), (r'Sultani', 'סולטאני', 60), (r'Medini', 'מדיני', 3),
    (r'Beshlik|Beşlik|Beshliq', 'בשליק', 15), (r'Onluk', 'אונלוק', 10), (r'Ikilik', 'איקיליק', 2), (r'Abbasi', 'עבאסי', 4),
    (r'Eshrefi', 'אשרפי', 600), (r'Hayriye', 'חיריה', 2880), (r'Cedid Mahmudiye', 'ג׳דיד מחמודיה', 2400),
    (r'Rumi Tek Alt[ıi]n', 'רומי טק אלטין', 3360), (r'Rumi Alt[ıi]n', 'רומי אלטין', 4320), (r'Adli Alt[ıi]n', 'עדלי אלטין', 2160),
    (r'Memduhiye', 'ממדוחיה אלטין', 2400), (r'New (?:Adli )?Alt[ıi]n', 'אלטין חדש', 960), (r'Tam Surre', 'תם סורה', 2400),
    (r'Cedid Zincirli', 'ג׳דיד זינג׳ירלי', 600), (r'Atik Cifte Rumi', 'עתיק צ׳יפטה רומי', 4320), (r'Alt[ıu]n', 'אלטון', 600),
]
CURRENCY_AKCE = {'Akçe': 1, 'Kuruş': 120, 'Lira': 12000}
MINTS = {'Constantinople': 'קונסטנטינופול', 'Kostantiniyye': 'קונסטנטינופול', 'Kostantiniye': 'קונסטנטינופול', 'Islambol': 'איסלמבול',
         'İslambol': 'איסלמבול', 'Istanbul': 'קונסטנטינופול', 'Edirne': 'אדירנה', 'Bursa': 'בורסה', 'Manastir': 'מנסטיר (ביטולה)',
         'Selanik': 'סלוניקי', 'Kosova': 'קוסובו', 'Kosovo': 'קוסובו', 'Misir': 'מצרים (קהיר)', 'Cairo': 'קהיר', 'Aleppo': 'חלב',
         'Dimashq': 'דמשק', 'Baghdad': 'בגדד', 'Amasya': 'אמאסיה', 'Tire': 'טירה', 'Ayasluk': 'איאסולוק', 'Ayasuluk': 'איאסולוק',
         'Novaberda': 'נובו ברדו', 'Kratova': 'קרטובו', 'Canca': 'ג׳אנג׳ה', 'Amid': 'אמיד (דיארבקיר)', 'Revan': 'ירוואן', 'Bitlis': 'ביטליס',
         'Mardin': 'מרדין', 'Van': 'ואן', 'Saray': 'סראי', 'Antaliya': 'אנטליה'}
FRAC = {'½': .5, '¼': .25, '¾': .75, '⅛': .125, '⅜': .375, '⅞': .875}
AR_DIGITS = str.maketrans('٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789')
FIX_SULTAN = {'Abdul Hamid I (1774': 'Abdul Hamid I ', 'Mahmud I (1730': 'Mahmud I ', 'Ahmed I (1603': 'Ahmed I ', 'Osman II (1618': 'Osman II ',
              'Selim I (1512': 'Selim I ', 'Murad I Hüd': 'Murad I ', 'Mehmed I Kir': 'Mehmed I ', 'Selim II (1566': 'Selim II ',
              'Ahmed II (1691': 'Ahmed II ', 'Mustafa I (1617': 'Mustafa I ', 'Mustafa II (1695': 'Mustafa II ', 'Murad II (1421': 'Murad II ',
              'Bayezid I (1389': 'Bayezid I ', 'Mehmed II (1444': 'Mehmed II ', 'Suleiman I (1520': 'Suleiman I ', 'Mahmud II (1808': 'Mahmud II '}

def ruler(x):
    s = x['f'].get('Sultan') or ''
    for k, v in FIX_SULTAN.items():
        if s.startswith(k): s = v
    for pre, key, he in SULTANS:
        if (s + ' ').startswith(pre): return key, he
    for word, key, he in TITLE_RULER:
        if word in x['t']: return key, he
    return ANON

def fnum(s):
    s = s.strip().replace('⁄', '/')
    m = re.fullmatch(r'(\d+)?([½¼¾⅛⅜⅞])', s)
    if m: return (int(m.group(1)) if m.group(1) else 0) + FRAC[m.group(2)]
    m = re.fullmatch(r'(\d+)/(\d+)', s)
    if m: return int(m.group(1)) / int(m.group(2))
    try: return float(s)
    except ValueError: return None

def denomination(x):
    v = x['f'].get('Value') or x['t'].split(' - ')[0]
    cur = next((a for k, a in CURRENCY_AKCE.items() if (x['f'].get('Currency') or '').startswith(k)), 120)
    m = re.match(r'^(.*?)\s*\(([^)]*)\)\s*$', v)
    name, ratio = (m.group(1), fnum(m.group(2))) if m else (v, None)
    name = name.split(' = ')[0].strip()
    qm = re.match(r'^([\d½¼¾⅛⅜⅞/⁄]+)\s+(.*)$', name)
    qty = fnum(qm.group(1)) if qm else 1
    unit = qm.group(2) if qm else name
    he, per = next(((h, p) for r, h, p in UNITS if re.search(r, unit)), (unit, None))
    akce = ratio * cur if ratio is not None else (qty or 1) * (per or 1)
    qtxt = (qm.group(1).replace('1⁄2', '½').replace('⁄', '/') if qm else '1')
    label = he if qtxt == '1' else qtxt + ' ' + he
    return label, akce

def metal(comp):
    c = (comp or '').lower()
    if c.startswith('gold'): return 'gold', 'זהב'
    if c.startswith('billon'): return 'silver', 'בילון'
    if c.startswith('silver'): return 'silver', 'כסף'
    if c.startswith('copper-nickel'): return 'cuni', 'קופרו-ניקל'
    if c.startswith('nickel'): return 'cuni', 'ניקל'
    if c.startswith('bronze'): return 'bronze', 'ברונזה'
    return 'copper', 'נחושת'

def mm(s):
    m = re.search(r'([\d.]+)', s or '')
    return float(m.group(1)) if m else None

def number(s):
    d = re.sub(r'\D', '', s or '')
    return int(d) if d else None

def prices(row):
    return [fnum(p) if p else None for p in (row[3] if len(row) > 3 else '').split('/')]

data = json.load(io.open(SRC, encoding='utf8'))
groups, rulers, items, ids = {}, {}, [], set()
for x in data:
    f = x['f']
    den, akce = denomination(x)
    gkey = re.sub(r'[^0-9a-z]+', '-', (f.get('Value') or x['t']).split(' (')[0].split(' = ')[0].lower()).strip('-') or 'x'
    g = groups.setdefault(den, {'key': gkey, 'name': den, 'akce': []}); g['akce'].append(akce); gkey = g['key']
    rkey, rhe = ruler(x)
    span = re.search(r'\((\d{3,4})', f.get('Sultan') or '')
    rulers.setdefault(rkey, {'key': rkey, 'name': rhe, 'start': int(span.group(1)) if span else 9999})
    if rkey == 'interregnum': rulers[rkey]['start'] = 1402
    met, metname = metal(f.get('Composition'))
    extra = x['t'].split(' - ', 1)[1] if ' - ' in x['t'] else ''
    for pre, _, _ in SULTANS: extra = extra.replace(pre.strip(), '', 1) if extra.startswith(pre.strip()) else extra
    extra = re.sub(r'^(Reşâd|Reshat|Vahideddin|The Magnificent|Kirişçi)\s*', '', extra).strip(' ,;-')
    mint_he = next((h for k, h in MINTS.items() if k in (x.get('mint') or '') or k in extra), '')
    nonc = f.get('Type') == 'Non-circulating coins'
    comm = f.get('Type') == 'Circulating commemorative coins'
    rows = x['rows'] or [[f.get('Year') or '', '', '', '']]
    # rarity baseline: the median of each price column across the type's dates
    cols = list(zip(*[prices(r) for r in rows])) if len(rows) > 2 else []
    med = [statistics.median([v for v in c if v]) if sum(1 for v in c if v) >= 3 else None for c in cols]
    for ri, r in enumerate(rows):
        date = (r[0] or '').replace('\xa0', ' ').strip()
        dm = re.match(r'^(\d{3,4}|ND)\s*(?:\((\d{3,4})(?:-(\d{3,4}))?\))?\s*(\S+)?', date)
        hijri, greg, regnal = (dm.group(1), dm.group(2), (dm.group(4) or '').translate(AR_DIGITS)) if dm else ('', None, '')
        if not greg and hijri and hijri != 'ND': greg = str(round(int(hijri) * 0.97 + 622))
        y = int(greg) if greg else None
        if y is None:
            ys = re.search(r'\((\d{3,4})', f.get('Year') or '') or re.search(r'\((\d{3,4})', f.get('Sultan') or '')
            y = int(ys.group(1)) if ys else (rulers[rkey]['start'] if rulers[rkey]['start'] < 9999 else None)
        n = number(r[1]) if len(r) > 1 else None
        when = (hijri + ('/' + regnal if regnal and regnal.isdigit() else '') + (' (' + greg + ')' if greg else '')) if hijri else ''
        label = den + (' ' + when if when else '') + (' — ' + mint_he if mint_he and 'קונסטנטינופול' not in mint_he else '')
        comment = re.sub(r'[؀-ۿ\s()/\d-]+(?=$|\s)', ' ', r[2] if len(r) > 2 else '').strip()
        comment = re.sub(r'^\(?mintage in \d{4}\)?\s*', '', comment).strip()
        tier = reason = ''
        if n and not nonc:
            if n <= 25000: tier, reason = 'key', 'Key: %s מטבעות בלבד.' % '{:,}'.format(n)
            elif n <= 150000: tier, reason = 'semi-key', 'Semi-Key: %s מטבעות בלבד.' % '{:,}'.format(n)
        if not tier and med and not nonc:
            ratio = max([p / m for p, m in zip(prices(r), med) if p and m] or [0])
            if ratio >= 5: tier, reason = 'key', 'Key: מחירו גבוה פי %d ויותר מהשנים הרגילות של אותו סוג (Numista).' % int(ratio)
            elif ratio >= 2.5: tier, reason = 'semi-key', 'Semi-Key: מחירו גבוה פי %.1f מהשנים הרגילות של אותו סוג (Numista).' % ratio
        base = 'ot-%s-%s' % (x['id'], re.sub(r'[^0-9a-z]+', '-', (hijri + '-' + regnal + '-' + (greg or '')).lower()).strip('-') or str(ri))
        id_ = base
        while id_ in ids: id_ += 'x'
        ids.add(id_)
        note = ['סוג: ' + x['t'] + ' (Numista N#' + x['id'] + ').', 'סולטן: ' + rhe + '.']
        if mint_he: note.append('מטבעה: ' + mint_he + '.')
        if comment: note.append('הערת המקור: ' + comment + '.')
        if nonc: note.append('הוטבע שלא למחזור (מטבע זהב לוקס/הצגה).')
        it = dict(id=id_, group=gkey, country=rkey, y=y, label=label, metal=met, metalName=metname, composition=f.get('Composition', ''),
                  diam=mm(f.get('Diameter')) or 20, weight=mm(f.get('Weight')), thickness=mm(f.get('Thickness')), mintage=n,
                  catalog=f.get('References', ''), edge=(x.get('edge') or '').split(' ©')[0], mint=mint_he, proof=nonc, commemorative=comm,
                  rarityTier=tier, rarityReason=reason, rare=reason.split(': ', 1)[-1] if tier else '', note=' '.join(note),
                  tag='לא למחזור' if nonc else ('הנצחה' if comm else ''))
        items.append(it)

glist = sorted(groups.values(), key=lambda g: (statistics.median(g['akce']), g['name']))
# denominations sharing a key (spelling variants) collapse into the first group
seen, gout = {}, []
for g in glist:
    if g['key'] in seen: continue
    seen[g['key']] = True; gout.append({'key': g['key'], 'name': g['name']})
order = {g['key']: i for i, g in enumerate(gout)}
rout = sorted(rulers.values(), key=lambda r: (r['start'], r['name']))
items.sort(key=lambda i: (order[i['group']], i['y'] or 0, i['id']))
for it in items:
    for k in [k for k, v in it.items() if v in ('', None, False) and k not in ('id', 'group', 'y', 'label')]: del it[k]
out = {
    'name': 'האימפריה העות׳מאנית', 'sub': '1326–1923, מאקצ׳ה ועד 500 קורוש',
    'about': 'מטבעות האימפריה העות׳מאנית מאורהאן ועד מהמט השישי: אקצ׳ה, מנגיר, פארה, קורוש ומטבעות הזהב, לכל תאריך הג׳רי ושנת מלכות, '
             'עם המטבעה, המתכת, כמויות ההטבעה (כשידועות) ו-Key Dates. אפשר לסדר לפי סולטן.',
    'theme': 'file', 'groupLabel': 'ערך', 'groups': gout,
    'countries': [{'key': r['key'], 'name': r['name']} for r in rout],
    'countryLabel': '👑 לפי סולטן', 'countriesLabel': 'סולטנים',
    'sources': ['Numista — Ottoman Empire type pages'],
    'sourceAttribution': 'נתונים: Numista (en.numista.com)', 'catalogVersion': '2026-10-05-1', 'items': items,
}
with io.open(OUT, 'w', encoding='utf8') as fh:
    json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
print('ottoman:', len(items), 'items,', len(gout), 'groups,', len(rout), 'rulers; key', sum(i.get('rarityTier') == 'key' for i in items),
      'semi', sum(i.get('rarityTier') == 'semi-key' for i in items), 'proof', sum(bool(i.get('proof')) for i in items))
