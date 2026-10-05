# Collects US coin mintages from Wikipedia into tools/data/us_sources.json as normalized rows:
#   {page, caption, year, mint, mintage, comment}
# Standard pages use Year / Mint / Mintage / Comments tables (one table per type, the caption names the type and metal);
# a few pages (Kennedy half, Morgan, Peace, Sacagawea, Presidential, 2c, 3c silver, 20c) have their own layouts.
import io, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from fetch_euro import wikitext
from wikitable import tables

OUT = os.path.join(HERE, 'data', 'us_sources.json')
STANDARD = ['United States cent mintage figures', 'Lincoln cent mintage figures', 'United States nickel mintage figures',
            'Roosevelt dime mintage figures', 'United States quarter mintage figures', 'Washington quarter mintage figures',
            'America the Beautiful quarter mintage figures', 'United States half dollar mintage figures']

def hdr(h): return re.sub(r'^.*\|\s*', '', h).strip().lower()

def mintage(s):
    s = (s or '').replace('&nbsp;', '').strip()
    if not s or s in ('–', '-', '—'): return None, s
    m = re.match(r'^[≈c~]?\s*([\d,]+)', s)
    if m and re.sub(r'\D', '', m.group(1)):
        return int(re.sub(r'\D', '', m.group(1))), s
    return None, s

def year_mint(y):
    y = re.sub(r'^.*\|\s*', '', y).strip()
    m = re.match(r'^(\d{4})(.*)$', y)
    return (int(m.group(1)), m.group(2).strip(' ,')) if m else (None, y)

def main():
    rows = []
    for page in STANDARD:
        for cap, head, trs in tables(wikitext(page)):
            h = [hdr(x) for x in head]
            if not h or 'year' not in h[0]: continue
            iy, im = 0, next((k for k, x in enumerate(h) if x.startswith('mint') and 'mintage' not in x), 1)
            imn = next((k for k, x in enumerate(h) if 'mintage' in x), 2)
            ic = next((k for k, x in enumerate(h) if 'comment' in x or 'note' in x), None)
            for r in trs:
                if len(r) <= imn: continue
                y, ysuffix = year_mint(r[iy])
                if not y: continue
                n, raw = mintage(r[imn])
                rows.append({'page': page, 'caption': cap, 'year': y, 'ysuffix': ysuffix, 'mint': r[im].strip(),
                             'mintage': n, 'raw': raw, 'comment': (r[ic] if ic is not None and ic < len(r) else '').strip()})
    # 50 State quarters: one row per state with P, D and proof mintages in columns
    for cap, head, trs in tables(wikitext('50 State quarter mintage figures')):
        h = [hdr(x) for x in head]
        if 'state' not in h: continue
        for r in trs:
            if len(r) < 10: continue
            y, _ = year_mint(r[0])
            if not y: continue
            for k, m in ((7, 'P'), (8, 'D')):
                n, raw = mintage(r[k])
                rows.append({'page': '50 State quarter mintage figures', 'caption': r[2] + ' reverse, %d (Nickel-clad copper)' % y,
                             'year': y, 'ysuffix': '', 'mint': m, 'mintage': n, 'raw': raw, 'comment': ''})
            for mm in re.finditer(r'([\d,]+)\s*\((silver proof|proof)\)', r[9]):
                rows.append({'page': '50 State quarter mintage figures', 'caption': r[2] + ' reverse, %d (Nickel-clad copper)' % y,
                             'year': y, 'ysuffix': '', 'mint': 'S', 'mintage': int(mm.group(1).replace(',', '')), 'raw': mm.group(0),
                             'comment': 'Silver proof' if mm.group(2) == 'silver proof' else 'Proof'})
    # Kennedy half dollar: Date | Mint mark | Business strike | Proof
    for cap, head, trs in tables(wikitext('Kennedy half dollar mintage figures')):
        for r in trs:
            y, suffix = year_mint(r[0]) if r else (None, '')
            if not y or len(r) < 4: continue
            mint = re.sub(r'^.*\|\s*', '', r[1]).strip()
            n, raw = mintage(r[2]); p, praw = mintage(r[3])
            base = {'page': 'Kennedy half dollar mintage figures', 'caption': 'Kennedy half dollar' + (' ' + suffix if suffix else ''),
                    'year': y, 'ysuffix': suffix, 'mint': mint or '(P)'}
            if n: rows.append(dict(base, mintage=n, raw=raw, comment=''))
            if p: rows.append(dict(base, mintage=p, raw=praw, comment='Proof'))
    # Morgan and Peace dollars: Year | one column per mint
    for page, cap in (('Morgan dollar', 'Morgan dollar (Silver)'), ('Peace dollar', 'Peace dollar (Silver)')):
        for _, head, trs in tables(wikitext(page)):
            mints = [hdr(x) for x in head[1:]]
            code = {'philadelphia': '(P)', 'new orleans': 'O', 'san francisco': 'S', 'carson city': 'CC', 'denver': 'D', 'west point': 'W'}
            for r in trs:
                y, _ = year_mint(r[0])
                if not y: continue
                for k, mname in enumerate(mints):
                    n, raw = mintage(r[k + 1] if k + 1 < len(r) else '')
                    if n: rows.append({'page': page, 'caption': cap, 'year': y, 'ysuffix': '', 'mint': code.get(mname, mname), 'mintage': n, 'raw': raw, 'comment': ''})
    # Sacagawea / Native American dollar: Year | P | D | S | total
    for cap, head, trs in tables(wikitext('Sacagawea dollar')):
        h = [hdr(x) for x in head]
        if not h or 'philadelphia mintage' not in h: continue
        for r in trs:
            y, _ = year_mint(r[0])
            if not y: continue
            for k, m in ((1, '(P)'), (2, 'D'), (3, 'S')):
                n, raw = mintage(r[k] if k < len(r) else '')
                if n: rows.append({'page': 'Sacagawea dollar', 'caption': 'Sacagawea dollar' if y < 2009 else 'Native American dollar',
                                   'year': y, 'ysuffix': '', 'mint': m, 'mintage': n, 'raw': raw, 'comment': 'Proof' if m == 'S' else ''})
    # Presidential dollars: release | number | president | date | D | P
    for cap, head, trs in tables(wikitext('Presidential dollar coins')):
        h = [hdr(x) for x in head]
        if 'president name' not in h: continue
        for r in trs:
            if len(r) < 6: continue
            ym = re.search(r'(\d{4})', r[3])
            if not ym: continue
            for k, m in ((4, 'D'), (5, 'P')):
                n, raw = mintage(r[k])
                rows.append({'page': 'Presidential dollar coins', 'caption': 'Presidential dollar — ' + r[2], 'year': int(ym.group(1)),
                             'ysuffix': '', 'mint': m, 'mintage': n, 'raw': raw, 'comment': r[2]})
    # Two-cent piece: Year | Proofs | Circulation ; three-cent silver: Year | Mint | Proofs | Circulation ; twenty-cent: Year | Mint | Circ | Proof
    for page, cap, cols in (('Two-cent piece (United States)', 'Two-cent piece (Bronze)', (None, 2, 1)),
                            ('Three-cent silver', 'Three-cent silver (Silver)', (1, 3, 2)),
                            ('Twenty-cent piece (United States)', 'Twenty-cent piece (Silver)', (1, 2, 3))):
        for _, head, trs in tables(wikitext(page)):
            for r in trs:
                y, suffix = year_mint(r[0])
                if not y: continue
                mint = (r[cols[0]].strip() if cols[0] is not None and cols[0] < len(r) else '') or '(P)'
                for k, kind in ((cols[1], ''), (cols[2], 'Proof')):
                    n, raw = mintage(r[k] if k < len(r) else '')
                    if n: rows.append({'page': page, 'caption': cap, 'year': y, 'ysuffix': suffix, 'mint': mint, 'mintage': n, 'raw': raw, 'comment': kind})
    with io.open(OUT, 'w', encoding='utf8') as f:
        json.dump(rows, f, ensure_ascii=False, separators=(',', ':'))
    import collections
    print(len(rows), 'rows'); print(collections.Counter(r['page'] for r in rows))

if __name__ == '__main__':
    main()
