# Mintages for the Soviet circulating commemorative coins, from the English Wikipedia list (Numista leaves most of them empty).
# Called by build_numista.py for the 'ussr' album: a coin takes the figure of the list row with the same year and value; when a year
# has several coins of one value, the row whose subject shares the most words with the Numista title.
import re, sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import wikitable
from build_canada import wikitext

VALUE = {'1 ruble': 'רובל', '3 rubles': '3 רובל', '5 rubles': '5 רובל', '10 rubles': '10 רובל',
         '10 copecks': '10 קופייקות', '15 copecks': '15 קופייקות', '20 copecks': '20 קופייקות', '50 copecks': '50 קופייקות'}
STOP = set('the of and in a to anniversary anniv th years year birth soviet ussr union'.split())

def words(s):
    return {w for w in re.findall(r'[a-z]{3,}', s.lower()) if w not in STOP}

def rows():
    text = wikitext('List of commemorative coins of the Soviet Union')
    cap, head, body = next(iter(wikitable.tables(text)))   # the first table: base-metal coins for circulation
    out = []
    for r in body:
        if len(r) < 5 or not r[0][:4].isdigit(): continue
        n = re.search(r'\d[\d,]*', r[4])
        proof = re.search(r'\(([\d,]+)', r[4])
        out.append(dict(y=int(r[0][:4]), value=VALUE.get(r[1].strip().lower(), r[1]), words=words(r[2] + ' ' + r[3]), text=r[2],
                        n=int(n.group(0).replace(',', '')) if n else None, proof=int(proof.group(1).replace(',', '')) if proof else None))
    return out

def enrich(items):
    src, done = rows(), 0
    for it in items:
        if not it.get('commemorative') or it.get('mintage') or it.get('proof'): continue
        cands = [r for r in src if r['y'] == it['y'] and it['label'].startswith(r['value'] + ' ')]
        if len(cands) > 1:
            title = it.get('note', '')
            best = max(cands, key=lambda r: len(r['words'] & words(title)))
            cands = [best] if len(best['words'] & words(title)) > 0 else []
        if len(cands) == 1 and cands[0]['n']:
            r = cands[0]
            it['mintage'] = r['n'] - (r['proof'] or 0) if r['proof'] and r['proof'] < r['n'] else r['n']
            if r['proof']: it['mintageProof'] = r['proof']
            it['note'] += ' כמות ההטבעה: ויקיפדיה האנגלית, רשימת מטבעות ההנצחה של ברית המועצות.'
            done += 1
    return done
