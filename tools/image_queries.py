# Commons search queries per coin type, for the albums whose labels do not carry English names (US, UK, euro,
# Mandate, crowns). Each job returns {typeKey: (query, words that must appear in the file name, years)}.
import glob, io, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
CAT = os.path.join(HERE, '..', 'catalogs')

def _items(path):
    d = json.load(io.open(path, encoding='utf8'))
    return d if isinstance(d, list) else d.get('items', [])

def _types(items, key=lambda i: i.get('typeKey') or i['group']):
    out = {}
    for it in items:
        if it.get('proof') or it.get('error') or it.get('variant'): continue
        t = out.setdefault(key(it), {'years': set(), 'label': it['label'], 'note': it.get('note', ''), 'group': it['group'], 'item': it})
        if it.get('y'): t['years'].add(int(it['y']))
    return out

def us():
    from build_us import SERIES
    names = {}
    for pat, g, sk, *_ in SERIES:
        first = re.split(r'\|', pat)[0]
        first = re.sub(r'\\\(|\\\)|\(.*?\)|\.\*|\\\||[\\^$]', ' ', first)
        first = re.sub(r'mintage figures|, \d{4}.*|Initial Composition|Copper-Nickel Clad|\s+', ' ', first).strip(' ,|')
        names.setdefault(sk, first)
    prog = {'q-st': '{} state quarter', 'q-dc': '{} quarter', 'q-atb': '{} quarter', 'q-aw': '{} quarter', 'd1-pres': '{} presidential dollar',
            'd1-inn': 'American Innovation dollar {}', 'd1-na': 'Native American dollar {}'}
    out = {}
    for f in glob.glob(os.path.join(CAT, 'us', '*.json')):
        for k, t in _types(_items(f)).items():
            base = next((p for p in prog if k.startswith(p + '-')), None)
            if base:
                design = re.search(r' — (.+?) (?:1[789]|20)\d\d', t['label'])
                d = design.group(1).split(':')[0] if design else str(min(t['years']))
                out[k] = (prog[base].format(d), [w.lower() for w in re.findall(r'[A-Za-z]{4,}', d)][:1], t['years'])
            else:
                n = names.get(k) or names.get(k.split('-')[0]) or ''
                if n: out[k] = (n + ' coin', [w.lower() for w in re.findall(r'[A-Za-z]{4,}', n)][:2], t['years'])
    return out

UK_DEC = {'hp': 'half penny', 'p1': 'one penny', 'p2': 'two pence', 'p5': 'five pence', 'p10': 'ten pence', 'p20': 'twenty pence',
          'p50': 'fifty pence', 'l1': 'one pound coin', 'l2': 'two pound coin'}
UK_DEC_WORD = {'hp': 'penny', 'p1': 'penny', 'p2': 'pence', 'p5': 'pence', 'p10': 'pence', 'p20': 'pence', 'p50': 'pence', 'l1': 'pound', 'l2': 'pound'}
UK_PRE = {'f4': ('farthing', 'farthing'), 'hp': ('halfpenny', 'halfpenny'), 'p1': ('penny', 'penny'), 'p6': ('sixpence', 'sixpence'),
          's1': ('shilling', 'shilling'), 'fl': ('florin', 'florin'), 'hc': ('half crown', 'crown')}
MONARCH_EN = {'ג׳ורג׳ השלישי': 'George III', 'ג׳ורג׳ הרביעי': 'George IV', 'ויליאם הרביעי': 'William IV', 'ויקטוריה': 'Victoria',
              'אדוארד השביעי': 'Edward VII', 'ג׳ורג׳ החמישי': 'George V', 'ג׳ורג׳ השישי': 'George VI', 'אליזבת השנייה': 'Elizabeth II'}

def ukdec():
    out = {}
    for k, t in _types(_items(os.path.join(CAT, 'uk-decimal.json'))).items():
        g = t['group']
        design = (k.split('|')[1] if '|' in k else '')
        design = '' if re.search(r'[֐-׿]', design) or design.lower() in ('', 'britannia') else design
        q = 'British ' + UK_DEC[g] + (' ' + design.replace('-', ' ') if design else '') + ' coin'
        out[k] = (q, [UK_DEC_WORD[g]], t['years'])
    return out

def ukpre():
    out = {}
    for k, t in _types(_items(os.path.join(CAT, 'uk-predecimal.json'))).items():
        g = t['group']; parts = k.split('|')
        mon = MONARCH_EN.get(parts[1], '') if len(parts) > 1 else ''
        out[k] = ('British ' + UK_PRE[g][0] + ' ' + mon + ' coin', [UK_PRE[g][1]], t['years'])
    return out

def mandate():
    from_js = {1: 'mil', 2: 'mils', 5: 'mils', 10: 'mils', 20: 'mils', 50: 'mils', 100: 'mils'}
    out = {}
    for d in (1, 2, 5, 10, 20, 50, 100):
        word = {1: 'one', 2: 'two', 5: 'five', 10: 'ten', 20: 'twenty', 50: 'fifty', 100: 'hundred'}[d]
        out['d%d' % d] = ('Palestine %d %s coin' % (d, from_js[d]), ['palestin', 'mil', r'(^|[^0-9])%d([^0-9]|$)|%s' % (d, word)], set(range(1927, 1948)))
    return out

def crowns():
    reigns = {'g3': ('crown George III 1818', range(1818, 1821)), 'g4': ('crown George IV 1821', range(1821, 1827)),
              'w4': ('crown William IV 1831', [1831]), 'vyh': ('crown Victoria 1844', range(1839, 1848)),
              'vgo': ('gothic crown 1847', [1847, 1853]), 'vjh': ('crown Victoria jubilee 1887', range(1887, 1893)),
              'voh': ('crown Victoria 1893', range(1893, 1901)), 'e7': ('crown Edward VII 1902', [1902]),
              'g5': ('wreath crown George V', range(1927, 1937)), 'g6': ('crown George VI 1937', [1937, 1951]),
              'e2': ('crown Elizabeth II coronation 1953', [1953, 1960, 1965])}
    return {k: (q, ['crown', r'^(?!.*half)'], set(ys)) for k, (q, ys) in reigns.items()}

COUNTRY_EN = {'at': 'Austria', 'be': 'Belgium', 'bg': 'Bulgaria', 'cy': 'Cyprus', 'de': 'Germany', 'ee': 'Estonia', 'es': 'Spain', 'fi': 'Finland',
              'fr': 'France', 'gr': 'Greece', 'hr': 'Croatia', 'ie': 'Ireland', 'it': 'Italy', 'lt': 'Lithuania', 'lu': 'Luxembourg', 'lv': 'Latvia',
              'mc': 'Monaco', 'mt': 'Malta', 'nl': 'Netherlands', 'pt': 'Portugal', 'si': 'Slovenia', 'sk': 'Slovakia', 'sm': 'San Marino',
              'va': 'Vatican', 'ad': 'Andorra'}
EURO_VAL = {'c1': ('1 euro cent', 'cent'), 'c2': ('2 euro cent', 'cent'), 'c5': ('5 euro cent', 'cent'), 'c10': ('10 euro cent', 'cent'),
            'c20': ('20 euro cent', 'cent'), 'c50': ('50 euro cent', 'cent'), 'e1': ('1 euro coin', 'euro'), 'e2': ('2 euro coin', 'euro')}

def euro():
    out = {}
    for f in glob.glob(os.path.join(CAT, 'euro', '*.json')):
        cc = os.path.basename(f)[:2]
        for k, t in _types(_items(f), key=lambda i: cc + '§' + (i.get('typeKey') or i['group'])).items():
            g = t['group']
            if g == 'cc':
                subj = re.search(r'\(([A-Za-z][^)]{3,80})\)', t['note'])
                words = [w.lower() for w in re.findall(r'[A-Za-z]{5,}', subj.group(1))][:1] if subj else []
                out[k] = ('2 euro commemorative ' + COUNTRY_EN[cc] + ' ' + (subj.group(1) if subj else str(min(t['years']))), words or ['euro'], t['years'])
            else:
                out[k] = (EURO_VAL[g][0] + ' ' + COUNTRY_EN[cc], [EURO_VAL[g][1], COUNTRY_EN[cc].lower()[:5]], t['years'])
    return out

JOBS = {'us': us, 'ukdec': ukdec, 'ukpre': ukpre, 'mandate': mandate, 'crowns': crowns, 'euro': euro}

def numista_album(key, src, country):
    """Albums built from Numista types: search by the type's English title (kept in the item note)."""
    def job():
        out = {}
        for k, t in _types(_items(os.path.join(CAT, src))).items():
            m = re.search(r'סוג: (.+?) \(Numista', t['note'])
            if not m: continue
            title = m.group(1)
            value = re.match(r'^([\d½¼¾⅛⅒⁄/]+)?\s*([A-Za-z]+)', title)
            words = [re.escape(value.group(2).lower()[:5])] if value else []
            if value and value.group(1): words.append(r'(^|[^0-9])' + re.escape(value.group(1).replace('⁄', '/')) + r'([^0-9]|$)')
            out[k] = (title + ' ' + country + ' coin', words, t['years'])
        return out
    return job

JOBS['egypt'] = numista_album('egypt', 'egypt.json', 'Egypt')
JOBS['ottoman'] = numista_album('ottoman', 'ottoman.json', 'Ottoman')
JOBS['ussr'] = numista_album('ussr', 'ussr.json', 'Soviet Union')
for _k, _f, _c in (('br_india', 'br-india.json', 'British India'), ('br_ceylon', 'br-ceylon.json', 'Ceylon'),
                   ('br_rhodesia', 'br-rhodesia.json', 'Southern Rhodesia'), ('br_rhod_nyasa', 'br-rhod-nyasa.json', 'Rhodesia and Nyasaland'),
                   ('br_south_africa', 'br-south-africa.json', 'South Africa'), ('br_west_africa', 'br-west-africa.json', 'British West Africa'),
                   ('br_east_africa', 'br-east-africa.json', 'East Africa'), ('br_straits', 'br-straits.json', 'Straits Settlements'),
                   ('br_malaya', 'br-malaya.json', 'Malaya'), ('br_malaya_borneo', 'br-malaya-borneo.json', 'Malaya and British Borneo'),
                   ('br_cyprus', 'br-cyprus.json', 'Cyprus')):
    JOBS[_k] = numista_album(_k, _f, _c)
