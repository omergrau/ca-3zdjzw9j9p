# Downloads the euro sources and keeps a compact summary in tools/data/euro_sources.json:
#   - euro-coins.info mintage tables (per country, year, mint; circulation / BU / proof)
#   - Wikipedia "<country> euro coins" mintage tables (fallback for years or countries the first source lacks)
#   - Wikipedia "€2 commemorative coins" (every 2 euro commemorative with country, subject, volume and date)
# Requests are spaced out; both sites allow these pages to be fetched.
import io, json, os, re, subprocess, sys, time, urllib.parse
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from eci_parse import parse as parse_eci

UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) coin-album-catalog-builder/1.0 (omergrau@gmail.com)'
CACHE = os.path.join(HERE, 'data', 'cache')
OUT = os.path.join(HERE, 'data', 'euro_sources.json')

# country code: (euro-coins.info page, English Wikipedia adjective, commemorative-table templates)
COUNTRIES = {
    'at': ('austria', 'Austrian', ['AUT']), 'be': ('belgium', 'Belgian', ['BEL']), 'hr': ('croatia', 'Croatian', ['CRO', 'HRV']),
    'cy': ('cyprus', 'Cypriot', ['CYP']), 'nl': ('netherlands', 'Dutch', ['NLD', 'NED']), 'ee': ('estonia', 'Estonian', ['EST']),
    'fi': ('finland', 'Finnish', ['FIN']), 'fr': ('france', 'French', ['FRA']), 'de': ('germany', 'German', ['DEU', 'GER']),
    'gr': ('greece', 'Greek', ['GRC', 'GRE']), 'ie': ('ireland', 'Irish', ['IRL']), 'it': ('italy', 'Italian', ['ITA']),
    'lv': ('latvia', 'Latvian', ['LAT', 'LVA']), 'lt': ('litva', 'Lithuanian', ['LIT', 'LTU']), 'lu': ('luxembourg', 'Luxembourgish', ['LUX']),
    'mt': ('malta', 'Maltese', ['MLT', 'MAL']), 'pt': ('portugal', 'Portuguese', ['POR', 'PRT']), 'sk': ('slovakia', 'Slovak', ['SVK']),
    'si': ('slovenia', 'Slovenian', ['SLO', 'SVN']), 'es': ('spain', 'Spanish', ['ESP']), 'ad': ('andorra', 'Andorran', ['AND']),
    'mc': ('monaco', 'Monégasque', ['MON', 'MCO']), 'sm': ('san-marino', 'Sammarinese', ['SMR']), 'va': ('vatican', 'Vatican', ['VAT']),
    'bg': (None, 'Bulgarian', ['BUL', 'BGR']),
}
DENOMS = ['1c', '2c', '5c', '10c', '20c', '50c', '1€', '2€']

def curl(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 1000: return io.open(path, encoding='utf8', errors='replace').read()
    data = subprocess.run(['curl', '-s', '-m', '60', '-A', UA, url], capture_output=True).stdout
    io.open(path, 'wb').write(data); time.sleep(2)
    return data.decode('utf8', 'replace')

def wikitext(title):
    path = os.path.join(CACHE, 'wiki_' + re.sub(r'\W+', '_', title) + '.json')
    raw = curl('https://en.wikipedia.org/w/api.php?action=parse&page=%s&prop=wikitext&format=json&formatversion=2&redirects=1' % urllib.parse.quote(title), path)
    return json.loads(raw)['parse']['wikitext']

def wiki_number(cell, millions):
    c = re.sub(r"'''|''|<[^>]+>|\{\{N/a\}\}", '', cell).strip()
    if c in ('s',): return 's'
    if not c or not re.search(r'\d', c): return None
    if millions: return int(round(float(c.replace(',', '')) * 1_000_000))
    return int(re.sub(r'[^\d]', '', c))

def wiki_mintages(w):
    """{(year, mark): {denom: n | 's'}} from the 'Circulating mintage quantities' tables."""
    i = w.find('Circulating mintage quantities'); j = w.find('\n==', i + 40)
    sec = w[i:j if j > 0 else None]
    millions = 'million' in sec[:600]
    out = {}
    for table in re.findall(r'\{\|(.*?)\n\|\}', sec, re.S):
        heads = [h.strip() for h in re.findall(r'^!.*?(€\s?[\d.,]+[^\n|]*)', table, re.M)]
        cols = []
        for h in heads:
            m = re.match(r'€\s?([\d.,]+)\s*(.*)', h); v = m.group(1).replace(',', '.'); extra = m.group(2).strip()
            cols.append(None if extra else {'0.01': '1c', '0.02': '2c', '0.05': '5c', '0.10': '10c', '0.20': '20c', '0.50': '50c', '1.00': '1€', '2.00': '2€'}.get(v))
        for block in re.split(r'\n\|-', table):
            hm = re.search(r'^!\|?\s*(\d{4})\s*([^\n|]*)$', block, re.M)
            if not hm: continue
            mark = hm.group(2).strip()
            if mark == 'Total': continue
            vals = [v for line in block[hm.end():].split('\n') if line.startswith('|') for v in line.lstrip('|').split('||')]
            row = {}
            for k, d in enumerate(cols):
                if d and k < len(vals): row[d] = wiki_number(vals[k], millions)
            out[(int(hm.group(1)), mark)] = row
    return out

def clean(s):
    s = re.sub(r'<ref[^>]*/>|<ref.*?</ref>', '', s, flags=re.S)
    s = re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]*)\]\]', r'\1', s)
    s = re.sub(r'\[https?://\S+\s*([^\]]*)\]', r'\1', s)
    s = re.sub(r'\{\{lang\|[a-z-]+\|([^}]*)\}\}', r'\1', s, flags=re.I)
    s = re.sub(r'<br\s*/?>', ' — ', s)
    s = re.sub(r"'''?|\{\{[^}]*\}\}", '', s)
    return re.sub(r'\s+', ' ', s).strip(' —')

def volume(s):
    s = clean(s).lower().replace(' ', ' ')
    m = re.search(r'([\d.,]+)\s*million', s)
    if m: return int(round(float(m.group(1).replace(',', '.')) * 1_000_000))
    m = re.search(r'([\d][\d,. ]*)', s)
    if m:
        d = re.sub(r'[^\d]', '', m.group(1))
        return int(d) if d else None
    return None

def commemoratives(w):
    out = []
    for sm in re.finditer(r'^==+\s*(\d{4}) (coinage|commonly issued coin)\s*==+', w, re.M):
        year, kind = int(sm.group(1)), sm.group(2)
        end = re.compile(r'^==+\s*\d{4} (coinage|commonly issued coin)|^==\s*References', re.M).search(w, sm.end())
        sec = w[sm.end(): end.start() if end else len(w)]
        for block in re.split(r'\n\|-', sec):
            lines = [l for l in block.split('\n') if l.startswith('|')]
            for k, l in enumerate(lines):
                m = re.search(r'\{\{([A-Z]{2,3})\}\}', l)
                if not m or m.group(1) == 'EU' or k + 3 > len(lines): continue
                feat, vol, date = [re.sub(r'^\|\s*(style="[^"]*"\s*\|)?', '', x).strip() for x in lines[k + 1:k + 4]]
                out.append({'year': year, 'common': kind != 'coinage', 'flag': m.group(1), 'subject': clean(feat),
                            'volume': volume(vol), 'volumeText': clean(vol), 'date': clean(date)})
                break
    return out

def main():
    os.makedirs(CACHE, exist_ok=True)
    data = {'eci': {}, 'wiki': {}, 'commemoratives': []}
    for code, (eci, adj, flags) in COUNTRIES.items():
        if eci:
            page = os.path.join(CACHE, 'eci_' + eci + '.html')
            curl('https://www.euro-coins.info/info/mintage/%s.html' % eci, page)
            data['eci'][code] = parse_eci(page)
        rows = wiki_mintages(wikitext(adj + ' euro coins'))
        data['wiki'][code] = [{'year': y, 'mark': mk, 'vals': v} for (y, mk), v in sorted(rows.items())]
        print(code, 'eci', len(data['eci'].get(code, [])), 'wiki', len(rows), flush=True)
    flagmap = {f: c for c, (_, _, fl) in COUNTRIES.items() for f in fl}
    for c in commemoratives(wikitext('€2 commemorative coins')):
        c['country'] = flagmap.get(c.pop('flag'))
        if c['country']: data['commemoratives'].append(c)
    print('commemoratives', len(data['commemoratives']))
    with io.open(OUT, 'w', encoding='utf8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))

if __name__ == '__main__':
    main()
