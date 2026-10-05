# Builds the UK pre-decimal coins catalog (catalogs/uk-predecimal.json) from the English Wikipedia coin articles:
# farthing, halfpenny, penny, sixpence, shilling, florin and half crown, per year (the crown has its own album).
# Mintage lists ("* 1838 - 1,607,760") and tables are read as published; the monarch and the metal follow the year.
import io, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from fetch_euro import wikitext
from wikitable import tables, clean

OUT = os.path.join(HERE, '..', 'catalogs', 'uk-predecimal.json')
GROUPS = [('f4', 'פרת׳ינג (¼ פני)'), ('hp', 'חצי פני'), ('p1', 'פני'), ('p3', '3 פני'), ('p6', '6 פני (סיקספנס)'),
          ('s1', 'שילינג'), ('fl', 'פלורין (2 שילינג)'), ('hc', 'חצי קראון')]

def monarch(y):
    if y <= 1820: return 'ג׳ורג׳ השלישי'
    if y <= 1830: return 'ג׳ורג׳ הרביעי'
    if y <= 1837: return 'ויליאם הרביעי'
    if y <= 1901: return 'ויקטוריה'
    if y <= 1910: return 'אדוארד השביעי'
    if y <= 1936: return 'ג׳ורג׳ החמישי'
    if y <= 1952: return 'ג׳ורג׳ השישי'
    return 'אליזבת השנייה'

def silver_metal(y):
    if y <= 1919: return ('silver', 'כסף סטרלינג', '92.5% כסף')
    if y <= 1946: return ('silver', 'כסף 500', '50% כסף')
    return ('cuni', 'קופרו-ניקל', '75% נחושת, 25% ניקל')

def copper_metal(y):
    if y < 1860: return ('copper', 'נחושת', 'נחושת')
    return ('copper', 'ברונזה', '95%–97% נחושת, בדיל ואבץ')

SPECS = {  # diameter mm, weight g
    'f4': (20.0, 2.83), 'hp': (25.5, 5.67), 'p1': (31.0, 9.45), 'p6': (19.4, 2.83), 's1': (23.6, 5.65), 'fl': (28.5, 11.31), 'hc': (32.3, 14.14),
}
items, seen = [], set()

def add(g, y, n, raw, note='', variant_tag=''):
    metal = copper_metal(y) if g in ('f4', 'hp', 'p1') else silver_metal(y)
    d, w = SPECS[g]
    if g == 'p1' and y < 1860: d, w = 34.0, 18.8
    if g == 'hp' and y < 1860: d, w = 28.0, 9.4
    if g == 'f4' and y < 1860: d, w = 22.0, 4.7
    if g == 'fl' and y <= 1886: d = 30.0
    label = '%s %d%s' % (dict(GROUPS)[g].split(' (')[0], y, (' — ' + variant_tag) if variant_tag else '')
    id_ = 'gb-%s-%d%s' % (g, y, ('-' + re.sub(r'[^a-z0-9]+', '-', variant_tag.lower()).strip('-')) if variant_tag else '')
    while id_ in seen: id_ += 'x'
    seen.add(id_)
    raw = clean(raw)
    proof = bool(re.search(r'proof', raw + ' ' + note, re.I)) and not n or bool(re.search(r'proof only|\(proof\)', raw, re.I))
    notcirc = bool(re.search(r'not circulated|proof only|sets? only', raw + ' ' + note, re.I))
    tier = reason = ''
    if n and not proof and not notcirc:
        if n <= 100000: tier, reason = 'key', 'Key: %s מטבעות בלבד.' % '{:,}'.format(n)
        elif n <= 500000: tier, reason = 'semi-key', 'Semi-Key: %s מטבעות בלבד.' % '{:,}'.format(n)
    elif notcirc and not proof:
        tier, reason = 'key', 'Key: לא הונפק למחזור; ידועים עותקים בודדים.'
    items.append(dict(id=id_, group=g, y=y, label=label, metal=metal[0], metalName=metal[1], composition=metal[2], diam=d, weight=w,
                      mintage=n, mintageText='' if n else raw[:80], proof=proof, variant=bool(variant_tag) and not proof,
                      tag=variant_tag, rarityTier=tier, rarityReason=reason, rare=reason.split(': ', 1)[-1] if tier else '',
                      note=('הערת המקור: ' + note + '. ' if note else '') + 'מלך/מלכה: ' + monarch(y) + '.', orientation='יישור מדליה ↑↑'))

def number(s):
    m = re.search(r'(\d[\d,]*)', s or '')
    return int(m.group(1).replace(',', '')) if m else None

# mintage lists: "* 1838 - 1,607,760", "*1838{{dash}}1,956,240", "* 1895 ~ 2,852,852 (note)"
LIST = re.compile(r'^\*\s*(1[789]\d\d)\s*(?:\{\{(?:dash|ndash|snd)\}\}|[-–~—:])\s*([^\n]*)$', re.M)
for page, g in (('Farthing (British coin)', 'f4'), ('Halfpenny (British pre-decimal coin)', 'hp'), ('Sixpence (British coin)', 'p6'),
                ('Shilling (British coin)', 's1'), ('Florin (British coin)', 'fl')):
    w = wikitext(page)
    i = w.find('Mintages'); seg = w[i:] if i >= 0 else w
    # cells of tables holding lists are flattened as "* 1895 ~ 2,852,852 * 1896 ~ ..." -> one entry per line
    seg = re.sub(r'\s\*\s*(?=1[789]\d\d)', '\n* ', seg)
    years = {}
    crest = ''
    for line in seg.split('\n'):
        if re.match(r"^\s*'''[^']+'''\s*$", line) or line.startswith('='): crest = ''
        if not line.startswith('*'):
            if re.search(r'english', line, re.I) and g == 's1': crest = 'אנגלי'
            elif re.search(r'scottish', line, re.I) and g == 's1': crest = 'סקוטי'
            continue
        m = LIST.match(line)
        if not m: continue
        y, rest = int(m.group(1)), clean(m.group(2))
        main, _, proofpart = rest.partition(';')
        n = number(main)
        note = ''
        nm = re.search(r'\(([^)]*)\)', main)
        if nm: note = nm.group(1).strip()
        tag = crest if g == 's1' and 1937 <= y <= 1966 else ''
        key = (y, tag)
        if key in years: continue
        years[key] = True
        add(g, y, n, main, note=note, variant_tag=tag)
        pn = number(proofpart) if re.search(r'proof', proofpart, re.I) else None
        if pn:
            add(g, y, pn, proofpart, variant_tag=(tag + ' ' if tag else '') + 'Proof')
            items[-1]['proof'] = True; items[-1]['variant'] = False
# penny: Year | Mintage tables (one per reign)
for cap, head, rows in tables(wikitext('Penny (British pre-decimal coin)')):
    if [x.lower() for x in head] != ['year', 'mintage']: continue
    for r in rows:
        m = re.match(r'^(\d{4})\s*(H|KN)?(.*)$', r[0].strip())
        if not m: continue
        y, mintmark, extra = int(m.group(1)), m.group(2) or '', m.group(3).strip()
        raw = r[1] if len(r) > 1 else ''
        tag = mintmark
        if y == 1860 and not mintmark:
            tag = 'נחושת' if not any(i['id'].startswith('gb-p1-1860') for i in items) else 'ברונזה'
        add('p1', y, number(raw) if not re.search(r'not circulated', raw, re.I) else None, raw + (' ' + extra if extra else ''), variant_tag=tag)
        if mintmark:
            items[-1].update(mint={'H': 'Heaton, בירמינגהם', 'KN': 'Kings Norton'}[mintmark], mintMark=mintmark, mintVariant=True, variant=False,
                             note=items[-1]['note'] + ' הוטבע במטבעה פרטית; סימן המטבעה ' + mintmark + ' ליד התאריך.')
        if y == 1860 and tag == 'נחושת':
            items[-1].update(metal='copper', metalName='נחושת', composition='נחושת', diam=34.0, weight=18.8)
# half crown: Monarch | Obverse | Year | General | Proof
for cap, head, rows in tables(wikitext('Half crown (British coin)')):
    if 'Half-crown mintages' not in cap: continue
    for r in rows:
        if len(r) < 4 or not re.match(r'^\d{4}', r[2]): continue
        y = int(r[2][:4])
        add('hc', y, number(r[3]), r[3], note=('ראש ' + r[1]) if r[1] else '')
        if len(r) > 4 and number(r[4]):
            add('hc', y, number(r[4]), r[4] + ' (proof)', variant_tag='Proof')
            items[-1]['proof'] = True; items[-1]['variant'] = False

items = [i for i in items if not (not i.get('mintage') and str(i.get('mintageText', '')).strip() in ('0', ''))
         or i.get('proof') or i['group'] in ('p1',)]
items.sort(key=lambda i: ([g for g, _ in GROUPS].index(i['group']), i['y'], i['id']))
for it in items:
    for k in [k for k, v in it.items() if v in ('', None, False) and k not in ('id', 'group', 'y', 'label')]: del it[k]
data = {
    'name': 'בריטניה — לפני המעבר לעשרוני', 'sub': '1797–1970, פרת׳ינג עד חצי קראון',
    'about': 'מטבעות הליש״ט שלפני 1971 לפי ערך ושנה: פרת׳ינג, חצי פני, פני, 6 פני, שילינג (כולל אנגלי וסקוטי), פלורין וחצי קראון, '
             'עם המלך או המלכה והמתכת של כל שנה. הקראון נמצא באלבום נפרד.',
    'theme': 'file', 'groupLabel': 'ערך', 'groups': [{'key': g, 'name': n} for g, n in GROUPS if g != 'p3'],
    'sources': ['Wikipedia (en) — British pre-decimal coin articles (mintage lists and tables)'],
    'catalogVersion': '2026-10-05-1', 'items': items,
}
with io.open(OUT, 'w', encoding='utf8') as f:
    json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
import collections
print('uk-predecimal:', len(items), dict(collections.Counter(i['group'] for i in items)), 'key', sum(i.get('rarityTier') == 'key' for i in items))
