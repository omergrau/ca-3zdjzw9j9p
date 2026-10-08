# Finds a freely licensed reference picture on Wikimedia Commons for each coin type of a catalog and writes
# catalogs/images/<catalog>.json: { typeKey: {u, page, lic, by, pair} }. The app shows it in empty album slots and in
# the coin's details, with the author and license. One picture per type (all years of a design share it); a picture
# of the exact year wins when there is one.
#   python tools/add_images.py lira pruta newshekel ...
import io, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from commons import walk, info

CAT = os.path.join(HERE, '..', 'catalogs')
UNIT_EN = {  # Hebrew unit in the album label -> words Commons file names use
    'אגורה': r'agor(a|ah|ot)|agurot', 'אגורות': r'agor(a|ah|ot)|agurot', 'פרוטה': r'prut(a|ah|ot)', 'פרוטות': r'prut(a|ah|ot)',
    'מיל': r'mils?', 'לירה': r'lir(a|ot)|pounds?|loti', 'לירות': r'lir(a|ot)|pounds?|loti', 'שקל': r'(she?qels?|shekel|nis|ils)(?!.*agor)',
    'שקלים': r'(she?qels?|shekel|nis|ils)(?!.*agor)', 'קרש': r'piastres?|qirsh|qurush', 'פארה': r'para', 'קורוש': r'kuru[sş]h?|piastres?',
    'אקצ׳ה': r'ak[cç]e', 'רובל': r'rub(le|el)s?|roubles?', 'קופייקה': r'kopek|kopeck|kopeks|kopecks|kopeyka',
}
JOBS = {
    'pruta': dict(src='pruta.json', roots=['Category:Coins of Israel'], ctx=r'israel|prut|mil', avoid=r'hanuk|anniversar|special|sheqel|shekel|agor'),
    'lira': dict(src='lira.json', roots=['Category:Coins of Israel'], ctx=r'israel|lira|lirot|agor|pound', avoid=r'new sheqel|nis|special edition|sheqel'),
    'oldshekel': dict(src='old-shekel.json', roots=['Category:Coins of Israel'], ctx=r'old|israel|1980|1981|1982|1983|1984|1985', avoid=r'new|nis|lira|lirot'),
    'newshekel': dict(src='new-shekel.json', roots=['Category:Coins of Israel'], ctx=r'new|nis|israel', avoid=r'old|lira|lirot|prut|fake'),
}
HEB_UNIT = re.compile(r'(?:^|\s)(\d+|½)?\s*(' + '|'.join(sorted(UNIT_EN, key=len, reverse=True)) + r')')

def load_items(path):
    d = json.load(io.open(path, encoding='utf8'))
    items = list(d.get('items', []))
    for s in d.get('shards') or []:
        p = os.path.join(CAT, '..', s) if not os.path.isabs(s) else s
        if os.path.exists(p):
            j = json.load(io.open(p, encoding='utf8')); items += j if isinstance(j, list) else j.get('items', [])
    return items

def types_of(items):
    out = {}
    for it in items:
        if it.get('proof') or it.get('error'): continue
        k = it.get('typeKey') or it['group']
        t = out.setdefault(k, {'years': set(), 'label': it['label'], 'comm': bool(it.get('commemorative'))})
        if it.get('y'): t['years'].add(int(it['y']))
    return out

COMM_WORDS = r'hanuk|anniversar|special|independence|rambam|weizman|eshkol|golda|rot[h]?sch|jabotinsk|herzl|gurion|pidyon|hasmonean|eilat|tribute|bullion|gold|fake|replica'

def score(title, value, unit_re, years, cfg, comm, words):
    name = title[5:].lower()
    if not re.search(r'[.](jpe?g|png|gif|webp|tiff?)$', name): return -1
    if cfg.get('avoid') and re.search(cfg['avoid'], name): return -1
    if comm:
        if not words or not any(w in name for w in words): return -1
    elif re.search(COMM_WORDS, name): return -1
    clean = re.sub(r'[0-9]+(st|nd|rd|th)[^a-z]', ' ', name)
    nums = re.findall(r'(?<![0-9a-z.])([0-9]+(?:[.][0-9]+)?)(?![0-9a-z])', clean)
    if 'half' in name: nums.append('0.5')
    v = '0.5' if value == '½' else value
    if v not in nums: return -1
    if 'half' in name and v != '0.5': return -1
    if not re.search(unit_re, name): return -1
    s = 10
    yrs = [int(n) for n in nums if len(n) == 4 and 1500 < int(n) < 2100]
    if yrs:
        if any(y in years for y in yrs): s += 8
        elif years and not any(min(years) - 1 <= y <= max(years) + 1 for y in yrs): return -1
    if re.search(cfg.get('ctx', '$^'), name): s += 2
    if re.search(r'revers|obvers|averse|both|&| and ', name): s += 1
    if re.search(r'scale|size|beetle|reference|coins? (of|in)|scattered|collection|standing|stack|hand|wallet|crop [0-9]', name): s -= 9
    return s

def run(key):
    cfg = JOBS[key]
    items = load_items(os.path.join(CAT, cfg['src']))
    files = {}
    for r in cfg['roots']: files.update(walk(r))
    out = {}
    cands = {}
    for k, t in types_of(items).items():
        m = HEB_UNIT.search(t['label'])
        if not m: continue
        value, unit = (m.group(1) or '1'), m.group(2)
        words = [w for w in re.split(r'[^a-z]+', k.lower()) if len(w) > 3][-1:]
        best = sorted(((score(f, value, UNIT_EN[unit], t['years'], cfg, t['comm'], words), f) for f in files), reverse=True)
        best = [f for s, f in best if s >= 10][:4]
        if best: cands[k] = best
    meta = info({f for v in cands.values() for f in v})
    for k, fs in cands.items():
        f = next((f for f in fs if f in meta), None)
        if not f: continue
        m = meta[f]
        out[k] = dict(u=m['thumb'], page=m['page'], lic=m['license'], by=m['credit'], pair=m['ratio'] > 1.5, f=f[5:])
    os.makedirs(os.path.join(CAT, 'images'), exist_ok=True)
    with io.open(os.path.join(CAT, 'images', key + '.json'), 'w', encoding='utf8') as fh:
        json.dump(out, fh, ensure_ascii=False, indent=0)
    n = len(types_of(items))
    print(key + ': pictures for', len(out), 'of', n, 'types')
    for k, v in list(out.items())[:400]: print('  ', k, '->', v['f'][:70], '|', v['lic'])


# ---- search mode: albums without Hebrew value words in their labels (see image_queries.py) ----
NEED_YEAR = {'ukpre', 'crowns'}

def run_search(key):
    from commons import search
    from image_queries import JOBS as QJOBS
    jobs = QJOBS[key]()
    cands = {}
    for k, (q, words, years) in jobs.items():
        best = []
        for f in search(q):
            name = f[5:].lower()
            if not re.search(r'[.](jpe?g|png|gif|webp|tiff?)$', name): continue
            if any(not re.search(w, name) for w in words): continue
            if re.search(r'scale|size|beetle|reference|scattered|collection|stack|hand|wallet|banknote|note[^a-z]|medal|token|fake|counterfeit|pattern|edge|princess|empress|portrait|painting|mould|die |triple crown|horse|jewel|regalia|tiara|medieval|findid|defaced|votes|mule|double florin|third farthing|amcyc', name): continue
            yrs = [int(n) for n in re.findall(r'(?<![0-9])(1[5-9][0-9][0-9]|20[0-9][0-9])(?![0-9])', name)]
            s = 10
            if not yrs and key in NEED_YEAR: continue
            if yrs:
                if years and any(y in years for y in yrs): s += 8
                elif years and not any(min(years) - 1 <= y <= max(years) + 1 for y in yrs): continue
            if re.search(r'revers|obvers|averse|both', name): s += 1
            best.append((s, f))
        best.sort(key=lambda x: -x[0])
        if best: cands[k] = [f for s, f in best[:4]]
    meta = info({f for v in cands.values() for f in v})
    out = {}
    for k, fs in cands.items():
        f = next((f for f in fs if f in meta), None)
        if f:
            m = meta[f]
            out[k] = dict(u=m['thumb'], page=m['page'], lic=m['license'], by=m['credit'], pair=m['ratio'] > 1.5, f=f[5:])
    os.makedirs(os.path.join(CAT, 'images'), exist_ok=True)
    with io.open(os.path.join(CAT, 'images', key + '.json'), 'w', encoding='utf8') as fh:
        json.dump(out, fh, ensure_ascii=False, indent=0)
    print(key + ': pictures for', len(out), 'of', len(jobs), 'types')
    for k, v in list(out.items())[:60]: print('  ', k, '->', v['f'][:70], '|', v['lic'])

if __name__ == '__main__':
    for k in sys.argv[1:]: (run if k in JOBS else run_search)(k)
