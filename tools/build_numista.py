# Generic album builder for countries scraped from Numista type pages (tools/data/<key>_numista.json).
# One album slot per date row. Groups are denominations ordered by value; the "countries" axis of the album is the
# ruler / period (king, sultan, republic...), so an album can be split by reign. Key / Semi-Key are computed in the app
# (catalog.js markSeriesKeys) from the mintages written here.
#   python tools/build_numista.py egypt
import io, json, os, re, statistics, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from build_ottoman import SULTANS, FIX_SULTAN  # Ottoman sultans appear on Egyptian, Levant and Balkan coins too

AR_DIGITS = str.maketrans('٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789')
FRAC = {'½': .5, '¼': .25, '¾': .75, '⅛': .125, '⅜': .375, '⅞': .875, '⅒': .1}
SULTAN_HE = {pre.strip(): he for pre, _, he in SULTANS}

CONFIGS = {
    'egypt': dict(
        src='egypt_numista.json', out='egypt.json', id='eg',
        name='מצרים', sub='1517–היום, מהתקופה העות׳מאנית ועד הרפובליקה',
        about='מטבעות מצרים: התקופה העות׳מאנית, הסולטנות והממלכה (חוסיין כאמל, פואד, פארוק) והרפובליקה, כולל מטבעות ההנצחה '
              'למחזור. כל תאריך ושנה, עם כמות ההטבעה כשידועה. אפשר לסדר לפי שליט / תקופה.',
        rulerLabel='👑 לפי שליט', rulersLabel='שליטים ותקופות',
        currency={'Akçe': 1 / 120 / 40, 'Piastre': 1 / 40, 'Pound': 1},  # value in pounds; ratios are given per currency unit
        units=[(r'Milli[eè]mes?', 'מיל'), (r'Piastres?|Qirsh|Qurush', 'קרש'), (r'Pounds?', 'לירה'), (r'Para', 'פארה'),
               (r'Sultani', 'סולטאני'), (r'Akce|Akçe', 'אקצ׳ה'), (r'Mangh?ir', 'מנגיר'), (r'Medin[i]?', 'מדין'), (r'Fals|Falus', 'פלס'),
               (r'Mahbub|Ma[hḥ]b[uū]b|Zeri|Zari', 'זרי מחבוב'), (r'Findik', 'פינדיק'), (r'Beshlik', 'בשליק'), (r'Altin|Altın', 'אלטין')],
        rulers=[('Hussein Kamel', 'husseinkamel', 'הסולטן חוסיין כאמל'), ('Fuad', 'fuad', 'פואד הראשון'), ('Farouk', 'farouk', 'המלך פארוק'),
                ('Republic (1953', 'rep1953', 'הרפובליקה (1953–1958)'), ('United Arab Republic', 'uar', 'הרפובליקה הערבית המאוחדת (1958–1971)'),
                ('Arab Republic of Egypt', 'are', 'הרפובליקה הערבית של מצרים (1971–)')],
        mints={'Cairo': 'קהיר', 'Misr': 'מצרים (קהיר)', 'London': 'לונדון', 'Royal Mint': 'המטבעה המלכותית', 'Birmingham': 'בירמינגהם',
               'Heaton': 'Heaton, בירמינגהם', 'Paris': 'פריז', 'Berlin': 'ברלין', 'Bombay': 'בומביי', 'Pretoria': 'פרטוריה'},
    ),
}

RU_UNITS = [(r'Polushka', 'פולושקה'), (r'Denga|Denezhka', 'דנגה'), (r'Kopecks?|Kopeks?|Kopeyka|Kopeek', 'קופייקה'), (r'Altyn', 'אלטין'),
            (r'Grivennik', 'גריבניק'), (r'Polupoltinnik', 'פולופולטיניק'), (r'Poltina|Poltinnik', 'פולטינה'), (r'Polupoltina', 'פולופולטינה'),
            (r'Roubles?|Rubles?', 'רובל'), (r'Chervonets', 'צ׳רבונץ'), (r'Imperial', 'אימפריאל'), (r'Poluimperial', 'פולואימפריאל'),
            (r'Ducat', 'דוקט'), (r'Grivna', 'גריבנה'), (r'Para', 'פארה'), (r'Zlot', 'זלוטי'), (r'Groszy|Grosz', 'גרוש')]
RU_RULERS = [('Ivan IV', 'ivan4', 'איוואן הרביעי (האיום)'), ('Peter I ', 'peter1', 'פיוטר הראשון (הגדול)'), ('Peter I (', 'peter1', 'פיוטר הראשון (הגדול)'),
             ('Catherine I ', 'catherine1', 'יקטרינה הראשונה'), ('Catherine I (', 'catherine1', 'יקטרינה הראשונה'), ('Peter II', 'peter2', 'פיוטר השני'),
             ('Anna', 'anna', 'אנה'), ('Ivan VI', 'ivan6', 'איוואן השישי'), ('Elizabeth', 'elizabeth', 'אליזבטה'), ('Peter III', 'peter3', 'פיוטר השלישי'),
             ('Catherine II', 'catherine2', 'יקטרינה השנייה (הגדולה)'), ('Paul I', 'paul1', 'פאבל הראשון'), ('Alexander I ', 'alexander1', 'אלכסנדר הראשון'),
             ('Alexander I (', 'alexander1', 'אלכסנדר הראשון'), ('Nicholas I ', 'nicholas1', 'ניקולאי הראשון'), ('Nicholas I (', 'nicholas1', 'ניקולאי הראשון'),
             ('Alexander II ', 'alexander2', 'אלכסנדר השני'), ('Alexander II (', 'alexander2', 'אלכסנדר השני'), ('Alexander III', 'alexander3', 'אלכסנדר השלישי'),
             ('Nicholas II', 'nicholas2', 'ניקולאי השני'), ('Provisional', 'provisional', 'הממשלה הזמנית (1917)'), ('Russian Republic', 'provisional', 'הממשלה הזמנית (1917)'),
             ('Russian Socialist', 'rsfsr', 'הרפובליקה הסובייטית הרוסית (1917–1922)'), ('RSFSR', 'rsfsr', 'הרפובליקה הסובייטית הרוסית (1917–1922)'),
             ('Soviet Union', 'ussr', 'ברית המועצות'), ('USSR', 'ussr', 'ברית המועצות'), ('Union of Soviet', 'ussr', 'ברית המועצות'),
             ('Russian Federation', 'rf', 'הפדרציה הרוסית'), ('Federation', 'rf', 'הפדרציה הרוסית')]
RU_MINTS = {'Saint Petersburg': 'סנקט פטרבורג', 'St. Petersburg': 'סנקט פטרבורג', 'Leningrad': 'לנינגרד', 'Moscow': 'מוסקבה', 'Ekaterinburg': 'יקטרינבורג',
            'Yekaterinburg': 'יקטרינבורג', 'Suzun': 'סוזון', 'Kolyvan': 'קוליבן', 'Warsaw': 'ורשה', 'Tiflis': 'טביליסי', 'Birmingham': 'בירמינגהם',
            'Osaka': 'אוסקה', 'Paris': 'פריז', 'Brussels': 'בריסל', 'Izhora': 'איז׳ורה', 'Sestroretsk': 'סטרורצק'}
for _key, _name, _sub, _about in (
        ('ussr', 'ברית המועצות', '1921–1991, מקופייקה ועד רובל',
         'מטבעות הרפובליקה הסובייטית הרוסית וברית המועצות: כל ערך וכל שנה, כולל רובלי ההנצחה למחזור, עם כמות ההטבעה כשידועה.'),
        ('russia', 'הפדרציה הרוסית', '1992–היום, מקופייקה ועד 25 רובל',
         'מטבעות רוסיה מ-1992: כל ערך, שנה ומטבעה (מוסקבה / סנקט פטרבורג), ומטבעות ההנצחה למחזור.'),
        ('russian_empire', 'האימפריה הרוסית', 'עד 1917, מפולושקה ועד אימפריאל',
         'מטבעות האימפריה הרוסית לפי צאר ושנה: נחושת, כסף וזהב, כולל מטבעות המטבעות המקומיות.')):
    CONFIGS[_key] = dict(src=_key + '_numista.json', out=_key.replace('_', '-') + '.json', id={'ussr': 'su', 'russia': 'ru', 'russian_empire': 're'}[_key],
                         name=_name, sub=_sub, about=_about, rulerLabel='👑 לפי שליט / תקופה', rulersLabel='שליטים ותקופות',
                         currency={'Rouble': 1, 'Ruble': 1, 'Kopeck': 0.01}, units=RU_UNITS, rulers=RU_RULERS, mints=RU_MINTS)

def fnum(s):
    s = s.strip().replace('⁄', '/')
    m = re.fullmatch(r'(\d+)?([½¼¾⅛⅜⅞⅒])', s)
    if m: return (int(m.group(1)) if m.group(1) else 0) + FRAC[m.group(2)]
    m = re.fullmatch(r'(\d+)/(\d+)', s)
    if m: return int(m.group(1)) / int(m.group(2))
    try: return float(s.replace(',', ''))
    except ValueError: return None

def mm(s):
    m = re.search(r'([\d.]+)', s or '')
    return float(m.group(1)) if m else None

def number(s):
    d = re.sub(r'\D', '', s or '')
    return int(d) if d else None

def metal(comp):
    c = (comp or '').lower()
    for k, v in (('gold', ('gold', 'זהב')), ('billon', ('silver', 'בילון')), ('silver', ('silver', 'כסף')),
                 ('nickel brass', ('bronze', 'פליז-ניקל')), ('aluminium-bronze', ('bronze', 'ברונזה-אלומיניום')),
                 ('aluminum-bronze', ('bronze', 'ברונזה-אלומיניום')), ('aluminium', ('alu', 'אלומיניום')), ('aluminum', ('alu', 'אלומיניום')),
                 ('bimetallic', ('bimetal', 'דו-מתכתי')), ('copper-nickel', ('cuni', 'קופרו-ניקל')), ('cupronickel', ('cuni', 'קופרו-ניקל')),
                 ('nickel', ('cuni', 'ניקל')), ('steel', ('steel', 'פלדה')), ('brass', ('bronze', 'פליז')), ('bronze', ('bronze', 'ברונזה')),
                 ('zinc', ('steel', 'אבץ'))):
        if c.startswith(k) or (k in ('bimetallic', 'steel') and k in c): return v
    return 'copper', 'נחושת'

def ruler(cfg, f, title):
    raw = f.get('King') or f.get('Queen') or f.get('Sultan') or f.get('Ruler') or f.get('Emperor') or f.get('Period') or ''
    first = re.match(r'^(.*?\(\d{3,4}[^)]*\))', raw)
    raw1 = first.group(1) if first else raw
    years = [int(y) for y in re.findall(r'\((\d{3,4})', raw)]
    start = min(years) if years else 9999
    for pre, key, he in cfg['rulers']:
        if raw1.startswith(pre) or (' ' + pre.strip()) in (' ' + raw1): return key, he, start
    s = raw1
    for k, v in FIX_SULTAN.items():
        if s.startswith(k): s = v
    for pre, key, he in SULTANS:
        if (s + ' ').startswith(pre): return key, he, start
    if raw1:
        name = re.sub(r'\s*\(.*', '', raw1).strip()
        return re.sub(r'[^a-z0-9]+', '', name.lower())[:20] or 'x', name + (' (' + str(start) + ')' if years else ''), start
    return 'anon', 'לא מזוהה', 9999

def denomination(cfg, f, title):
    v = f.get('Value') or title.split(' - ')[0]
    cur = f.get('Currency') or ''
    factor = next((x for k, x in cfg['currency'].items() if cur.startswith(k)), 1)
    ratio = None
    m = re.search(r'\(?([\d.,/⁄½¼¾⅛⅒]+)\s*[A-Z]{3}\)?', v) or re.search(r'\(([\d.,/⁄½¼¾⅛⅒]+)\)\s*$', v)
    if m: ratio = fnum(m.group(1))
    name = re.split(r'\s*\(|\s+\d[\d.,]*\s*[A-Z]{3}', v)[0].strip()
    qm = re.match(r'^([\d½¼¾⅛⅜⅞⅒/⁄.,]+)\s+(.*)$', name)
    qty, unit = (qm.group(1), qm.group(2)) if qm else ('1', name)
    he = next((h for r, h in cfg['units'] if re.search(r, unit, re.I)), unit)
    q = re.sub(r'^1⁄2$', '½', qty).replace('⁄', '/')
    label = he if q == '1' else q + ' ' + he
    rank = (ratio if ratio is not None else (fnum(qty) or 1)) * factor
    key = re.sub(r'[^0-9a-z]+', '-', (q + '-' + unit).lower().replace('½', 'h').replace('/', '-')).strip('-')
    return label, rank, key

def build(key):
    cfg = CONFIGS[key]
    data = json.load(io.open(os.path.join(HERE, 'data', cfg['src']), encoding='utf8'))
    groups, rulers, items, ids = {}, {}, [], set()
    for x in data:
        f = x.get('f') or x.get('feat') or {}
        typ = f.get('Type', '')
        if not re.match(r'(Standard circulation|Circulating commemorative|Non-circulating)', typ): continue
        den, rank, gkey = denomination(cfg, f, x['t'])
        g = groups.setdefault(den, {'key': gkey, 'name': den, 'rank': []}); g['rank'].append(rank); gkey = g['key']
        rkey, rhe, start = ruler(cfg, f, x['t'])
        r = rulers.setdefault(rkey, {'key': rkey, 'name': rhe, 'start': start}); r['start'] = min(r['start'], start)
        met, metname = metal(f.get('Composition'))
        mint_src = (x.get('mint') or '') + ' ' + x['t']
        mint_he = next((h for k, h in cfg['mints'].items() if k in mint_src), '')
        nonc, comm = typ.startswith('Non-circulating'), typ.startswith('Circulating commemorative')
        extra = x['t'].split(' - ', 1)[1] if ' - ' in x['t'] else ''
        refs = re.findall(r'(KM#\s*[\w.]+|Schön#\s*[\w.]+)', f.get('References', ''))
        rows = x['rows'] or [[f.get('Year') or f.get('Years') or '', '', '', '']]
        for ri, row in enumerate(rows):
            date = (row[0] or '').replace('\xa0', ' ').strip()
            dm = re.match(r'^(\d{3,4}|ND)\s*(?:\((\d{3,4})(?:-(\d{3,4}))?\))?\s*(\S+)?', date)
            first, greg, tail = (dm.group(1), dm.group(2), (dm.group(4) or '').translate(AR_DIGITS)) if dm else ('', None, '')
            hijri = f.get('Dating', '').startswith('Islamic') and first and first != 'ND'
            if not greg and first and first != 'ND': greg = str(round(int(first) * 0.97 + 622)) if hijri else first
            y = int(greg) if greg else (start if start < 9999 else None)
            when = (first + ('/' + tail if tail.isdigit() else '') + (' (' + greg + ')' if hijri and greg else '')) if first and first != 'ND' else 'ללא תאריך'
            n = number(row[1]) if len(row) > 1 else None
            raw_comment = row[2] if len(row) > 2 else ''
            row_proof = bool(re.search(r'proof', raw_comment, re.I))
            comment = re.sub(r'[؀-ۿ]+', ' ', raw_comment)
            comment = re.sub(r'\(?\s*mintage in \d{4}\s*\)?|Year\s*,\s*Minting Year\s*\d+|no regnal year', ' ', comment, flags=re.I)
            comment = re.sub(r'^[\s\d/()–-]+|[\s;,–-]+$', '', re.sub(r'\s+', ' ', comment)).strip()
            label = den + ' ' + when + (' — ' + extra if comm and extra else '') + (' — ' + comment if comment and len(comment) < 40 else '')
            base = '%s-%s-%s' % (cfg['id'], x['id'], re.sub(r'[^0-9a-z]+', '-', (date + '-' + comment).lower()).strip('-')[:40] or str(ri))
            id_ = base
            while id_ in ids: id_ += 'x'
            ids.add(id_)
            note = ['סוג: ' + x['t'] + ' (Numista N#' + x['id'] + ').', 'שליט / תקופה: ' + rhe + '.']
            if mint_he: note.append('מטבעה: ' + mint_he + '.')
            if comment: note.append('הערת המקור: ' + comment + '.')
            if nonc: note.append('הוטבע שלא למחזור (מטבע אספנים / השקעה).')
            items.append({k: v for k, v in dict(
                id=id_, group=gkey, country=rkey, typeKey=x['id'], y=y, label=label, metal=met, metalName=metname, composition=f.get('Composition', ''),
                diam=mm(f.get('Diameter')) or 20, weight=mm(f.get('Weight')), thickness=mm(f.get('Thickness')), mintage=n,
                catalog=', '.join(refs), edge=(x.get('edge') or '').split(' ©')[0][:80], mint=mint_he, proof=nonc or row_proof, commemorative=comm,
                tag='לא למחזור' if nonc else ('פרוף' if row_proof else ('הנצחה' if comm else '')), note=' '.join(note)).items()
                if v not in ('', None, False) or k in ('id', 'group', 'y', 'label')})
    glist = sorted(groups.values(), key=lambda g: (statistics.median(g['rank']), g['name']))
    seen, gout = set(), []
    for g in glist:
        if g['key'] not in seen: seen.add(g['key']); gout.append({'key': g['key'], 'name': g['name']})
    order = {g['key']: i for i, g in enumerate(gout)}
    items.sort(key=lambda i: (order[i['group']], i['y'] or 0, i['id']))
    rout = sorted(rulers.values(), key=lambda r: (r['start'], r['name']))
    out = dict(name=cfg['name'], sub=cfg['sub'], about=cfg['about'], theme='file', groupLabel='ערך', groups=gout,
               countries=[{'key': r['key'], 'name': r['name']} for r in rout], countryLabel=cfg['rulerLabel'], countriesLabel=cfg['rulersLabel'],
               sources=['Numista — type pages'], sourceAttribution='נתונים: Numista (en.numista.com)', catalogVersion='2026-10-05-1', items=items)
    with io.open(os.path.join(HERE, '..', 'catalogs', cfg['out']), 'w', encoding='utf8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    print(key + ':', len(items), 'items,', len(gout), 'groups,', len(rout), 'rulers, proof', sum(1 for i in items if i.get('proof')))

if __name__ == '__main__':
    for k in sys.argv[1:] or CONFIGS: build(k)
