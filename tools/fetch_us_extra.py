# Second US source pass (appends to tools/data/us_sources.json):
#   - Russian Wikipedia tables for series the English pages lack (early/Capped Bust/Seated/Barber/Mercury dimes, half dimes,
#     half cents, three-cent nickel, early and Seated dollars, Trade dollar). Cells look like "1 234 567 (890)": circulation (proofs).
#   - English Wikipedia lists: Eisenhower dollar mintages; design lists for programs without published mintages here
#     (American Women quarters, American Innovation dollars, Native American dollars from 2023).
#   - Susan B. Anthony dollar (circulation totals cross-checked with the English article's 1979 and 1980 totals).
import io, json, os, re, subprocess, sys, urllib.parse
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from fetch_euro import wikitext, curl, CACHE
from wikitable import tables

OUT = os.path.join(HERE, 'data', 'us_sources.json')

def ru_wikitext(title):
    path = os.path.join(CACHE, 'ruwiki_' + re.sub(r'\W+', '_', title) + '.json')
    raw = curl('https://ru.wikipedia.org/w/api.php?action=parse&page=%s&prop=wikitext&format=json&formatversion=2&redirects=1' % urllib.parse.quote(title), path)
    return json.loads(raw)['parse']['wikitext']

RU_MINT = {'филадельфи': '(P)', 'денвер': 'D', 'сан-франциско': 'S', 'новом орлеане': 'O', 'новом-орлеане': 'O', 'карсон': 'CC'}

# page -> caption (type name and metal, the way the English pages name them)
RU_PAGES = {
    'Первые полуцентовые монеты США': 'Early half cent (Copper)',
    'Полцента с изображением Свободы в классическом стиле': 'Classic Head half cent (Copper)',
    'Полцента с изображением Свободы с заплетёнными волосами': 'Braided Hair half cent (Copper)',
    'Три цента США (медно-никелевая монета)': 'Three-cent nickel (Copper-nickel)',
    'Первые пятицентовые монеты США': 'Early half dime (Silver)',
    'Пять центов с бюстом Свободы в колпаке': 'Capped Bust half dime (Silver)',
    'Пять центов с сидящей Свободой': 'Seated Liberty half dime (Silver)',
    'Первые десятицентовые монеты США': 'Draped Bust dime (Silver)',
    'Десять центов с бюстом Свободы в колпаке': 'Capped Bust dime (Silver)',
    'Дайм с сидящей Свободой': 'Seated Liberty dime (Silver)',
    'Дайм Барбера': 'Barber dime (Silver)',
    'Дайм «Меркурий»': 'Mercury dime (Silver)',
    'Первые однодолларовые монеты США': 'Early dollar (Silver)',
    'Один доллар с сидящей Свободой': 'Seated Liberty dollar (Silver)',
    'Торговый доллар США': 'Trade dollar (Silver)',
}

def split_cell(s):
    """'1 234 567 (890)' -> (1234567, 890); '(около 20)' -> (None, 20); '' -> (None, None)"""
    s = s.strip()
    proof = None
    pm = re.search(r'\(([^)]*)\)', s)
    if pm:
        d = re.sub(r'\D', '', pm.group(1)); proof = int(d) if d else None
        s = s[:pm.start()] + s[pm.end():]
    d = re.sub(r'[^\d]', '', s)
    return (int(d) if d else None), proof

def main():
    rows = json.load(io.open(OUT, encoding='utf8'))
    rows = [r for r in rows if not r.get('extra')]   # drop what an earlier run of this script appended
    first_new = len(rows)
    for page, cap in RU_PAGES.items():
        w = ru_wikitext(page)
        for _, head, trs in tables(w):
            h = [re.sub(r'^\|', '', x).strip().lower() for x in head]
            if not h or not h[0].startswith(('год', 'year')): continue
            mints = []
            for x in h[1:]:
                m = next((v for k, v in RU_MINT.items() if k in x), None)
                mints.append(m or ('circ' if 'тираж для обращения' in x or x == 'тираж' else 'proof' if 'пруф' in x else 'note' if 'примеч' in x else '(P)'))
            for r in trs:
                ym = re.match(r'^(\d{4})(?:\s*[/-]\s*(\S+))?', r[0].strip())
                if not ym: continue
                y = int(ym.group(1)); ymint = (ym.group(2) or '').upper().replace('СС', 'CC').replace('С', 'S').replace('О', 'O').replace('Д', 'D')
                note = next((r[k + 1] for k, m in enumerate(mints) if m == 'note' and k + 1 < len(r)), '')
                for k, m in enumerate(mints):
                    if k + 1 >= len(r) or m == 'note': continue
                    cell = r[k + 1]
                    if not cell.strip() or cell.strip() in ('—', '-', '–'): continue
                    if m == 'circ':
                        n, _ = split_cell(cell); mint = ymint or '(P)'
                        if n: rows.append({'page': 'ru:' + page, 'caption': cap, 'year': y, 'ysuffix': '', 'mint': mint, 'mintage': n, 'raw': cell, 'comment': note})
                        continue
                    if m == 'proof':
                        _, _p = split_cell('(' + cell + ')'); mint = ymint or '(P)'
                        if _p: rows.append({'page': 'ru:' + page, 'caption': cap, 'year': y, 'ysuffix': '', 'mint': mint, 'mintage': _p, 'raw': cell, 'comment': 'Proof'})
                        continue
                    n, p = split_cell(cell)
                    if n: rows.append({'page': 'ru:' + page, 'caption': cap, 'year': y, 'ysuffix': '', 'mint': m, 'mintage': n, 'raw': cell, 'comment': ''})
                    if p: rows.append({'page': 'ru:' + page, 'caption': cap, 'year': y, 'ysuffix': '', 'mint': m, 'mintage': p, 'raw': cell, 'comment': 'Proof'})
    # Eisenhower dollar lists
    w = wikitext('Eisenhower dollar')
    sec = w[w.find('==Mintage figures=='):w.find('==See also==')]
    part = 'circ'
    for line in sec.split('\n'):
        if line.startswith('Uncirculated silver'): part = 'silver'
        elif line.startswith('Proof'): part = 'proof'
        m = re.match(r'^\*\s*(1776–1976|\d{4})(?:-([DS]))?\s*(silver|clad)?\s*(Type I{1,2})?\s+([\d,]+)', line)
        if not m: continue
        y = 1976 if m.group(1).startswith('1776') else int(m.group(1))
        mint = m.group(2) or '(P)'
        bits = ['Bicentennial ' + m.group(4) if m.group(4) else '', '40% silver' if part == 'silver' or m.group(3) == 'silver' else '',
                'Proof' if part == 'proof' else '']
        rows.append({'page': 'Eisenhower dollar', 'caption': 'Eisenhower dollar (Copper-nickel clad)', 'year': y, 'ysuffix': '',
                     'mint': mint, 'mintage': int(m.group(5).replace(',', '')), 'raw': line, 'comment': ', '.join(b for b in bits if b)})
    # Susan B. Anthony dollar: 1979 and 1980 circulation totals match the English article (757,813,744 and 89,660,708);
    # 1999 figures are quoted in the article; 1981 coins were struck for mint sets only.
    for y, m, n, c in ((1979, '(P)', 360222000, ''), (1979, 'D', 288015744, ''), (1979, 'S', 109576000, ''),
                       (1980, '(P)', 27610000, ''), (1980, 'D', 41628708, ''), (1980, 'S', 20422000, ''),
                       (1981, '(P)', 3000000, 'Mint sets only'), (1981, 'D', 3250000, 'Mint sets only'), (1981, 'S', 3492000, 'Mint sets only'),
                       (1999, '(P)', 29592000, ''), (1999, 'D', 11776000, '')):
        rows.append({'page': 'Susan B. Anthony dollar', 'caption': 'Susan B. Anthony dollar (Copper-nickel clad)', 'year': y, 'ysuffix': '',
                     'mint': m, 'mintage': n, 'raw': '', 'comment': c})
    # Design lists (no mintages here): Women quarters, Innovation dollars, Native American dollars 2023+
    for _, head, trs in tables(wikitext('American Women quarters')):
        if 'woman' not in [x.lower() for x in head]: continue
        for r in trs:
            ym = re.match(r'^(\d{4})', r[0]); name = r[2] if len(r) > 2 else ''
            if not ym: continue
            for mint in ('P', 'D'):
                rows.append({'page': 'American Women quarters', 'caption': name + ' reverse, %s (Nickel-clad copper)' % ym.group(1), 'year': int(ym.group(1)),
                             'ysuffix': '', 'mint': mint, 'mintage': None, 'raw': '', 'comment': 'American Women Quarters'})
    for _, head, trs in tables(wikitext('American Innovation dollars')):
        if 'jurisdiction' not in [x.lower() for x in head]: continue
        for r in trs:
            ym = re.match(r'^(\d{4})', r[0])
            if not ym or int(ym.group(1)) > 2025 or 'TBA' in r[3]: continue
            for mint in ('P', 'D'):
                rows.append({'page': 'American Innovation dollars', 'caption': 'American Innovation dollar — %s: %s (Manganese brass)' % (r[2], r[3]),
                             'year': int(ym.group(1)), 'ysuffix': '', 'mint': mint, 'mintage': None, 'raw': '', 'comment': r[2]})
    for _, head, trs in tables(wikitext('Sacagawea dollar')):
        if 'theme' not in [x.lower() for x in head]: continue
        for r in trs:
            ym = re.match(r'^(\d{4})', r[0])
            if not ym or not (2023 <= int(ym.group(1)) <= 2025): continue
            for mint in ('P', 'D'):
                rows.append({'page': 'Sacagawea dollar', 'caption': 'Native American dollar', 'year': int(ym.group(1)), 'ysuffix': '',
                             'mint': mint, 'mintage': None, 'raw': '', 'comment': r[1]})
    for r in rows[first_new:]: r['extra'] = True
    with io.open(OUT, 'w', encoding='utf8') as f:
        json.dump(rows, f, ensure_ascii=False, separators=(',', ':'))
    import collections
    print(len(rows), 'rows'); print(collections.Counter(r['page'] for r in rows if r['page'].startswith('ru:') or r['page'] in ('Eisenhower dollar', 'Susan B. Anthony dollar', 'American Women quarters', 'American Innovation dollars')))

if __name__ == '__main__':
    main()
