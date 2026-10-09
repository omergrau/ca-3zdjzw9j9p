# Wikimedia Commons helpers: walk a category tree and read each file's license, author and a thumbnail URL.
# Only freely reusable files are kept (public domain, CC0, CC BY, CC BY-SA); NC / ND and unknown licenses are dropped.
import json, os, re, subprocess, time, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, 'data', 'cache', 'commons')
API = 'https://commons.wikimedia.org/w/api.php?'
UA = 'CoinAlbumCatalogBuilder/1.0 (personal coin album; contact via github.com/omergrau)'
FREE = re.compile(r'^(public domain|pd|cc0|cc[- ]by(-sa)?( \d\.\d)?|cc-by(-sa)?-\d\.\d|attribution|gfdl)', re.I)

def api(params):
    os.makedirs(CACHE, exist_ok=True)
    q = urllib.parse.urlencode(dict(params, format='json', formatversion=2))
    path = os.path.join(CACHE, re.sub(r'[^\w]+', '_', q)[:180] + '.json')
    if os.path.exists(path):
        with open(path, encoding='utf8') as f: return json.load(f)
    for attempt in range(5):
        out = subprocess.run(['curl', '-s', '-A', UA, API + q], capture_output=True).stdout.decode('utf8')
        time.sleep(1.5 + (60 if 'too many requests' in out else attempt * 5))
        try:
            data = json.loads(out); break
        except ValueError:
            continue
    else:
        raise RuntimeError('Commons API failed: ' + q[:120] + ' -> ' + out[:200])
    tmp = path + '.%d.tmp' % os.getpid()   # write then rename: a crash or a second run never leaves half a file
    with open(tmp, 'w', encoding='utf8') as f: json.dump(data, f)
    os.replace(tmp, path)
    return data

def members(cat, kind):
    out, cont = [], {}
    while True:
        d = api(dict(action='query', list='categorymembers', cmtitle=cat, cmtype=kind, cmlimit=500, **cont))
        out += [m['title'] for m in d.get('query', {}).get('categorymembers', [])]
        if 'continue' not in d: return out
        cont = {'cmcontinue': d['continue']['cmcontinue']}

def walk(root, depth=3, skip=re.compile(r'ancient|banknote|medal|token|commemorative sets?$', re.I)):
    """All files under a category (breadth first, each category once) -> {file title: category}"""
    files, seen, todo = {}, set(), [(root, 0)]
    while todo:
        cat, d = todo.pop(0)
        if cat in seen: continue
        seen.add(cat)
        for f in members(cat, 'file'): files.setdefault(f, cat)
        if d < depth:
            todo += [(c, d + 1) for c in members(cat, 'subcat') if not skip.search(c)]
    return files

def search(q, limit=25):
    """File titles matching a Commons full-text search"""
    d = api(dict(action='query', list='search', srsearch=q, srnamespace=6, srlimit=limit))
    return [r['title'] for r in d.get('query', {}).get('search', [])]

def info(titles, width=320):
    """file title -> {thumb, page, license, credit} for freely licensed files"""
    out = {}
    titles = list(titles)
    for i in range(0, len(titles), 50):
        d = api(dict(action='query', prop='imageinfo', titles='|'.join(titles[i:i + 50]), iiprop='url|extmetadata|size', iiurlwidth=width))
        for p in d.get('query', {}).get('pages', []):
            ii = (p.get('imageinfo') or [{}])[0]
            md = ii.get('extmetadata', {})
            lic = (md.get('LicenseShortName', {}).get('value') or '').strip()
            if not FREE.match(lic): continue
            artist = re.sub(r'<[^>]+>', '', md.get('Artist', {}).get('value') or '').strip()
            w, h = ii.get('width') or 1, ii.get('height') or 1
            out[p['title']] = dict(thumb=ii.get('thumburl') or ii.get('url'), page=ii.get('descriptionurl'), license=lic,
                                   credit=(artist or 'Wikimedia Commons')[:80], ratio=round(w / h, 2))
    return out
