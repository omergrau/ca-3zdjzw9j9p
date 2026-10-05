# Minimal wikitext table parser: handles header rows, '|' and '||' cells, rowspan and colspan.
import re

NUMBER_TEMPLATE = re.compile(r'\{\{(?:число|num|formatnum|nts)\|([\d.,\s]+)[^}]*\}\}', re.I)

def clean(s):
    s = re.sub(r'<ref[^>]*/>|<ref.*?</ref>', '', s, flags=re.S)
    s = NUMBER_TEMPLATE.sub(lambda m: m.group(1), s)
    s = re.sub(r'\{\{val\|(?:[^|}]*=[^|}]*\|)*([\d.]+)[^}]*\}\}', lambda m: m.group(1), s, flags=re.I)
    s = re.sub(r'\{\{sortname\|([^|}]*)\|([^|}]*)[^}]*\}\}', lambda m: m.group(1) + ' ' + m.group(2), s, flags=re.I)
    s = s.replace('&nbsp;', ' ').replace(' ', ' ')
    s = re.sub(r'\{\{(?:efn|refn|sfn|r|cn|citation needed)[^}]*\}\}', '', s, flags=re.I)
    s = re.sub(r'\{\{tooltip\|[^|}]*\|([^}]*)\}\}', lambda m: m.group(1), s, flags=re.I)
    s = re.sub(r'\{\{(?:nowrap|small|lang\|[a-z-]+)\|([^}]*)\}\}', lambda m: m.group(1), s, flags=re.I)
    s = re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]*)\]\]', lambda m: m.group(1), s)
    s = re.sub(r'\[https?://\S+\s*([^\]]*)\]', lambda m: m.group(1), s)
    s = re.sub(r'<br\s*/?>', ' ', s)
    s = re.sub(r"'''?|\{\{[^}]*\}\}|<[^>]+>", '', s)
    return re.sub(r'\s+', ' ', s).strip()

def _split_cells(line, sep):
    body = line[1:]
    parts = body.split(sep + sep) if sep + sep in body else [body]
    cells = []
    for p in parts:
        attrs, txt = '', p
        # "attrs | text" (but not inside [[...|...]] or {{...|...}})
        depth, cut = 0, -1
        for i, ch in enumerate(p):
            if p.startswith('[[', i) or p.startswith('{{', i): depth += 1
            elif p.startswith(']]', i) or p.startswith('}}', i): depth -= 1
            elif ch == '|' and depth == 0: cut = i; break
        if cut >= 0 and re.search(r'(style|rowspan|colspan|align|class|width|bgcolor|scope)\s*=', p[:cut]):
            attrs, txt = p[:cut], p[cut + 1:]
        rs = re.search(r'rowspan\s*=\s*"?(\d+)', attrs); cs = re.search(r'colspan\s*=\s*"?(\d+)', attrs)
        cells.append({'text': txt.strip(), 'rowspan': int(rs.group(1)) if rs else 1, 'colspan': int(cs.group(1)) if cs else 1})
    return cells

def tables(wikitext):
    """Yields (caption, header list, rows as lists of cleaned strings) for every table, with rowspans filled in."""
    for m in re.finditer(r'^\{\|(.*?)^\|\}', wikitext, re.S | re.M):
        body = m.group(1)
        caption, header, rows, carry = '', [], [], {}
        for chunk in re.split(r'^\|-.*$', body, flags=re.M):
            hcells, dcells = [], []
            for line in chunk.split('\n'):
                if line.startswith('|+'): caption = clean(line[2:])
                elif line.startswith('!'): hcells += _split_cells(line, '!')
                elif line.startswith('|') and not line.startswith('|}'): dcells += _split_cells(line, '|')
                elif line and (hcells or dcells) and not line.startswith(('{|', '|}')):
                    (dcells or hcells)[-1]['text'] += ' ' + line
            if hcells and not dcells:
                if not header: header = [clean(c['text']) for c in hcells for _ in range(c['colspan'])]
                continue
            cells = hcells + dcells
            if not cells: continue
            row, col = [], 0
            pending = list(cells)
            while pending or col in carry:
                if col in carry:
                    txt, left = carry[col]
                    row.append(txt)
                    if left <= 1: del carry[col]
                    else: carry[col] = (txt, left - 1)
                    col += 1; continue
                c = pending.pop(0)
                txt = clean(c['text'])
                for _ in range(c['colspan']):
                    if c['rowspan'] > 1: carry[col] = (txt, c['rowspan'] - 1)
                    row.append(txt); col += 1
            rows.append(row)
        yield caption, header, rows
