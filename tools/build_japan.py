# Japan, modern coinage 1870-today (rin, sen, yen), from the English Wikipedia article of each denomination: mintage tables
# per era (Meiji, Taishō, Shōwa, Heisei, Reiwa) and the "Types / Designs" spec table. One slot per table row.
#   python tools/build_japan.py
import io, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import wikitable
from build_canada import wikitext

GROUPS = [('rin1', '1 rin coin', 'רין', 0.001), ('rin5', '5 rin coin', '5 רין', 0.005), ('sen05', 'Half sen coin', '½ סן', 0.005),
          ('sen1', '1 sen coin', 'סן', 0.01), ('sen2', '2 sen coin', '2 סן', 0.02), ('sen5', '5 sen coin', '5 סן', 0.05),
          ('sen10', '10 sen coin', '10 סן', 0.1), ('sen20', '20 sen coin', '20 סן', 0.2), ('sen50', '50 sen coin', '50 סן', 0.5),
          ('yen1', '1 yen coin', 'ין', 1), ('yen2', '2 yen coin', '2 ין', 2), ('yen5', '5 yen coin', '5 ין', 5), ('yen10', '10 yen coin', '10 ין', 10),
          ('yen20', '20 yen coin', '20 ין', 20), ('yen50', '50 yen coin', '50 ין', 50), ('yen100', '100 yen coin', '100 ין', 100),
          ('yen500', '500 yen coin', '500 ין', 500)]
ERAS = [('meiji', 'Meiji', 1912, 'הקיסר מייג׳י (1868–1912)'), ('taisho', 'Taish', 1926, 'הקיסר טאישו (1912–1926)'),
        ('showa', 'Sh', 1989, 'הקיסר שווה (1926–1989)'), ('heisei', 'Heisei', 2019, 'הקיסר אקיהיטו — הייסיי (1989–2019)'),
        ('reiwa', 'Reiwa', 9999, 'הקיסר נארוהיטו — רייווה (2019–)')]
TYPE_HE = {'gold': 'זהב', 'silver': 'כסף', 'brass': 'פליז', 'aluminium': 'אלומיניום', 'aluminum': 'אלומיניום', 'bronze': 'ברונזה',
           'copper': 'נחושת', 'nickel': 'ניקל', 'cupronickel': 'קופרו-ניקל', 'tin': 'בדיל', 'zinc': 'אבץ', 'iron': 'ברזל'}

def sections(text):
    parts = re.split(r'^(=+)\s*(.*?)\s*\1\s*$', text, flags=re.M)
    out = [('', parts[0])]
    for j in range(1, len(parts), 3): out.append((wikitable.clean(parts[j + 1]), parts[j + 2]))
    return out

def years_in(cell):
    """'1874, 1876–1877, 1880' -> set of years; '1967–' -> open range."""
    ys = set()
    for a, b in re.findall(r'(\d{4})\s*(?:[–-]\s*(\d{4})?)?', cell):
        if b: ys.update(range(int(a), int(b) + 1))
        elif re.search(re.escape(a) + r'\s*[–-]\s*($|[^\d])', cell): ys.update(range(int(a), 2101))
        else: ys.add(int(a))
    return ys

def num(s, lo=0.1, hi=100):
    m = re.search(r'([\d.]+)', (s or '').replace(',', ''))
    v = float(m.group(1)) if m else None
    return v if v is not None and lo <= v <= hi else None   # a year in a size column is not a size

def metal(comp):
    """The main metal of an alloy text such as '80% silver, 20% copper': the largest share wins; bare names fall back to keywords."""
    c = comp.lower()
    shares = sorted(((float(p), m) for p, m in re.findall(r'([\d.]+)\s*%\s*([a-z]+)', c)), reverse=True)
    if shares:
        top = shares[0][1]
        others = {m for _, m in shares[1:]}
        if top == 'copper':
            if 'nickel' in others and any(m == 'nickel' and p >= 20 for p, m in shares): return ('cuni', 'קופרו-ניקל')
            if 'zinc' in others and any(m == 'zinc' and p >= 10 for p, m in shares): return ('bronze', 'פליז')
            return ('bronze', 'ברונזה') if others else ('copper', 'נחושת')
        c = top
    for k, v in (('gold', ('gold', 'זהב')), ('silver', ('silver', 'כסף')), ('aluminium bronze', ('bronze', 'ברונזה-אלומיניום')),
                 ('aluminum bronze', ('bronze', 'ברונזה-אלומיניום')), ('aluminium', ('alu', 'אלומיניום')), ('aluminum', ('alu', 'אלומיניום')),
                 (' al', ('alu', 'אלומיניום')), ('nickel brass', ('bronze', 'פליז-ניקל')), ('cupronickel', ('cuni', 'קופרו-ניקל')),
                 ('copper-nickel', ('cuni', 'קופרו-ניקל')), ('brass', ('bronze', 'פליז')), ('bronze', ('bronze', 'ברונזה')), ('tin', ('steel', 'בדיל')),
                 ('iron', ('steel', 'ברזל')), ('steel', ('steel', 'פלדה')), ('zinc', ('steel', 'אבץ'))):
        if k in ' ' + c: return v
    if 'nickel' in c and 'copper' in c: return ('cuni', 'קופרו-ניקל')
    if 'nickel' in c: return ('cuni', 'ניקל')
    return ('copper', 'נחושת')

GENERIC = re.compile(r'circulation|mintage|figures|minting|production|issued|history|^coins?$', re.I)

def build():
    items, ids, used_eras = [], set(), set()
    for gkey, title, gname, value in GROUPS:
        text = wikitext(title)
        specs = []
        for sec, body in sections(text):
            for cap, head, rows in wikitable.tables(body):
                hl = [h.lower() for h in head]
                if any('mintage' in h for h in hl): continue
                # size and composition may come from separate tables; each row covers a span of years
                yi = next((i for i, h in enumerate(hl) if h.startswith('year') or h == 'minted'), None)
                di = next((i for i, h in enumerate(hl) if 'diameter' in h or h == 'size'), None)
                wi = next((i for i, h in enumerate(hl) if h in ('mass', 'weight')), None)
                ci = next((i for i, h in enumerate(hl) if h in ('material', 'composition')), None)
                if yi is None or (di is None and wi is None and ci is None): continue
                cell = lambda r, i: r[i] if i is not None and len(r) > i else ''
                for r in rows:
                    specs.append(dict(years=years_in(cell(r, yi)), diam=num(cell(r, di)), weight=num(cell(r, wi)), comp=cell(r, ci)))
        box = lambda key: wikitable.clean((re.search(r'\|\s*' + key + r'\s*=\s*([^\n|]+)', text, re.I) or [None, ''])[1])
        page_default = dict(diam=num(box('diameter')), weight=num(box('mass') or box('weight')), comp=box('composition'))
        for sec, body in sections(text):
            for cap, head, rows in wikitable.tables(body):
                hl = [h.lower() for h in head]
                mi = next((i for i, h in enumerate(hl) if h.startswith('mintage')), None)
                gi = next((i for i, h in enumerate(hl) if 'gregorian' in h), None)
                if mi is None or gi is None: continue
                ri = next((i for i, h in enumerate(hl) if h == 'reason'), None)
                for r in rows:
                    if len(r) <= max(mi, gi): continue
                    m = re.match(r'^\s*(\d{4})\s*(.*)$', r[gi])
                    if not m: continue
                    y, tail = int(m.group(1)), m.group(2).strip()
                    if tail.startswith('(') and tail.endswith(')') and tail.count('(') == 1: tail = tail[1:-1]
                    if tail.count('(') > tail.count(')'): tail += ')'
                    reason = r[ri] if ri is not None and len(r) > ri else ''
                    raw_n = r[mi]
                    first = re.search(r'\d[\d,]*', raw_n)   # the first figure: some cells hold two numbers
                    n = int(first.group(0).replace(',', '')) if first else None
                    not_circ = bool(re.search(r'not (circulated|issued)|proof|sets? only|mint sets', raw_n + ' ' + tail, re.I))
                    era = next((e for e in ERAS if sec.startswith(e[1])), None) or next(e for e in ERAS if y <= e[2])
                    used_eras.add(era[0])
                    hits = [s for s in specs if y in s['years']]
                    words = re.findall(r'[a-z]+', (tail + ' ' + sec).lower())
                    def pick(f):   # prefer a spec row whose material matches the row's own note ("Brass", "TY2 Al")
                        good = [s[f] for s in hits if s[f] and any(w in s['comp'].lower() for w in words)] if f == 'comp' else []
                        return (good or [s[f] for s in hits if s[f]] or [page_default[f]])[0]
                    sp = dict(diam=pick('diam'), weight=pick('weight'), comp=pick('comp') or tail, years={y})
                    sp['comp'] = re.split(r'\{\{|\[\[', sp['comp'])[0].strip(' ,;')
                    own = re.sub(r'\bAB\b', 'aluminium bronze', re.sub(r'\bA[lL]\b', 'aluminium', tail))   # the row's own metal ("Silver", "TY2 (Al)") wins
                    met, met_he = metal(own) if re.search(r'gold|silver|bronze|brass|alumin|nickel|copper|tin|zinc|iron|steel', own, re.I) else metal(sp['comp'])
                    kind = tail if tail and not re.search(r'all types', tail, re.I) else (sec if sec and not sec.startswith(era[1]) and not GENERIC.search(sec) else '')
                    kind_he = TYPE_HE.get(kind.lower(), kind)
                    label = gname + ' ' + str(y) + (' — ' + reason if reason else '') + (' — ' + kind_he if kind_he and not reason else '')
                    tkey = 'jp-%s-%s-%s' % (gkey, era[0], re.sub(r'[^a-z0-9]+', '-', (kind or str(min(s2 for s in hits for s2 in s['years']) if hits else 0)).lower()))
                    if reason: tkey += '-' + re.sub(r'[^a-z0-9]+', '-', reason.lower())[:30]
                    base = 'jp-%s-%d%s' % (gkey, y, ('-' + re.sub(r'[^a-z0-9]+', '-', (kind + ' ' + reason).lower()).strip('-')[:40]) if (kind or reason) else '')
                    id_ = base
                    while id_ in ids: id_ += 'x'
                    ids.add(id_)
                    note = ['מקור: ויקיפדיה האנגלית, "' + title + '".', 'תקופה: ' + era[3] + '.']
                    if r[0] and re.search(r'\d', r[0]): note.append('שנת שלטון: ' + re.sub(r'^\d\d\s+', '', r[0]) + '.')
                    if raw_n and not n: note.append('כמות הטבעה במקור: ' + raw_n + '.')
                    items.append({k: v for k, v in dict(
                        id=id_, group=gkey, country=era[0], typeKey=tkey, y=y, label=label, metal=met, metalName=met_he,
                        composition=sp['comp'], diam=sp['diam'] or 20, weight=sp['weight'], mintage=n,
                        commemorative=bool(reason), proof=not_circ, tag='לא למחזור' if not_circ else ('הנצחה' if reason else ''),
                        note=' '.join(note)).items() if v not in ('', None, False) or k in ('id', 'group', 'y', 'label')})
    # A figure repeated over several years of one type is a combined total, not a yearly mintage: keep it as a note only
    seen = {}
    for it in items:
        if it.get('mintage'): seen.setdefault((it['typeKey'], it['mintage']), []).append(it)
    for (_, n), rows in seen.items():
        if len({r['y'] for r in rows}) > 1 and len(str(n).rstrip('0')) >= 4:   # round figures (200,000) do repeat for real
            for r in rows:
                del r['mintage']
                r['note'] += ' כמות ההטבעה ' + format(n, ',') + ' היא סך משותף לשנים ' + ', '.join(sorted({str(x['y']) for x in rows})) + '.'
    order = {g[0]: i for i, g in enumerate(GROUPS)}
    items.sort(key=lambda i: (order[i['group']], i['y'], i['id']))
    present = {i['group'] for i in items}
    out = dict(name='יפן', sub='1870–היום, מרין ועד 500 ין',
               about='מטבעות יפן המודרנית מתקופת מייג׳י ועד רייווה: רין, סן וין, כולל מטבעות זהב וכסף של מייג׳י ומטבעות ההנצחה של 100 ו-500 ין, '
                     'עם כמות ההטבעה של כל שנה. אפשר לסדר לפי קיסר.',
               theme='file', groupLabel='ערך', groups=[{'key': g, 'name': n} for g, _, n, _ in GROUPS if g in present],
               countries=[{'key': k, 'name': he} for k, _, _, he in ERAS if k in used_eras], countryLabel='👑 לפי קיסר', countriesLabel='קיסרים ותקופות',
               sources=['Wikipedia (en): rin / sen / yen coin articles'], sourceAttribution='נתונים: ויקיפדיה האנגלית (CC BY-SA)',
               catalogVersion='2026-10-09-1', items=items)
    with io.open(os.path.join(HERE, '..', 'catalogs', 'japan.json'), 'w', encoding='utf8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    print('japan:', len(items), 'items,', sum(1 for i in items if i.get('mintage')), 'with mintage,', sum(1 for i in items if i.get('commemorative')), 'commemorative,',
          sum(1 for i in items if i.get('proof')), 'not for circulation')

if __name__ == '__main__':
    build()
