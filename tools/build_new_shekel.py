# Builds catalogs/new-shekel.json from Numista type pages (raw dump: tools/data/new_shekel_numista.json,
# collected page by page). Every dated row becomes an album item; same-year rows become varieties,
# "coin alignment" rows become optional errors, set-only Hanukkah years are kept with their tiny mintages.
import io, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'data', 'new_shekel_numista.json')
OUT = os.path.join(HERE, '..', 'catalogs', 'new-shekel.json')

GROUPS = [('a1', '1 אגורה'), ('a5', '5 אגורות'), ('a10', '10 אגורות'), ('s05', '½ שקל חדש'), ('s1', '1 שקל חדש'),
          ('s2', '2 שקלים חדשים'), ('s5', '5 שקלים חדשים'), ('s10', '10 שקלים חדשים'),
          ('hanukkah', 'מטבעות חנוכה'), ('comm', 'מטבעות זיכרון במחזור')]
GNAME = dict(GROUPS)

# Numista type -> (group, denomination text, type key, Hebrew series note)
TYPES = {
    '1717': ('a1', '1 אגורה', 'a1', ''),
    '1716': ('a5', '5 אגורות', 'a5', ''),
    '1715': ('a10', '10 אגורות', 'a10', ''),
    '360735': ('a10', '10 אגורות', 'a10-n', 'סדרת 2022, עם עדכון הכיתוב בערבית.'),
    '1720': ('s05', '½ שקל חדש', 's05', ''),
    '360736': ('s05', '½ שקל חדש', 's05-n', 'סדרת 2022, עם עדכון הכיתוב בערבית.'),
    '1076': ('s1', '1 שקל חדש', 's1-cuni', 'קופרו-ניקל, בלי עיגול מתחת לסמל.'),
    '7078': ('s1', '1 שקל חדש', 's1-steel', 'פלדה מצופה ניקל, עם עיגול מתחת לסמל.'),
    '376574': ('s1', '1 שקל חדש', 's1-n', 'סדרת 2022, עם עדכון הכיתוב בערבית.'),
    '5579': ('s2', '2 שקלים חדשים', 's2', ''),
    '433850': ('s2', '2 שקלים חדשים', 's2-n', 'סדרת 2022, עם עדכון הכיתוב בערבית.'),
    '3327': ('s5', '5 שקלים חדשים', 's5', ''),
    '360737': ('s5', '5 שקלים חדשים', 's5-n', 'סדרת 2022, עם עדכון הכיתוב בערבית.'),
    '2720': ('s10', '10 שקלים חדשים', 's10', ''),
    '359417': ('s10', '10 שקלים חדשים', 's10-n', 'סדרת 2022, עם עדכון הכיתוב בערבית.'),
    # Hanukkah circulating commemoratives
    '10240': ('hanukkah', '1 אגורה', 'h-a1', 'חנוכה'),
    '7080': ('hanukkah', '5 אגורות', 'h-a5', 'חנוכה'),
    '7081': ('hanukkah', '10 אגורות', 'h-a10', 'חנוכה'),
    '7079': ('hanukkah', '½ שקל חדש', 'h-s05', 'חנוכה'),
    '9575': ('hanukkah', '1 שקל חדש', 'h-s1', 'חנוכה'),
    '11414': ('hanukkah', '5 שקלים חדשים', 'h-s5', 'חנוכה'),
    # other circulating commemoratives
    '2055': ('comm', '½ שקל חדש', 'c-rothschild', 'אדמונד דה רוטשילד'),
    '35056': ('comm', '1 אגורה', 'c-40-a1', '40 שנה למדינה'),
    '35057': ('comm', '5 אגורות', 'c-40-a5', '40 שנה למדינה'),
    '9576': ('comm', '10 אגורות', 'c-40-a10', '40 שנה למדינה'),
    '23262': ('comm', '½ שקל חדש', 'c-40-s05', '40 שנה למדינה'),
    '34794': ('comm', '1 שקל חדש', 'c-40-s1', '40 שנה למדינה'),
    '15971': ('comm', '1 שקל חדש', 'c-rambam', 'הרמב״ם'),
    '6662': ('comm', '5 שקלים חדשים', 'c-eshkol', 'לוי אשכול'),
    '15972': ('comm', '5 שקלים חדשים', 'c-weizmann', 'חיים ויצמן'),
    '9597': ('comm', '10 שקלים חדשים', 'c-golda', 'גולדה מאיר'),
    '300017': ('comm', '5 שקלים חדשים', 'c-gratitude', 'תודה לצוותי הרפואה (קורונה)'),
}

# Hebrew wording for the variety rows Numista lists (type id, Gregorian year, words in the comment) -> tag, note
VARIETY_HE = [
    ('1715', 1985, 'coarse', 'מתאר ספרות גס', 'מתאר הספרות גס (שטוטגרט).'),
    ('1715', 1991, 'longer date', 'תאריך ארוך', 'תאריך ארוך, אותיות דקות, "10" גבוה.'),
    ('1715', 1991, 'short date', 'תאריך קצר', 'תאריך קצר, אותיות עבות, "10" קטן.'),
    ('1715', 1997, 'open', 'ה׳ פתוחה', 'ה׳ פתוחה ואותיות תאריך גדולות (קונגסברג).'),
    ('1715', 1997, 'closed', 'ה׳ סגורה', 'ה׳ סגורה ואותיות תאריך קטנות (אוטרכט).'),
    ('1715', 2000, 'ridges', 'רכסים', 'רכסים על המשטח השטוח.'),
    ('1715', 2001, 'rounded', 'אפס מעוגל', 'צדי החלק המרכזי של ה-0 מעוגלים.'),
    ('1715', 2001, 'straight', 'אפס ישר', 'צדי החלק המרכזי של ה-0 ישרים.'),
    ('1715', 2007, '19 larger', '19 רכסים', '19 רכסים ארוכים במקום 38 בצד הערך.'),
    ('1720', 1985, 'Trimmed', 'E קטומה', 'הקצה העליון של שתי ה-E הראשונות ב-NEW SHEQEL קטום.'),
    ('1720', 1985, 'Normal', 'E רגילה', 'E רגילה, אותיות דקות, קו שבר 4.3 מ״מ.'),
    ('1720', 2002, 'fraction line in value 4 mm', 'קו שבר 4 מ״מ', 'קו השבר בערך באורך 4 מ״מ.'),
    ('1720', 2002, '4.5 mm', 'קו שבר 4.5 מ״מ', 'אותיות עבות, קו שבר 4.5 מ״מ ועובי 0.5 מ״מ.'),
    ('3327', 1997, 'Die B', 'תבנית B', 'תבנית B, שפה בעלת 12 צלעות (ונטאה).'),
    ('3327', 1997, 'Die C', 'תבנית C', 'תבנית C, שפה מעוגלת (אוטרכט).'),
    ('3327', 1999, 'Die B', 'תבנית B', 'תבנית B, שפה בעלת 12 צלעות (קונגסברג).'),
    ('3327', 1999, 'Die C', 'תבנית C', 'תבנית C, שפה מעוגלת (אוטרכט).'),
    ('7078', 1995, 'With', 'עם ء', 'עם הסימן ء מתחת ל-ا בכיתוב הערבי إسرائيل.'),
    ('7078', 2005, 'shiny', 'מבריק', 'בדרך כלל מבריק עם שריטות.'),
    ('2720', 2002, 'smaller dots', 'נקודות קטנות', 'נקודות קטנות, ענבים בולטים, אותיות קטנות (קונגסברג).'),
    ('2720', 2010, 'larger dots', 'נקודות גדולות', 'נקודות גדולות, ענבים חלשים, טבעת פנימית צהובה.'),
    ('2720', 2013, 'inner ring obverse white, thick', 'טבעת לבנה', 'נקודות גדולות, טבעת פנימית לבנה, אותיות עבות.'),
    ('2720', 2014, 'thin letters', 'אותיות דקות', 'נקודות גדולות, טבעת פנימית לבנה, אותיות דקות.'),
]

MINTS = {'Bern': 'ברן', 'Berne': 'ברן', 'Jerusalem': 'ירושלים', 'Stuttgart': 'שטוטגרט', 'Utrecht': 'אוטרכט',
         'Winnipeg': 'ויניפג', 'Paris': 'פריז', 'Pessac': 'פסאק', 'Santiago': 'סנטיאגו', 'Kongsberg': 'קונגסברג',
         'Athens': 'אתונה', 'Daejeon': 'דג׳און', 'Warsaw': 'ורשה', 'Singapore': 'סינגפור', 'Canberra': 'קנברה',
         'Vantaa': 'ונטאה', 'Pretoria': 'פרטוריה', 'Munich': 'מינכן'}
TYPE_MINT = {'Royal Dutch Mint': 'אוטרכט', 'State Mint of Stuttgart': 'שטוטגרט', 'Jerusalem': 'ירושלים', 'Munich': 'מינכן'}

LETTERS = [(400, 'ת'), (300, 'ש'), (200, 'ר'), (100, 'ק'), (90, 'צ'), (80, 'פ'), (70, 'ע'), (60, 'ס'), (50, 'נ'),
           (40, 'מ'), (30, 'ל'), (20, 'כ'), (10, 'י'), (9, 'ט'), (8, 'ח'), (7, 'ז'), (6, 'ו'), (5, 'ה'), (4, 'ד'),
           (3, 'ג'), (2, 'ב'), (1, 'א')]

def heb_year(y):
    """5745 -> התשמ״ה"""
    n, out = y % 1000, ''
    while n >= 400: out += 'ת'; n -= 400
    if n % 100 in (15, 16): tail = 'טו' if n % 100 == 15 else 'טז'; n -= n % 100
    else: tail = ''
    for v, ch in LETTERS:
        while n >= v: out += ch; n -= v
    out += tail
    return 'ה' + (out[:-1] + '״' + out[-1] if len(out) > 1 else out + '׳')

def metal(comp):
    c = comp.lower()
    if c.startswith('bimetallic'): return 'bimetal', 'דו-מתכתי', 'ליבה מפלדה מצופה ברונזה בטבעת פלדה מצופה ניקל'
    if 'nickel plated steel' in c: return 'cuni', 'פלדה מצופה ניקל', 'פלדה בציפוי ניקל'
    if 'aluminium-nickel bronze' in c: return 'bronze', 'ברונזה-אלומיניום', '92% נחושת, 6% אלומיניום, 2% ניקל'
    if 'copper-nickel' in c: return 'cuni', 'קופרו-ניקל', '75% נחושת, 25% ניקל'
    return 'cuni', comp, comp

def num(s):
    m = re.match(r'([\d.]+)', (s or '').replace(',', '.'))
    return float(m.group(1)) if m else None

def mints_of(comment, type_mint):
    found = []
    for en, he in MINTS.items():
        if re.search(r'\b' + en + r'\b', comment) and he not in found: found.append(he)
    if not found and type_mint:
        for en, he in TYPE_MINT.items():
            if en in type_mint: found.append(he)
    return ', '.join(found)

def variety_for(tid, year, comment):
    for t, y, key, tag, note in VARIETY_HE:
        if t == tid and y == year and key in comment: return tag, note
    return None

def main():
    raw = json.load(io.open(RAW, encoding='utf8'))
    items, seen = [], set()
    for tid, (group, denom, tkey, series) in TYPES.items():
        t = raw[tid]
        f = t['feat']
        m, mname, comp = metal(f.get('Composition', ''))
        km = (f.get('References') or '').split(',')[0].strip() if f.get('References') else ''
        edge = {'Plain': 'חלק', 'Reeded': 'מחורץ'}.get((t.get('edge') or '').split(' ©')[0].strip(), 'חלק עם 4 מקטעים מחורצים' if 'notched' in (t.get('edge') or '') else '')
        align = 'יישור מטבע ↑↓' if 'Coin alignment' in f.get('Orientation', '') else 'יישור מדליה ↑↑'
        shape_note = 'מטבע בעל 12 צלעות. ' if 'Dodecagonal' in f.get('Shape', '') else ''
        rows = [r for r in t['rows'] if re.match(r'\d{4}', r[0])]
        by_year = {}
        for r in rows:
            hy = int(r[0][:4]); gy = int(re.search(r'\((\d{4})\)', r[0]).group(1))
            by_year.setdefault((hy, gy), []).append(r)
        for (hy, gy), rs in sorted(by_year.items()):
            # the base row: not an error, has the largest mintage
            def cnt(r): return int(re.sub(r'\D', '', r[1]) or 0)
            normal = [r for r in rs if 'alignment' not in r[2].lower()]
            base = max(normal, key=cnt) if normal else None
            for r in rs:
                comment = r[2]
                n = cnt(r) or None
                setonly = 'sets only' in comment.lower() or 'set)' in comment.lower() or '✡' in r[0]
                is_err = 'alignment' in comment.lower() and r is not base
                hyear = heb_year(hy)
                head = denom + (' ' + series if group in ('hanukkah', 'comm') else '')
                label = head + ' ' + hyear + ' (' + str(gy) + ')'
                id_ = tkey + '-' + str(gy) + ('-' + str(hy) if group == 'hanukkah' else '')
                tag, note, variant = '', series if group not in ('hanukkah', 'comm') else '', False
                err = dict(error=False, errorName='', errorCategory='')
                if is_err:
                    id_ += '-coin-alignment'; label += ' — טעות: יישור מטבע ↑↓'; tag = 'ERR ↑↓'; variant = True
                    err = dict(error=True, errorName='יישור מטבע במקום יישור מדליה (צד אחד הפוך)', errorCategory='Rotated dies / coin alignment')
                    note = 'הגב מוטבע הפוך ביחס לפנים (סיבוב של 180°).'
                elif r is not base and setonly:
                    id_ += '-set'; tag = 'סט'; label += ' — סט'; variant = True; note = ''
                elif r is not base:
                    v = variety_for(tid, gy, comment)
                    tag, vnote = v if v else ('וריאנט', 'תיאור הווריאנט ב-Numista: ' + comment)
                    id_ += '-v' + str(rs.index(r))
                    label += ' — ' + tag; variant = True; note = (series + ' ' if series and group not in ('hanukkah', 'comm') else '') + vnote
                else:
                    v = variety_for(tid, gy, comment)
                    if v and len(rs) > 1: tag, vnote = v; label += ' — ' + tag; note = vnote
                    elif v: note = v[1]
                if setonly and not is_err:
                    note = (note + ' ' if note else '') + 'הוטבע לסטים בלבד.'
                    tag = tag or 'סט'
                while id_ in seen: id_ += 'x'
                seen.add(id_)
                tier, reason, rare = '', '', ''
                if not is_err and n:
                    txt = '{:,}'.format(n)
                    if n <= 300000:
                        tier = 'key'; reason = 'Key: ' + txt + ' מטבעות בלבד' + (' (בסטים בלבד).' if setonly else '.'); rare = txt + ' מטבעות בלבד.'
                    elif n <= 800000 and not variant:
                        tier = 'semi-key'; reason = 'Semi-Key: ' + txt + ' מטבעות בלבד.'
                if is_err: rare = 'טעות הטבעה מתועדת.'
                items.append(dict(
                    id=id_, group=group, y=gy, label=label, denomination=denom, typeKey=tkey,
                    metal=m, metalName=mname, composition=comp, weight=num(f.get('Weight')), diam=num(f.get('Diameter')) or 20,
                    thickness=num(f.get('Thickness')), mintage=None if is_err else n, mintageText='' if n or is_err else 'לא פורסמה כמות',
                    mint=mints_of(comment, t.get('mint', '')), mintMark='', mintVariant=False, variant=variant, tag=tag,
                    catalog=km, edge=edge, orientation='יישור מטבע ↑↓' if is_err else align,
                    rarityTier=tier, rarityReason=reason, commemorative=group in ('hanukkah', 'comm'), rare=rare,
                    note=(shape_note + note).strip(), **err))
    data = {
        'name': 'השקל החדש',
        'sub': '1985–היום, התשמ״ה–',
        'about': 'כל מטבעות המחזור של השקל החדש לפי שנה: אגורה עד 10 שקלים, כולל החלפות המתכת והסדרה של 2022, '
                 'מטבעות החנוכה (כולל שנות הסטים בלבד), מטבעות הזיכרון שהונפקו למחזור, וריאנטים מתועדים, '
                 'טעויות יישור מטבע (צד הפוך) ו-Key Dates לפי כמויות ההטבעה.',
        'theme': 'file', 'groupLabel': 'ערך',
        'groups': [{'key': k, 'name': v} for k, v in GROUPS],
        'sources': ['Numista — Israel, New Shekel (1986–date): standard circulation and circulating commemorative types, dated issues, varieties and mintages'],
        'catalogVersion': '2026-10-05-1',
        'items': items,
    }
    with io.open(OUT, 'w', encoding='utf8') as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
    print('new-shekel:', len(items), 'items |', sum(i['variant'] for i in items), 'variants |', sum(i['error'] for i in items), 'errors |',
          sum(i['rarityTier'] == 'key' for i in items), 'key |', sum(i['rarityTier'] == 'semi-key' for i in items), 'semi')

if __name__ == '__main__':
    main()
