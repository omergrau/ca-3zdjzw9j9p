# Canada, decimal coinage 1858-today, from the English Wikipedia articles of each denomination (yearly mintage tables).
# One album slot per table row (a year, a mint mark or a listed variety). Specs per period are kept here (the articles give
# them in grains/inches templates); monarch by year. Key / Semi-Key are computed in the app from the mintages.
#   python tools/build_canada.py
import io, json, os, re, subprocess, sys, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import wikitable

CACHE = os.path.join(HERE, 'data', 'cache', 'wiki')
os.makedirs(CACHE, exist_ok=True)

def wikitext(title, lang='en'):
    path = os.path.join(CACHE, '%s_%s.json' % (lang, re.sub(r'[^\w.-]', '_', title)))
    if os.path.exists(path):
        with io.open(path, encoding='utf8') as fh: return json.load(fh)
    url = 'https://%s.wikipedia.org/w/api.php?action=parse&page=%s&prop=wikitext&format=json&formatversion=2&redirects=1' % (lang, urllib.parse.quote(title))
    raw = subprocess.run(['curl', '-s', '-A', 'coin-album-research/1.0 (omergrau@gmail.com)', url], capture_output=True).stdout
    text = json.loads(raw)['parse']['wikitext']
    with io.open(path, 'w', encoding='utf8') as fh: json.dump(text, fh)
    return text

MONARCHS = [(1901, 'victoria', 'המלכה ויקטוריה'), (1910, 'edward7', 'אדוארד השביעי'), (1936, 'george5', 'ג׳ורג׳ החמישי'),
            (1952, 'george6', 'ג׳ורג׳ השישי'), (2022, 'elizabeth2', 'המלכה אליזבת השנייה'), (9999, 'charles3', 'צ׳ארלס השלישי')]

def monarch(y):
    return next((k, he) for last, k, he in MONARCHS if y <= last)

# (first year, last year, diameter mm, weight g, metal, metal name, composition)
SPECS = {
    'c1': [(1858, 1859, 25.4, 4.54, 'bronze', 'ברונזה', '95% נחושת, 5% בדיל ואבץ'), (1876, 1920, 25.4, 5.67, 'bronze', 'ברונזה', 'ברונזה'),
           (1920, 1996, 19.05, 3.24, 'bronze', 'ברונזה', 'ברונזה / נחושת'), (1997, 2012, 19.05, 2.35, 'bronze', 'מצופה נחושת', 'אבץ או פלדה בציפוי נחושת')],
    'c5': [(1858, 1921, 15.5, 1.17, 'silver', 'כסף', '92.5% / 80% כסף'), (1922, 1942, 21.2, 4.54, 'cuni', 'ניקל', '99.9% ניקל'),
           (1943, 1945, 21.3, 4.54, 'bronze', 'טומבק / פלדה', 'טומבק (1942–43) או פלדה מצופה כרום (1944–45), 12 צלעות'),
           (1946, 1999, 21.2, 4.54, 'cuni', 'ניקל', 'ניקל / קופרו-ניקל'), (2000, 9999, 21.2, 3.95, 'steel', 'פלדה מצופה ניקל', 'פלדה מצופה ניקל')],
    'c10': [(1858, 1967, 18.03, 2.33, 'silver', 'כסף', '92.5% / 80% כסף'), (1968, 1999, 18.03, 2.07, 'cuni', 'ניקל', '99.9% ניקל'),
            (2000, 9999, 18.03, 1.75, 'steel', 'פלדה מצופה ניקל', 'פלדה מצופה ניקל')],
    'c25': [(1870, 1967, 23.88, 5.83, 'silver', 'כסף', '92.5% / 80% כסף'), (1968, 1999, 23.88, 5.07, 'cuni', 'ניקל', '99.9% ניקל'),
            (2000, 9999, 23.88, 4.4, 'steel', 'פלדה מצופה ניקל', 'פלדה מצופה ניקל')],
    'c50': [(1870, 1936, 29.72, 11.62, 'silver', 'כסף', '92.5% / 80% כסף'), (1937, 1967, 29.72, 11.66, 'silver', 'כסף', '80% כסף'),
            (1968, 1999, 27.13, 8.1, 'cuni', 'ניקל', '99.9% ניקל'), (2000, 9999, 27.13, 6.9, 'steel', 'פלדה מצופה ניקל', 'פלדה מצופה ניקל')],
    'd1': [(1935, 1967, 36.07, 23.33, 'silver', 'כסף', '80% כסף'), (1968, 1986, 32.13, 15.62, 'cuni', 'ניקל', '99.9% ניקל'),
           (1987, 9999, 26.5, 7.0, 'bronze', 'ברונזה מצופה ניקל (לוני)', 'ניקל בציפוי ברונזה, 11 צלעות')],
    'd2': [(1996, 9999, 28.0, 7.3, 'bimetal', 'דו-מתכתי (טוני)', 'מרכז אלומיניום-ברונזה בטבעת ניקל')],
}
GROUPS = [('c1', 'סנט'), ('c5', '5 סנט'), ('c10', '10 סנט'), ('c25', '25 סנט'), ('c50', '50 סנט'), ('d1', 'דולר'), ('d2', '2 דולר')]
PAGES = [('c1', 'Penny (Canadian coin)'), ('c5', 'Nickel (Canadian coin)'), ('c10', 'Dime (Canadian coin)'), ('c25', 'Quarter (Canadian coin)'),
         ('c50', '50-cent piece (Canadian coin)'), ('d1', 'Canadian silver dollar'), ('d1', 'Loonie'), ('d2', 'Toonie')]
MINT_HE = {'H': 'H — Heaton, בירמינגהם', 'C': 'C — אוטווה', 'M': 'M (מגנטי)', 'NM': 'NM (לא מגנטי)', 'P': 'P (ציפוי)', 'W': 'W — וויניפג'}

def spec(group, y):
    return next((s for s in SPECS[group] if s[0] <= y <= s[1]), SPECS[group][-1])

def number(s):
    d = re.sub(r'[^\d]', '', (s or '').split('(')[0])
    return int(d) if d else None

def variety(cell):
    """'1911 No "Dei gratia""...' -> (1911, 'No "Dei gratia"')."""
    m = re.match(r'^\s*(\d{4})\s*[–-]?\s*(.*)$', cell)
    if not m: return None, ''
    tail = m.group(2).split('""')[0].strip(' –-')
    tail = re.sub(r'"Dei "', '"Dei gratia"', tail)
    if tail.count('"') % 2: tail += '"'
    return int(m.group(1)), tail[:40]

def build():
    items, ids = [], set()
    for group, title in PAGES:
        text = wikitext(title)
        for cap, head, rows in wikitable.tables(text):
            h = [x.lower() for x in head]
            if not h or h[0] not in ('year', 'date'): continue
            commem = 'theme' in h
            if commem and not cap.lower().startswith('commemorative editions'): continue   # collector-only sets are not circulation coins
            if h[0] == 'date' and 'reason' in h: continue
            mi = next((i for i, x in enumerate(h) if x.startswith('mintage')), None)
            for r in rows:
                y, tail = variety(r[0] if r else '')
                if not y: continue
                theme = r[h.index('theme')] if commem and 'theme' in h and len(r) > h.index('theme') else ''
                n = number(r[mi]) if mi is not None and len(r) > mi else None
                note = r[h.index('notes')] if 'notes' in h and len(r) > h.index('notes') else ''
                lo, hi, diam, weight, metal, metal_he, comp = spec(group, y)
                # a figure repeated for each variety of a year is one combined mintage: count it once
                same = next((i for i in items if i['group'] == group and i['y'] == y and i.get('mintage') == n and n and not i.get('commemorative')), None)
                pattern = group == 'd1' and y == 1911   # the 1911 silver dollar: 3 patterns, never issued
                mk, mhe = monarch(y)
                mint = MINT_HE.get(tail.strip(), '')
                label = dict(GROUPS)[group] + ' ' + str(y) + (' — ' + theme if theme else '') + (' — ' + tail if tail else '')
                tkey = 'ca-%s-%s-%d' % (group, mk, lo) + ('-' + re.sub(r'[^a-z0-9]+', '-', theme.lower())[:30] if commem else '')
                base = 'ca-%s-%d%s' % (group, y, ('-' + re.sub(r'[^a-z0-9]+', '-', (theme + ' ' + tail).lower()).strip('-')[:40]) if (theme or tail) else '')
                id_ = base
                while id_ in ids: id_ += 'x'
                ids.add(id_)
                notes = ['מקור: ויקיפדיה האנגלית, "' + title + '".', 'מלך: ' + mhe + '.']
                if mint: notes.append('סימן מטבעה: ' + mint + '.')
                if same and not commem: notes.append('כמות ההטבעה היא סך כל הווריאנטים של השנה.')
                if note and len(note) < 220: notes.append('הערת המקור: ' + note.rstrip('.') + '.')
                items.append({k: v for k, v in dict(
                    id=id_, group=group, country=mk, typeKey=tkey, y=y, label=label, metal=metal, metalName=metal_he, composition=comp,
                    diam=diam, weight=weight, mintage=n, mint=mint, commemorative=bool(commem), variant=bool(same and not commem),
                    noKey=pattern, tag='דוגמה' if pattern else ('הנצחה' if commem else ''),
                    note=' '.join(notes)).items() if v not in ('', None, False) or k in ('id', 'group', 'y', 'label')})
    order = {g: i for i, (g, _) in enumerate(GROUPS)}
    items.sort(key=lambda i: (order[i['group']], i['y'], i['id']))
    used = {i['country'] for i in items}
    out = dict(name='קנדה', sub='1858–היום, מסנט ועד 2 דולר',
               about='כל מטבעות המחזור של קנדה לפי שנה, מהמושבה (1858) ועד היום: וריאנטים מוכרים, סימני מטבעה, מטבעות ההנצחה של הלוני והטוני, '
                     'וכמות ההטבעה של כל שנה.',
               theme='file', groupLabel='ערך', groups=[{'key': g, 'name': n} for g, n in GROUPS],
               countries=[{'key': k, 'name': he} for _, k, he in MONARCHS if k in used], countryLabel='👑 לפי מלך', countriesLabel='מלכים',
               sources=['Wikipedia (en): Penny / Nickel / Dime / Quarter / 50-cent piece (Canadian coin), Canadian silver dollar, Loonie, Toonie'],
               sourceAttribution='נתונים: ויקיפדיה האנגלית (CC BY-SA)', catalogVersion='2026-10-09-1', items=items)
    with io.open(os.path.join(HERE, '..', 'catalogs', 'canada.json'), 'w', encoding='utf8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    print('canada:', len(items), 'items,', sum(1 for i in items if i.get('mintage')), 'with mintage,', sum(1 for i in items if i.get('commemorative')), 'commemorative')

if __name__ == '__main__':
    build()
