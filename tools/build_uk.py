# Builds the UK decimal coins catalog (catalogs/uk-decimal.json) from the English Wikipedia coin articles:
# ½p, 1p, 2p, 5p, 10p (incl. the 2018-19 A-Z series), 20p, 50p (every design per year, 2011 Olympic sports),
# £1 (round pound designs and the 12-sided pound) and £2 (standard and commemorative designs).
import io, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from fetch_euro import wikitext
from wikitable import tables, clean

OUT = os.path.join(HERE, '..', 'catalogs', 'uk-decimal.json')

GROUPS = [('hp', '½ פני'), ('p1', '1 פני'), ('p2', '2 פני'), ('p5', '5 פני'), ('p10', '10 פני'), ('p20', '20 פני'),
          ('p50', '50 פני'), ('l1', 'לירה (פאונד)'), ('l2', '2 לירות')]
BRONZE = ('copper', 'ברונזה', '97% נחושת, 2.5% אבץ, 0.5% בדיל')
CU_STEEL = ('copper', 'פלדה מצופה נחושת', 'פלדה בציפוי נחושת')
CUNI = ('cuni', 'קופרו-ניקל', '75% נחושת, 25% ניקל')
NI_STEEL = ('cuni', 'פלדה מצופה ניקל', 'פלדה בציפוי ניקל')
NI_BRASS = ('ngold', 'ניקל-פליז', '70% נחושת, 24.5% אבץ, 5.5% ניקל')
BIMET = ('bimetal', 'דו-מתכתי', 'ליבה קופרו-ניקל, טבעת ניקל-פליז')

def monarch(y): return 'המלכה אליזבת השנייה' if y < 2023 else 'המלך צ׳ארלס השלישי'

def rawclean(s):
    return re.sub(r'data-sort-value="[^"]*"\s*\|\s*', '', clean(s or ''))

def num(s):
    s = rawclean(s)
    m = re.search(r'([\d][\d,]*)', s)
    return int(m.group(1).replace(',', '')) if m and not re.match(r'^0\b', s) else None

def setonly(s):
    return bool(re.search(r'proof|uncirculated|BU only|sets? only|not circulated', s, re.I))

items, seen = [], set()

PORTRAIT_HE = {'machin': 'דיוקן מכין', 'maklouf': 'דיוקן מקלוף', 'rank-broadley': 'דיוקן רנק-ברודלי', 'clark': 'דיוקן קלארק', 'jennings': 'דיוקן ג׳נינגס'}

def add(group, y, label, mintage, raw, metal, diam, weight, note='', tag='', proof=False, commemorative=False, design='', portrait='', source=''):
    raw = rawclean(raw)
    if re.fullmatch(r'0', raw.strip()):
        if group == 'p50' and y == 1968: return          # no 1968 50p: the coin was introduced in 1969
        raw = 'הוטבע לסטים בלבד (0 למחזור)'
    id_ = 'uk-%s-%d%s' % (group, y, ('-' + re.sub(r'[^a-z0-9]+', '-', design.lower()).strip('-')[:24]) if design else '')
    while id_ in seen: id_ += 'x'
    seen.add(id_)
    tier, reason = '', ''
    so = setonly(raw) or 'לסטים בלבד' in raw
    if mintage and not proof and not so:
        if mintage <= 100000: tier, reason = 'key', 'Key: %s מטבעות בלבד.' % '{:,}'.format(mintage)
        elif mintage <= 500000: tier, reason = 'semi-key', 'Semi-Key: %s מטבעות בלבד.' % '{:,}'.format(mintage)
    elif so and not proof:
        tier, reason = 'key', 'Key: לא הונפק למחזור; ' + ('הוטבע לסטים בלבד.' if not mintage else '%s מטבעות בסטים בלבד.' % '{:,}'.format(mintage))
    it = dict(id=id_, group=group, y=y, label=label, metal=metal[0], metalName=metal[1], composition=metal[2], diam=diam, weight=weight,
              mintage=mintage if not so or mintage else None, mintageText='' if mintage and not so else clean(raw)[:80], tag=tag,
              proof=proof, commemorative=commemorative, rarityTier=tier, rarityReason=reason, rare=reason.split(': ', 1)[-1] if tier else '',
              note=(note + ' ' if note else '') + 'דיוקן: ' + monarch(y) + '.', orientation='יישור מדליה ↑↑',
              _portrait=PORTRAIT_HE.get(portrait.lower().strip(), portrait), _reverse=design, _source=source)
    items.append(it)

def year_of(s):
    m = re.match(r'\s*(\d{4})', s or '')
    return int(m.group(1)) if m else None

# ½p, 1p, 2p, 5p, 10p, 20p: Year | Number minted | (Composition) | (Diameter) | ...
SIMPLE = [('Half penny (British decimal coin)', 'hp', '½ פני'), ('Penny (British decimal coin)', 'p1', '1 פני'),
          ('Two pence (British coin)', 'p2', '2 פני'), ('Five pence (British coin)', 'p5', '5 פני'),
          ('Ten pence (British coin)', 'p10', '10 פני'), ('Twenty pence (British coin)', 'p20', '20 פני')]
DIAM = {'hp': 17.14, 'p1': 20.32, 'p2': 25.91, 'p20': 21.4}
WEIGHT = {'hp': 1.78, 'p1': 3.56, 'p2': 7.12, 'p20': 5.0}
for page, g, he in SIMPLE:
    for cap, head, rows in tables(wikitext(page)):
        h = [x.lower() for x in head]
        if not h or h[0] != 'year' or len(h) < 2 or 'number minted' not in h[1]: continue
        ic = h.index('composition') if 'composition' in h else None
        idm = next((k for k, x in enumerate(h) if x.startswith('diameter')), None)
        ip = h.index('portrait') if 'portrait' in h else None
        ir = h.index('reverse') if 'reverse' in h else None
        for r in rows:
            y = year_of(r[0])
            if not y or len(r) < 2: continue
            raw = r[1]
            n = num(raw)
            comp = (r[ic] if ic is not None and ic < len(r) else '').lower()
            if g in ('p1', 'p2'):
                metal = CU_STEEL if (y >= 1992 and 'bronze' not in comp) else BRONZE
            elif g == 'hp':
                metal = BRONZE
            else:
                metal = NI_STEEL if 'steel' in comp or (g in ('p5', 'p10') and y >= 2012 and 'cupro' not in comp) else CUNI
            diam = None
            if idm is not None and idm < len(r):
                try: diam = float(r[idm])
                except ValueError: diam = None
            diam = diam or DIAM.get(g) or {'p5': 18.0 if y >= 1990 else 23.59, 'p10': 24.5 if y >= 1992 else 28.5}[g]
            weight = WEIGHT.get(g) or {'p5': 3.25 if y >= 1990 else 5.65, 'p10': 6.5 if y >= 1992 else 11.31}[g]
            reverse = r[ir] if ir is not None and ir < len(r) else ''
            note = ('גב: ' + reverse + '. ') if reverse else ''
            if 'hazel dormouse' in raw.lower(): note += 'כולל עיצוב "מכרסם הלוז". '
            portrait = r[ip] if ip is not None and ip < len(r) else ''
            add(g, y, '%s %d' % (he, y), n, raw, metal, diam, weight, note=note.strip(), design=('' if not reverse or reverse in ('Ironside', 'Gardner', 'Britannia') else reverse),
                portrait=portrait, source=page + '#' + str(id(rows)))
# 10p A-Z (2018-19)
for cap, head, rows in tables(wikitext('Ten pence (British coin)')):
    if [x.lower() for x in head][:2] != ['year', 'letter']: continue
    for r in rows:
        y = year_of(r[0])
        if not y: continue
        add('p10', y, '10 פני %d — האות %s: %s' % (y, r[1], r[2]), num(r[3]), r[3], NI_STEEL, 24.5, 6.5,
            note='סדרת "אלף-בית של בריטניה" (A to Z).', tag=r[1], commemorative=True, design='az-' + r[1])
# 50p: every design per year (circulation), Olympic sports 2011, other commemoratives (BU / proof only)
w50 = wikitext('Fifty pence (British coin)')
done50 = set()
for cap, head, rows in tables(w50):
    h = [x.lower() for x in head]
    if h[:2] == ['year', 'number minted']:
        for r in rows:
            y = year_of(r[0])
            if not y: continue
            rev = rawclean(r[2]) if len(r) > 2 else ''
            try: diam = float(rawclean(r[4]))
            except (IndexError, ValueError): diam = 27.3 if y >= 1997 else 30.0
            std = rev.lower() in ('britannia', 'royal shield', 'royal arms', 'atlantic salmon', '')
            add('p50', y, '50 פני %d' % y + ('' if std else ' — ' + rev), num(r[1]), r[1], CUNI, diam, 8.0 if diam < 28 else 13.5,
                note=('גב: ' + rev + '.') if rev else '', commemorative=not std, design='' if std else rev,
                portrait=r[3] if len(r) > 3 else '', source='p50-circ')
            done50.add((y, rev.lower()))
    elif h[:2] == ['reverse', 'number minted']:
        for r in rows:
            add('p50', 2011, '50 פני 2011 — אולימפיאדת לונדון: ' + r[0], num(r[1]), r[1], CUNI, 27.3, 8.0,
                note='סדרת 29 ענפי הספורט של אולימפיאדת לונדון 2012.', tag='אולימפי', commemorative=True, design='olympic-' + r[0])
    elif h[:2] == ['year on coin', 'event']:
        for r in rows:
            y = year_of(r[0])
            if not y: continue
            ev = r[1]
            if any(ev.lower()[:20] in rev or rev[:20] in ev.lower() for (yy, rev) in done50 if yy == y and rev): continue
            n = num(r[4]) if len(r) > 4 else None
            raw = r[4] if len(r) > 4 else ''
            add('p50', y, '50 פני %d — %s' % (y, ev), n, raw, CUNI, 27.3 if y >= 1997 else 30.0, 8.0 if y >= 1997 else 13.5,
                note='עיצוב: ' + (r[2][:140] if len(r) > 2 else ''), commemorative=True, proof=setonly(raw) or n is None, design=ev, source='p50-event')
# £1
for cap, head, rows in tables(wikitext('One pound (British coin)')):
    h = [x.lower() for x in head]
    if h[:3] == ['year', 'name', 'design']:
        for r in rows:
            y = year_of(r[0])
            if not y: continue
            raw = r[6] if len(r) > 6 else ''
            add('l1', y, 'לירה %d — %s (%s)' % (y, r[1], r[3]), num(raw), raw, NI_BRASS, 22.5, 9.5,
                note='עיצוב: %s. כיתוב בשפה: %s.' % (r[2], r[4]), design=r[1])
    elif h[:2] == ['year', 'design']:
        for r in rows:
            y = year_of(r[0])
            if not y: continue
            raw = r[3] if len(r) > 3 else ''
            add('l1', y, 'לירה %d — %s (12 צלעות)' % (y, r[1]), num(raw), raw, BIMET, 23.43, 8.75,
                note='הלירה בת 12 הצלעות.', design='12-' + r[1])
# £2
for cap, head, rows in tables(wikitext('Two pounds (British coin)')):
    h = [x.lower() for x in head]
    if h[:2] != ['year', 'event']: continue
    uni = 'uni-metallic' in cap.lower()
    noncirc = 'non-circulating' in cap.lower()
    for r in rows:
        y = year_of(r[0])
        if not y: continue
        ev = r[1].lstrip('| ').strip()
        raw = (r[5] if len(r) > 5 else '').lstrip('| ')
        add('l2', y, '2 לירות %d — %s' % (y, ev), num(raw), raw, NI_BRASS if uni else BIMET, 28.4, 15.98 if uni else 12.0,
            note='כיתוב בשפה: %s.' % (r[3].lstrip('| ') if len(r) > 3 else ''), commemorative=True, proof=noncirc, design=ev)
# £2 standard bimetallic by year (list in a table cell)
w2 = wikitext('Two pounds (British coin)')
m = re.search(r'Bi-metallic coin – total(.*?)\|\}', w2, re.S)
if m:
    for y, n in re.findall(r'\*\s*(\d{4})\s*~\s*([\d,]+)', m.group(1)):
        add('l2', int(y), '2 לירות %s (עיצוב רגיל)' % y, int(n.replace(',', '')), n, BIMET, 28.4, 12.0,
            note='סך כל מטבעות 2 הלירות הדו-מתכתיים של השנה (כולל הנצחות).', design='standard')

# Same label twice: the 50p event table repeats coins already in the circulation table -> keep the circulation one;
# otherwise tell them apart by metal, portrait or reverse (e.g. 1992 bronze/steel, 2008 new reverse, 2015 new portrait).
by_label = {}
for it in items: by_label.setdefault(it['label'], []).append(it)
drop = set()
for label, group in by_label.items():
    if len(group) < 2: continue
    circ = [i for i in group if i['_source'] != 'p50-event']
    if circ and len(circ) < len(group):
        drop.update(i['id'] for i in group if i['_source'] == 'p50-event'); group = circ
        if len(group) < 2: continue
    for k, it in enumerate(group):
        if len({i['metalName'] for i in group}) > 1: extra = it['metalName']
        elif len({i['_portrait'] for i in group}) > 1 and it['_portrait']: extra = it['_portrait']
        elif len({i['_reverse'] for i in group}) > 1: extra = ('גב ' + it['_reverse']) if it['_reverse'] else 'גב קודם'
        elif len({i['diam'] for i in group}) > 1: extra = 'קוטר %s מ״מ' % it['diam']
        elif it['y'] == 2008 and len(group) == 2: extra = ('גב קודם', 'גב המגן (Dent)')[k]
        elif it['y'] == 2015 and len(group) == 2: extra = ('דיוקן רנק-ברודלי', 'דיוקן קלארק')[k]
        else: extra = 'עיצוב ' + str(k + 1)
        it['label'] += ' (' + extra + ')'
items = [i for i in items if i['id'] not in drop]
for it in items:
    for k in ('_portrait', '_reverse', '_source'): it.pop(k, None)
items.sort(key=lambda i: ([g for g, _ in GROUPS].index(i['group']), i['y'], i['id']))
for it in items:
    for k in [k for k, v in it.items() if v in ('', None, False) and k not in ('id', 'group', 'y', 'label')]: del it[k]
data = {
    'name': 'בריטניה — מטבעות עשרוניים', 'sub': '1968–היום, ½ פני עד 2 לירות',
    'about': 'מטבעות הליש״ט העשרוניים לפי ערך ושנה: ½ פני עד 2 לירות, כל עיצובי 50 הפני (כולל 29 ענפי אולימפיאדת לונדון), '
             'סדרת A–Z של 10 פני, עיצובי הלירה העגולה והלירה בת 12 הצלעות, ומטבעות 2 לירות להנצחה. שנות סטים בלבד מסומנות.',
    'theme': 'file', 'groupLabel': 'ערך', 'groups': [{'key': g, 'name': n} for g, n in GROUPS],
    'sources': ['Wikipedia (en) — British decimal coin articles (½p to £2), mintage figures from the Royal Mint'],
    'catalogVersion': '2026-10-05-1', 'items': items,
}
with io.open(OUT, 'w', encoding='utf8') as f:
    json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
import collections
print('uk-decimal:', len(items), dict(collections.Counter(i['group'] for i in items)), 'key', sum(i.get('rarityTier') == 'key' for i in items),
      'proof', sum(bool(i.get('proof')) for i in items), 'comm', sum(bool(i.get('commemorative')) for i in items))
