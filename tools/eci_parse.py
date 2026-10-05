# Parses the euro-coins.info mintage pages (one table per country) into
# { year, mint, note, totals: {denom: n | 's' | None}, cc: [n...], circ: {...}, proof: {...} } rows.
import html, io, re

DENOMS = ['1c', '2c', '5c', '10c', '20c', '50c', '1€', '2€']

def cells(row):
    out = []
    for m in re.finditer(r'<t([dh])([^>]*)>(.*?)</t[dh]>', row, re.S):
        txt = html.unescape(re.sub(r'<[^>]+>', ' ', m.group(3)))
        out.append(re.sub(r'\s+', ' ', txt).strip())
    return out

def number(s):
    s = (s or '').strip()
    if not s or set(s) <= set('-–— '): return None
    d = re.sub(r'[^\d]', '', s)
    return int(d) if d else None

def parse(path):
    h = io.open(path, encoding='utf8', errors='replace').read()
    i = h.find('<table'); j = h.find('</table>', i)
    rows = [cells(r) for r in re.findall(r'<tr[^>]*>(.*?)</tr>', h[i:j], re.S)]
    head = rows[0]
    col = {name: k for k, name in enumerate(head)}
    cc_cols = [k for k, name in enumerate(head) if name.startswith('2€ CC')]
    issue_col = col.get('выпуск'); q_col = col.get('кач-во')
    out, cur = [], None
    for r in rows[1:]:
        if len(r) < len(head) - 1: continue
        if re.match(r'^\d{4}$', r[0]):
            cur = {'year': int(r[0]), 'mint': r[1], 'note': r[issue_col] if issue_col is not None and issue_col < len(r) else '',
                   'totals': {d: number(r[col[d]]) for d in DENOMS if d in col},
                   'cc': [number(r[k]) for k in cc_cols], 'circ': {}, 'proof': {}, 'bu': {}}
            out.append(cur)
        elif cur is not None:
            q = r[q_col] if q_col is not None and q_col < len(r) else ''
            kind = r[issue_col] if issue_col is not None and issue_col < len(r) else ''
            vals = {d: number(r[col[d]]) for d in DENOMS if d in col}
            if q == 'UNC' and not kind:                       # the circulation strike (not a set)
                cur['circ'] = vals
            elif q == 'Proof':
                for d, v in vals.items():
                    if v: cur['proof'][d] = cur['proof'].get(d, 0) + v
            elif q in ('BU', 'UNC'):
                for d, v in vals.items():
                    if v: cur['bu'][d] = cur['bu'].get(d, 0) + v
    return out

if __name__ == '__main__':
    import sys, glob, os, collections
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf8', errors='replace')
    for p in sorted(glob.glob(os.path.join(sys.argv[1], '*.html'))):
        rows = parse(p)
        mints = collections.Counter(r['mint'] for r in rows)
        notes = collections.Counter(r['note'] for r in rows if r['note'])
        print(os.path.basename(p), len(rows), 'years', min(r['year'] for r in rows), '-', max(r['year'] for r in rows),
              '| mints', dict(mints), '| notes', dict(notes))
