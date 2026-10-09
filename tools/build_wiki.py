# Albums built from English Wikipedia coin articles that carry yearly mintage tables ("Year" / "Date and Mint Mark" + "Mintage").
# Each mintage table takes its specs from the nearest specification table above it (diameter / weight / composition),
# or from the article's infobox. One slot per row; rulers by year. Key / Semi-Key are computed in the app.
#   python tools/build_wiki.py newfoundland hong_kong
import io, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import wikitable
from build_canada import wikitext
from build_japan import metal as metal_of_text

BRITISH = [(1901, 'victoria', 'המלכה ויקטוריה'), (1910, 'edward7', 'אדוארד השביעי'), (1936, 'george5', 'ג׳ורג׳ החמישי'),
           (1952, 'george6', 'ג׳ורג׳ השישי'), (2022, 'elizabeth2', 'המלכה אליזבת השנייה'), (9999, 'charles3', 'צ׳ארלס השלישי')]

CONFIGS = {
    'newfoundland': dict(
        out='newfoundland.json', id='nf', name='ניו פאונדלנד', sub='1865–1947, הדומיניון הבריטי', region='brcolonies',
        about='מטבעות ניו פאונדלנד לפני הצטרפותה לקנדה (1949): סנט, 5, 10, 20, 25 ו-50 סנט ומטבע הזהב של 2 דולר, לפי מלך ושנה, עם כמות ההטבעה.',
        rulers=BRITISH,
        pages=[('c1', 'Newfoundland one cent', 'סנט'), ('c5', 'Newfoundland five cents', '5 סנט'), ('c10', 'Newfoundland ten cents', '10 סנט'),
               ('c20', 'Newfoundland twenty cents', '20 סנט'), ('c25', 'Newfoundland twenty-five cents', '25 סנט'),
               ('c50', 'Newfoundland fifty cents', '50 סנט'), ('d2', 'Newfoundland 2-dollar coin', '2 דולר')],
        mints={'H': 'H — Heaton, בירמינגהם', 'C': 'C — אוטווה'}),
    'hong_kong': dict(
        out='hong-kong.json', id='hk', name='הונג קונג', sub='1863–היום, ממיל ועד 10 דולר', region='brcolonies',
        about='מטבעות הונג קונג מהמושבה הבריטית ועד היום: מיל, סנט, דולר, לפי מלך / תקופה ושנה, עם כמות ההטבעה.',
        rulers=BRITISH[:4] + [(1996, 'elizabeth2', 'המלכה אליזבת השנייה'), (9999, 'sar', 'אזור מנהלי מיוחד של סין (1997–)')],
        pages=[('m1', 'Hong Kong one-mil coin', 'מיל'), ('c1', 'Hong Kong one-cent coin', 'סנט'), ('c5', 'Hong Kong five-cent coin', '5 סנט'),
               ('c10', 'Hong Kong ten-cent coin', '10 סנט'), ('c20', 'Hong Kong twenty-cent coin', '20 סנט'), ('c50', 'Hong Kong fifty-cent coin', '50 סנט'),
               ('d1', 'Hong Kong one-dollar coin', 'דולר'), ('d2', 'Hong Kong two-dollar coin', '2 דולר'), ('d5', 'Hong Kong five-dollar coin', '5 דולר'),
               ('d10', 'Hong Kong ten-dollar coin', '10 דולר')],
        mints={'H': 'H — Heaton, בירמינגהם', 'KN': 'KN — Kings Norton'}),
}

def num(s, lo=0.1, hi=100):
    m = re.search(r'(\d+(?:[.,]\d+)?)', s or '')
    v = float(m.group(1).replace(',', '.')) if m else None
    return v if v is not None and lo <= v <= hi else None

def metal(comp):
    # '.95 copper, .04 tin' -> '95% copper, 4% tin' so the largest share wins
    c = re.sub(r'(?<![\d])\.(\d+)\s+([a-z])', lambda m: str(round(float('0.' + m.group(1)) * 100, 1)) + '% ' + m.group(2), comp.lower())
    return metal_of_text(c)

def build(key):
    cfg = CONFIGS[key]
    items, ids, used = [], set(), set()
    for gkey, title, gname in cfg['pages']:
        try: text = wikitext(title)
        except Exception: print('  missing page:', title); continue
        box = lambda k: wikitable.clean((re.search(r'\|\s*' + k + r'\s*=\s*([^\n|]+)', text, re.I) or [None, ''])[1])
        spec = dict(diam=num(box('diameter')), weight=num(box('mass') or box('weight')), comp=box('composition'))
        for cap, head, rows in wikitable.tables(text):
            hl = [h.lower() for h in head]
            mi = next((i for i, h in enumerate(hl) if h.startswith('mintage')), None)
            if mi is None:   # a specification table: it applies to the mintage tables that follow it
                di = next((i for i, h in enumerate(hl) if 'diameter' in h or h == 'size'), None)
                wi = next((i for i, h in enumerate(hl) if h.startswith('weight') or h.startswith('mass')), None)
                ci = next((i for i, h in enumerate(hl) if h.startswith('composition') or h == 'material'), None)
                if rows and (di is not None or ci is not None):
                    r = rows[0]
                    get = lambda i: r[i] if i is not None and len(r) > i else ''
                    spec = dict(diam=num(get(di)) or spec['diam'], weight=num(get(wi)) or spec['weight'], comp=get(ci) or spec['comp'])
                continue
            yi = next((i for i, h in enumerate(hl) if h.startswith('year') or h.startswith('date')), 0)
            for r in rows:
                if len(r) <= max(mi, yi): continue
                m = re.match(r'^\s*(\d{4})\s*([A-Z]{1,2})?\b\s*(.*)$', r[yi])
                if not m: continue
                y, mark, tail = int(m.group(1)), m.group(2) or '', m.group(3).strip(' ()–-')[:40]
                first = re.search(r'\d[\d,]*', r[mi])
                n = int(first.group(0).replace(',', '')) if first else None
                rk, rhe = next((k, he) for last, k, he in cfg['rulers'] if y <= last)
                used.add(rk)
                met, met_he = metal(spec['comp'] or '')
                mint = cfg['mints'].get(mark, mark)
                label = gname + ' ' + str(y) + (mark and ' ' + mark) + (' — ' + tail if tail else '')
                base = '%s-%s-%d%s' % (cfg['id'], gkey, y, ('-' + re.sub(r'[^a-z0-9]+', '-', (mark + ' ' + tail).lower()).strip('-')[:40]) if (mark or tail) else '')
                id_ = base
                while id_ in ids: id_ += 'x'
                ids.add(id_)
                note = ['מקור: ויקיפדיה האנגלית, "' + title + '".', 'שליט: ' + rhe + '.']
                if mint: note.append('סימן מטבעה: ' + mint + '.')
                if r[mi] and not n: note.append('כמות הטבעה במקור: ' + r[mi] + '.')
                items.append({k: v for k, v in dict(
                    id=id_, group=gkey, country=rk, typeKey='%s-%s-%s-%s' % (cfg['id'], gkey, rk, re.sub(r'\W+', '', spec['comp'] or '')[:12]), y=y,
                    label=label, metal=met, metalName=met_he, composition=re.sub(r'\s+', ' ', spec['comp'] or ''), diam=spec['diam'] or 22,
                    weight=spec['weight'], mintage=n, mint=mint, note=' '.join(note)).items() if v not in ('', None, False) or k in ('id', 'group', 'y', 'label')})
    # a figure repeated over several years of one type is a combined total
    seen = {}
    for it in items:
        if it.get('mintage'): seen.setdefault((it['typeKey'], it['mintage']), []).append(it)
    for (_, n), rows in seen.items():
        if len({r['y'] for r in rows}) > 1 and len(str(n).rstrip('0')) >= 4:   # round figures (200,000) do repeat for real
            for r in rows:
                del r['mintage']; r['note'] += ' כמות ההטבעה ' + format(n, ',') + ' היא סך משותף לכמה שנים.'
    order = {g: i for i, (g, _, _) in enumerate(cfg['pages'])}
    items.sort(key=lambda i: (order[i['group']], i['y'], i['id']))
    present = {i['group'] for i in items}
    names, seen_r = [], set()
    for _, k, he in cfg['rulers']:
        if k in used and k not in seen_r: seen_r.add(k); names.append({'key': k, 'name': he})
    out = dict(name=cfg['name'], sub=cfg['sub'], about=cfg['about'], theme='file', groupLabel='ערך',
               groups=[{'key': g, 'name': n} for g, _, n in cfg['pages'] if g in present], countries=names,
               countryLabel='👑 לפי מלך / תקופה', countriesLabel='מלכים ותקופות', sources=['Wikipedia (en): ' + ', '.join(t for _, t, _ in cfg['pages'])],
               sourceAttribution='נתונים: ויקיפדיה האנגלית (CC BY-SA)', catalogVersion='2026-10-09-1', items=items)
    with io.open(os.path.join(HERE, '..', 'catalogs', cfg['out']), 'w', encoding='utf8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    print(key + ':', len(items), 'items,', sum(1 for i in items if i.get('mintage')), 'with mintage,', len(present), 'groups')

if __name__ == '__main__':
    for k in sys.argv[1:] or CONFIGS: build(k)
