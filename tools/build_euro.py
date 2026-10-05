# Builds the euro catalog (catalogs/euro.json + one shard per country in catalogs/euro/) from tools/data/euro_sources.json.
#   Regular coins: one item per country, value, year (and German mint mark A/D/F/G/J; the other four are mint varieties).
#   Mintages: euro-coins.info first, Wikipedia for years it lacks. Years struck only for sets are kept and marked.
#   2 euro commemoratives: every coin from Wikipedia's list (common issues included); German ones per mint.
import io, json, os, re, unicodedata
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'data', 'euro_sources.json')
OUTDIR = os.path.join(HERE, '..', 'catalogs')

COUNTRY_HE = {
    'at': 'אוסטריה', 'be': 'בלגיה', 'hr': 'קרואטיה', 'cy': 'קפריסין', 'nl': 'הולנד', 'ee': 'אסטוניה', 'fi': 'פינלנד',
    'fr': 'צרפת', 'de': 'גרמניה', 'gr': 'יוון', 'ie': 'אירלנד', 'it': 'איטליה', 'lv': 'לטביה', 'lt': 'ליטא', 'lu': 'לוקסמבורג',
    'mt': 'מלטה', 'pt': 'פורטוגל', 'sk': 'סלובקיה', 'si': 'סלובניה', 'es': 'ספרד', 'ad': 'אנדורה', 'mc': 'מונקו',
    'sm': 'סן מרינו', 'va': 'הוותיקן', 'bg': 'בולגריה',
}
# album order of the countries (alphabetical in Hebrew)
COUNTRY_ORDER = sorted(COUNTRY_HE, key=lambda c: COUNTRY_HE[c])

GROUPS = [('c1', '1 סנט', '1c'), ('c2', '2 סנט', '2c'), ('c5', '5 סנט', '5c'), ('c10', '10 סנט', '10c'), ('c20', '20 סנט', '20c'),
          ('c50', '50 סנט', '50c'), ('e1', '1 יורו', '1€'), ('e2', '2 יורו', '2€'), ('cc', '2 יורו הנצחה', None)]
DKEY = {d: g for g, _, d in GROUPS if d}
GNAME = {g: n for g, n, _ in GROUPS}

# Common specifications of every euro coin (identical in all countries).
SPECS = {
    'c1': dict(metal='copper', metalName='פלדה מצופה נחושת', composition='פלדה בציפוי נחושת', weight=2.30, diam=16.25, thickness=1.67, edge='חלקה'),
    'c2': dict(metal='copper', metalName='פלדה מצופה נחושת', composition='פלדה בציפוי נחושת', weight=3.06, diam=18.75, thickness=1.67, edge='חלקה עם חריץ'),
    'c5': dict(metal='copper', metalName='פלדה מצופה נחושת', composition='פלדה בציפוי נחושת', weight=3.92, diam=21.25, thickness=1.67, edge='חלקה'),
    'c10': dict(metal='ngold', metalName='זהב נורדי', composition='89% נחושת, 5% אלומיניום, 5% אבץ, 1% בדיל', weight=4.10, diam=19.75, thickness=1.93, edge='חריצים גסים'),
    'c20': dict(metal='ngold', metalName='זהב נורדי', composition='89% נחושת, 5% אלומיניום, 5% אבץ, 1% בדיל', weight=5.74, diam=22.25, thickness=2.14, edge='חלקה עם 7 שקעים ("פרח ספרדי")'),
    'c50': dict(metal='ngold', metalName='זהב נורדי', composition='89% נחושת, 5% אלומיניום, 5% אבץ, 1% בדיל', weight=7.80, diam=24.25, thickness=2.38, edge='חריצים גסים'),
    'e1': dict(metal='bimetal1', metalName='דו-מתכתי', composition='טבעת ניקל-פליז, ליבה קופרו-ניקל', weight=7.50, diam=23.25, thickness=2.33, edge='חריצים לסירוגין'),
    'e2': dict(metal='bimetal', metalName='דו-מתכתי', composition='טבעת קופרו-ניקל, ליבה ניקל-פליז', weight=8.50, diam=25.75, thickness=2.20, edge='חריצים דקים עם כיתוב'),
    'cc': dict(metal='bimetal', metalName='דו-מתכתי', composition='טבעת קופרו-ניקל, ליבה ניקל-פליז', weight=8.50, diam=25.75, thickness=2.20, edge='חריצים דקים עם כיתוב'),
}
for s in SPECS.values(): s['orientation'] = 'יישור מדליה ↑↑'

# Portrait / design periods of the national side (shown in the coin's details).
def design_note(cc, g, y):
    if cc == 'be':
        return 'המלך אלבר השני (עיצוב ראשון).' if y <= 2007 else 'המלך אלבר השני (עיצוב 2008).' if y == 2008 else 'המלך אלבר השני (עיצוב 2009).' if y <= 2013 else 'המלך פיליפ.'
    if cc == 'nl':
        return 'המלכה ביאטריקס.' if y <= 2013 else 'המלך וילם-אלכסנדר.'
    if cc == 'es' and g in ('e1', 'e2'):
        return 'המלך חואן קרלוס הראשון.' if y <= 2009 else 'המלך חואן קרלוס הראשון (דיוקן חדש).' if y <= 2014 else 'המלך פליפה השישי.'
    if cc == 'mc' and g in ('e1', 'e2'):
        return 'הנסיך ריינייה השלישי.' if y <= 2005 else 'הנסיך אלבר השני.'
    if cc == 'va':
        return 'האפיפיור יוחנן פאולוס השני.' if y <= 2005 else 'האפיפיור בנדיקטוס ה-16.' if y <= 2013 else 'האפיפיור פרנציסקוס.' if y <= 2016 else 'סמל האפיפיור פרנציסקוס.'
    return ''

MINT_HE = {'AT': 'וינה', 'BE': 'בריסל', 'NL': 'אוטרכט', 'HR': 'זאגרב', 'FI': 'ונטאה', 'GR': 'אתונה', 'FR': 'פסאק', 'IE': 'דבלין',
           'IT': 'רומא', 'LT': 'וילנה', 'PT': 'ליסבון', 'SK': 'קרמניצה', 'ES': 'מדריד', 'F': 'שטוטגרט'}
DE_MINTS = {'A': 'ברלין', 'D': 'מינכן', 'F': 'שטוטגרט', 'G': 'קרלסרוהה', 'J': 'המבורג'}

def slug(s, n=28):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')[:n].strip('-') or 'x'

def tier(n, setonly):
    if n is None:
        return ('key', 'Key: הוטבע לסטים בלבד בכמות קטנה.') if setonly else ('', '')
    txt = '{:,}'.format(n)
    if n <= 100000: return 'key', 'Key: ' + txt + ' מטבעות בלבד' + (' (לסטים).' if setonly else '.')
    if n <= 500000: return 'semi-key', 'Semi-Key: ' + txt + ' מטבעות בלבד.'
    return '', ''

def main():
    src = json.load(io.open(SRC, encoding='utf8'))
    he_path = os.path.join(HERE, 'data', 'euro_cc_he.json')
    HE = json.load(io.open(he_path, encoding='utf8')) if os.path.exists(he_path) else {}
    by_country = {c: [] for c in COUNTRY_HE}
    seen = set()

    def add(cc, it):
        assert it['id'] not in seen, it['id']
        seen.add(it['id']); it['country'] = cc; by_country[cc].append(it)

    for cc in COUNTRY_HE:
        eci = src['eci'].get(cc, [])
        eci_years = {r['year'] for r in eci}
        rows = []
        for r in eci:
            rows.append({'year': r['year'], 'mark': r['mint'] if cc == 'de' else '', 'mintc': r['mint'],
                         'vals': r['totals'], 'circ': r['circ'], 'proof': r['proof'], 'src': 'eci'})
        for r in src['wiki'].get(cc, []):
            if r['year'] in eci_years and not (cc == 'gr' and r['mark']):
                continue
            vals = r['vals']
            if all(v is None for v in vals.values()):   # a year listed before its mintages are published (e.g. Bulgaria 2026)
                vals = {d: 'tba' for d in vals}
            rows.append({'year': r['year'], 'mark': r['mark'], 'mintc': '', 'vals': vals, 'circ': {}, 'proof': {}, 'src': 'wiki'})
        rows.sort(key=lambda r: (r['year'], r['mark']))
        for r in rows:
            y, mark = r['year'], r['mark']
            for d, g in DKEY.items():
                v = r['vals'].get(d)
                if v is None: continue
                setonly = v == 's' or (r['src'] == 'eci' and not r['circ'].get(d) and isinstance(v, int) and v < 300000)
                n = None if v in ('s', 'tba') else v
                circ = r['circ'].get(d) or None
                proof = r['proof'].get(d) or None
                variant = mintv = False
                tag = ''
                if cc == 'de':
                    id_ = '%s-%s-%d-%s' % (cc, g, y, mark.lower())
                    mintv = mark != 'A'; tag = mark
                    mint = DE_MINTS.get(mark, ''); mm = mark
                elif cc == 'gr' and mark:
                    id_ = '%s-%s-%d-efs' % (cc, g, y); variant = True; tag = 'E/F/S'; mint = 'מדריד, פסאק או ונטאה'; mm = 'E / F / S'
                elif cc == 'va' and mark == 'SV':
                    id_ = '%s-%s-%d-sv' % (cc, g, y); variant = True; tag = 'כס פנוי'; mint = 'רומא'; mm = ''
                else:
                    id_ = '%s-%s-%d' % (cc, g, y); mint = MINT_HE.get(r['mintc'], ''); mm = ''
                t, reason = tier(n if not setonly else (n if n and n < 300000 else None), setonly)
                note = design_note(cc, g, y)
                if cc == 'gr' and mark: note = 'הוטבע בחו״ל ב-2002; אות המטבעה (E ספרד, F צרפת, S פינלנד) בתוך הכוכב התחתון.'
                if cc == 'va' and mark == 'SV': note = 'הנפקת "כס פנוי" (Sede Vacante) של 2005.'
                if setonly: note = (note + ' ' if note else '') + 'הוטבע לסטים בלבד.'
                label = '%s · %s %d%s' % (GNAME[g], COUNTRY_HE[cc], y, (' ' + tag) if tag else '')
                add(cc, dict(id=id_, group=g, y=y, label=label, mintage=n, mintageCirculated=circ, mintageProof=proof,
                             mintageText='' if n else ('לסטים בלבד' if setonly else 'טרם פורסמה' if v == 'tba' else ''), mint=mint, mintMark=mm, mintVariant=mintv,
                             variant=variant, tag=tag, rarityTier=t, rarityReason=reason,
                             rare=reason.split(': ', 1)[-1] if t else '', note=note))

    # 2 euro commemoratives. German coins: one per mint, mintage per mint from euro-coins.info when the counts line up.
    de_cc = {}
    for r in src['eci'].get('de', []):
        de_cc.setdefault(r['year'], {})[r['mint']] = [x for x in r['cc'] if x]
    order = {}
    comms = sorted(src['commemoratives'], key=lambda c: (c['year'], c['country']))
    for c in comms:
        cc, y = c['country'], c['year']
        k = order[(cc, y)] = order.get((cc, y), 0) + 1
        subj_en = c['subject'] or ''
        subj = HE.get(subj_en) or subj_en or 'מטבע הנצחה'
        base_id = 'cc-%s-%d-%s' % (cc, y, slug(subj_en or subj))
        common = 'הנפקה משותפת לכל גוש האירו. ' if c['common'] else ''
        n = c['volume']
        t, reason = tier(n, False)
        common_note = common + ('תאריך הנפקה: ' + c['date'] + '. ' if c['date'] else '') + ('(' + subj_en + ')' if subj_en and subj_en != subj else '')
        if cc == 'de':
            per_mint = {m: (de_cc.get(y, {}).get(m) or []) for m in DE_MINTS}
            for m in DE_MINTS:
                lst = per_mint[m]
                count = lst[k - 1] if len(lst) >= k else None
                id_ = base_id + '-' + m.lower()
                while id_ in seen: id_ += 'x'
                add(cc, dict(id=id_, group='cc', y=y, label='2 יורו הנצחה · גרמניה %d %s — %s' % (y, m, subj),
                             mintage=count, mintageText='' if count else ('סה״כ לחמש המטבעות: ' + c['volumeText'] if c['volumeText'] else ''),
                             mint=DE_MINTS[m], mintMark=m, mintVariant=m != 'A', variant=False, tag=m, commemorative=True,
                             rarityTier='', rarityReason='', rare='', note=common_note))
            continue
        id_ = base_id
        while id_ in seen: id_ += 'x'
        add(cc, dict(id=id_, group='cc', y=y, label='2 יורו הנצחה · %s %d — %s' % (COUNTRY_HE[cc], y, subj),
                     mintage=n, mintageText='' if n else c['volumeText'], mint='', mintMark='', mintVariant=False, variant=False,
                     tag='משותף' if c['common'] else '', commemorative=True, rarityTier=t, rarityReason=reason,
                     rare=reason.split(': ', 1)[-1] if t else '', note=common_note))

    os.makedirs(os.path.join(OUTDIR, 'euro'), exist_ok=True)
    shards = []
    for cc in COUNTRY_ORDER:
        items = by_country[cc]
        if not items: continue
        for it in items:   # drop empty fields: the loader fills defaults
            for k in [k for k, v in it.items() if v in ('', None, False) and k not in ('id', 'group', 'y', 'label', 'country')]:
                del it[k]
        p = 'catalogs/euro/%s.json' % cc
        with io.open(os.path.join(OUTDIR, 'euro', cc + '.json'), 'w', encoding='utf8') as f:
            json.dump({'items': items}, f, ensure_ascii=False, separators=(',', ':'))
        shards.append(p)
    manifest = {
        'name': 'יורו',
        'sub': '1999–היום, כל מדינות גוש האירו',
        'about': 'כל מטבעות האירו של כל המדינות (כולל אנדורה, מונקו, סן מרינו והוותיקן) לפי ערך ושנה, סימני המטבעה של גרמניה, '
                 'שנות סטים בלבד, וכל מטבעות ההנצחה של 2 יורו כולל ההנפקות המשותפות. Key / Semi-Key לפי כמויות ההטבעה.',
        'theme': 'file', 'groupLabel': 'ערך',
        'groups': [{'key': g, 'name': n} for g, n, _ in GROUPS],
        'countries': [{'key': c, 'name': COUNTRY_HE[c]} for c in COUNTRY_ORDER],
        'defaultSort': {'by': 'group', 'country': True},
        'groupSpecs': SPECS,
        'sources': ['euro-coins.info — mintage quantities of euro coins by country, year and mint (circulation, BU, proof)',
                    'Wikipedia — "<country> euro coins" mintage tables and "€2 commemorative coins"'],
        'catalogVersion': '2026-10-05-1',
        'shards': shards,
    }
    with io.open(os.path.join(OUTDIR, 'euro.json'), 'w', encoding='utf8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    total = sum(len(v) for v in by_country.values())
    print('euro:', total, 'items |', {c: len(by_country[c]) for c in COUNTRY_ORDER})
    allit = [i for v in by_country.values() for i in v]
    print('key', sum(i.get('rarityTier') == 'key' for i in allit), 'semi', sum(i.get('rarityTier') == 'semi-key' for i in allit),
          'comm', sum(i['group'] == 'cc' for i in allit), 'mintVariants', sum(bool(i.get('mintVariant')) for i in allit))

if __name__ == '__main__':
    main()
