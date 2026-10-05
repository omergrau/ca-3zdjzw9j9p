# Builds catalogs/pruta.json from Numista type pages (collected page by page, see pruta_raw.json).
# Item ids of the earlier catalog are kept so collections, notes and photos stay attached.
import json, io, os

OUT = r'D:\עומר\coin-album\catalogs\pruta.json'

ALIGN = 'יישור מדליה ↑↑'
HEATON = 'Heaton, בירמינגהם'
ICI = 'ICI, קינגס נורטון'
KN = 'קינגס נורטון'
IL = 'מטבעת ממשלת ישראל'

def coin(id, group, y, label, typeKey, metal, metalName, composition, weight, diam, thickness, catalog, edge,
         mintage=None, mint='', variant=False, tag='', rare='', note='', rarityTier='', rarityReason='',
         mintageText='', mintageProof=None, shape=''):
    it = dict(id=id, group=group, y=y, label=label, denomination=GROUPS[group], typeKey=typeKey,
              metal=metal, metalName=metalName, composition=composition, weight=weight, diam=diam, thickness=thickness,
              mintage=mintage, mintageText=mintageText, mint=mint, mintMark='', mintVariant=False,
              variant=variant, tag=tag, catalog=catalog, edge=edge, orientation=ALIGN,
              error=False, errorName='', errorCategory='', rarityTier=rarityTier, rarityReason=rarityReason,
              commemorative=False, rare=rare, note=note)
    if mintageProof: it['mintageProof'] = mintageProof
    return it

GROUPS = {'m25': '25 מיל', 'p1': '1 פרוטה', 'p5': '5 פרוטה', 'p10': '10 פרוטה', 'p25': '25 פרוטה',
          'p50': '50 פרוטה', 'p100': '100 פרוטה', 'p250': '250 פרוטה', 'p500': '500 פרוטה'}

ALU = ('alu', 'אלומיניום', '97% אלומיניום, 3% מגנזיום')
BRONZE = ('bronze', 'ארד', '95% נחושת, 3% בדיל, 2% אבץ')
CUNI = ('cuni', 'קופרו-ניקל', '75% נחושת, 25% ניקל')
STEEL_NI = ('cuni', 'פלדה מצופה ניקל', 'פלדה בציפוי ניקל')
SILVER500 = ('silver', 'כסף 500', '50% כסף, 37.5% נחושת, 12.5% ניקל')

PEARL = 'פנינה: נקודה קטנה מתחת לענף הזית שמשמאל לגפן, סימן ההטבעה של ICI / קינגס נורטון.'

items = [
    # 25 mil (Anglo-Palestine Bank issue, before the pruta)
    coin('m25-1948', 'm25', 1948, '25 מיל תש״ח (1948)', 'm25', *ALU, 3.8, 30, None, 'KM# 8', 'חלק', 42650, 'חולון',
         rare='42,650 מטבעות בלבד — המטבע הראשון של מדינת ישראל.', rarityTier='key',
         rarityReason='Key Date: הטבעה ראשונה של 42,650 מטבעות בלבד (1948).',
         note='הונפק על ידי בנק אנגלו-פלשתינה. הוצא מתוקף ב-6 בספטמבר 1950.'),
    coin('m25-1948-uniface', 'm25', 1948, '25 מיל תש״ח (1948) — חד-צדדי', 'm25', *ALU, 3.8, 30, None, 'KM# 8', 'חלק', None, 'חולון',
         variant=True, tag='חד-צדדי', mintageText='עשרות בודדות', rare='הוטבעו עשרות בודדות בלבד.', rarityTier='key',
         rarityReason='הוטבע צד הגב בלבד; עשרות בודדות ידועות.', note='הוטבע רק צד אחד (הגב).'),
    coin('m25-1949', 'm25', 1949, '25 מיל תש״ט (1949) — שרשרת פתוחה', 'm25', *ALU, 3.8, 30, None, 'KM# 8', 'חלק', 650000, 'חולון',
         note='650,000 מטבעות (כולל הווריאנטים של אותה שנה).', rarityTier='semi-key',
         rarityReason='Semi-Key: 650,000 מטבעות לכל השנה, כולל הווריאנטים.'),
    coin('m25-1949-closed', 'm25', 1949, '25 מיל תש״ט (1949) — שרשרת סגורה', 'm25', *ALU, 3.8, 30, None, 'KM# 8', 'חלק', None, 'ירושלים',
         variant=True, tag='שרשרת סגורה', mintageText='כלול ב-650,000 של אותה שנה'),
    coin('m25-1949-straight', 'm25', 1949, '25 מיל תש״ט (1949) — עלים חתוכים ישר', 'm25', *ALU, 3.8, 30, None, 'KM# 8', 'חלק', None, 'חולון',
         variant=True, tag='עלים ישרים', mintageText='כלול ב-650,000 של אותה שנה'),

    # 1 pruta
    coin('1-1949', 'p1', 1949, '1 פרוטה תש״ט (1949)', 'p1', *ALU, 1.3, 21, 1.59, 'KM# 9', 'חלק', 2500000, HEATON,
         note='ללא פנינה.', mintageProof=20000),
    coin('1-1949p', 'p1', 1949, '1 פרוטה תש״ט (1949) — עם פנינה', 'p1', *ALU, 1.3, 21, 1.59, 'KM# 9', 'חלק', 2660000, ICI,
         variant=True, tag='פנינה', note=PEARL),
    coin('1-1949p-pl', 'p1', 1949, '1 פרוטה תש״ט (1949) — עם פנינה, Prooflike', 'p1', *ALU, 1.3, 21, 1.59, 'KM# 9', 'חלק', None, ICI,
         variant=True, tag='PL', mintageText='כלול ב-2,660,000 של הפנינה', note='גימור מבריק דמוי פרוף. ' + PEARL),

    # 5 pruta
    coin('5-1949', 'p5', 1949, '5 פרוטה תש״ט (1949)', 'p5', *BRONZE, 3.2, 20, 1.5, 'KM# 10', 'חלק', 5000000, HEATON,
         note='ללא פנינה.', mintageProof=25000),
    coin('5-1949p', 'p5', 1949, '5 פרוטה תש״ט (1949) — עם פנינה', 'p5', *BRONZE, 3.2, 20, 1.5, 'KM# 10', 'חלק', 5070000, ICI,
         variant=True, tag='פנינה', note=PEARL),

    # 10 pruta
    coin('10-1949', 'p10', 1949, '10 פרוטה תש״ט (1949)', 'p10-1949', *BRONZE, 6.1, 27, 1.52, 'KM# 11', 'חלק', 7500000, HEATON,
         note='ללא פנינה.', mintageProof=20000),
    coin('10-1949p', 'p10', 1949, '10 פרוטה תש״ט (1949) — עם פנינה', 'p10-1949', *BRONZE, 6.1, 27, 1.52, 'KM# 11', 'חלק', 7428000, ICI,
         variant=True, tag='פנינה', note=PEARL),
    coin('10-1952', 'p10', 1952, '10 פרוטה תשי״ב (1952)', 'p10-1952', *ALU, 1.6, 24.5, 1.54, 'KM# 17', 'חלק', 26042000, KN,
         note='מטבע מסולסל (12 שקעים).'),
    coin('10-1957', 'p10', 1957, '10 פרוטה תשי״ז (1957)', 'p10-1957', *ALU, 1.6, 24.5, 1.5, 'KM# 20', 'חלק', 1000000, IL,
         rarityTier='semi-key', rarityReason='Semi-Key: מיליון מטבעות בלבד, השנה האחרונה של הסדרה.'),
    coin('10-1957c', 'p10', 1957, '10 פרוטה תשי״ז (1957) — אלומיניום מצופה נחושת', 'p10-1957', 'bronze', 'אלומיניום מצופה נחושת',
         'אלומיניום בציפוי נחושת', 1.6, 24.5, 1.6, 'KM# 20a', 'חלק', 1088000, IL, variant=True, tag='מצופה נחושת',
         rarityTier='semi-key', rarityReason='Semi-Key: 1,088,000 מטבעות; קשה למצוא במצב טוב בגלל שחיקת הציפוי.'),

    # 25 pruta
    coin('25-1949', 'p25', 1949, '25 פרוטה תש״ט (1949)', 'p25', *CUNI, 2.8, 19.5, 1.32, 'KM# 12', 'מחורץ', 2500000, HEATON,
         note='ללא פנינה.', mintageProof=20000),
    coin('25-1949p', 'p25', 1949, '25 פרוטה תש״ט (1949) — עם פנינה', 'p25', *CUNI, 2.8, 19.5, 1.32, 'KM# 12', 'מחורץ', 10520000, ICI,
         variant=True, tag='פנינה', note=PEARL),
    coin('25-1954', 'p25', 1954, '25 פרוטה תשי״ד (1954) — פלדה', 'p25', *STEEL_NI, 2.5, 19.5, 1.3, 'KM# 12a', 'חלק', 3697374, IL),

    # 50 pruta
    coin('50-1949', 'p50', 1949, '50 פרוטה תש״ט (1949)', 'p50', *CUNI, 5.69, 23.5, 1.76, 'KM# 13.1', 'מחורץ', 6000000, HEATON,
         note='ללא פנינה.', mintageProof=20000),
    coin('50-1949p', 'p50', 1949, '50 פרוטה תש״ט (1949) — עם פנינה', 'p50', *CUNI, 5.69, 23.5, 1.76, 'KM# 13.1', 'מחורץ', 6020000, KN,
         variant=True, tag='פנינה', note=PEARL),
    coin('50-1954', 'p50', 1954, '50 פרוטה תשי״ד (1954) — שפה חלקה', 'p50', *CUNI, 5.69, 23.5, 1.76, 'KM# 13.2', 'חלק', 4500000, 'תל אביב'),
    coin('50-1954a', 'p50', 1954, '50 פרוטה תשי״ד (1954) — שפה מחורצת', 'p50', *CUNI, 5.69, 23.5, 1.76, 'KM# 13.1', 'מחורץ', 250000, 'תל אביב',
         variant=True, tag='מחורץ', rare='250,000 מטבעות בלבד.', rarityTier='key',
         rarityReason='Key Date: 250,000 מטבעות בלבד עם שפה מחורצת בשנת 1954.'),
    coin('50-1954s', 'p50', 1954, '50 פרוטה תשי״ד (1954) — פלדה', 'p50', *STEEL_NI, 5, 23.6, 1.76, 'KM# 13.2a', 'חלק', 17773633, IL),

    # 100 pruta
    coin('100-1949', 'p100', 1949, '100 פרוטה תש״ט (1949)', 'p100-cuni', *CUNI, 11.3, 28.5, 2.4, 'KM# 14', 'מחורץ', 6082000, HEATON + ' וקינגס נורטון',
         mintageProof=20000),
    coin('100-1954', 'p100', 1954, '100 פרוטה תשי״ד (1954) — פלדה', 'p100-steel', *STEEL_NI, 7.22, 25.6, 2.27, 'KM# 18', 'חלק', 720000, IL,
         rarityTier='semi-key', rarityReason='Semi-Key: 720,000 מטבעות בלבד.'),
    coin('100-1954b', 'p100', 1954, '100 פרוטה תשי״ד (1954) — פלדה, KM# 19', 'p100-steel', *STEEL_NI, 7.22, 25.6, 2.27, 'KM# 19', 'חלק', None, IL,
         variant=True, tag='KM# 19', mintageText='לא פורסמה כמות נפרדת', note='רשום בקטלוגים כטיפוס נפרד של אותה שנה ומתכת.'),
    coin('100-1954-cuni', 'p100', 1954, '100 פרוטה תשי״ד (1954) — קופרו-ניקל', 'p100-steel', *CUNI, 7.5, 25.6, 2.27, 'KM# 18.1', 'חלק', 250, IL,
         variant=True, tag='קופרו-ניקל', rare='250 מטבעות בלבד.', rarityTier='key',
         rarityReason='Key: 250 מטבעות בלבד, לא הוכנס למחזור.', note='הוטבע בקופרו-ניקל במקום פלדה ולא הוכנס למחזור.'),
    coin('100-1955', 'p100', 1955, '100 פרוטה תשט״ו (1955)', 'p100-cuni', *CUNI, 11.3, 28.5, 2.4, 'KM# 14', 'מחורץ', 5867674, 'תל אביב'),

    # 250 pruta
    coin('250-1949', 'p250', 1949, '250 פרוטה תש״ט (1949)', 'p250', *CUNI, 14.1, 32.2, 2.3, 'KM# 15', 'מחורץ', 524000, HEATON,
         note='ללא פנינה.', rarityTier='semi-key', rarityReason='Semi-Key: 524,000 מטבעות בלבד בגרסה ללא פנינה.'),
    coin('250-1949p', 'p250', 1949, '250 פרוטה תש״ט (1949) — עם פנינה', 'p250', *CUNI, 14.1, 32.2, 2.3, 'KM# 15', 'מחורץ', 1496000, ICI,
         variant=True, tag='פנינה', note=PEARL),
    coin('250-1949h', 'p250', 1949, '250 פרוטה תש״ט (1949) — כסף, H', 'p250-silver', *SILVER500, 14.4, 32.2, None, 'KM# 15a', 'מחורץ', 44125, HEATON,
         tag='כסף H', rare='44,125 מטבעות בלבד.', rarityTier='key', rarityReason='Key: 44,125 מטבעות כסף בלבד.',
         note='גרסת כסף עם סימן המטבעה H (Heaton). לא הוכנס למחזור.'),

    # 500 pruta
    coin('500-1949', 'p500', 1949, '500 פרוטה תש״ט (1949) — כסף', 'p500', *SILVER500, 25.0, 37.1, None, 'KM# 16', '', 33812, HEATON,
         rare='33,812 מטבעות בלבד.', rarityTier='key', rarityReason='Key: 33,812 מטבעות בלבד.',
         note='מטבע הכסף הגדול של הסדרה. לא הוכנס למחזור.'),
]

data = {
    'name': 'מטבעות הפרוטה',
    'sub': '1948–1960, תש״ח–תשי״ז',
    'about': 'מטבעות ישראל הראשונים: 25 המיל של בנק אנגלו-פלשתינה (1948–1949) וסדרת הפרוטה (1949–1957). כל ערך בכל שנה, '
             'וריאנטים קטלוגיים (פנינה, שפה מחורצת או חלקה, שרשרת פתוחה/סגורה), החלפות המתכת של 1952–1957, מטבעות הכסף, '
             'וסימון Key / Semi-Key לפי כמויות ההטבעה.',
    'theme': 'file', 'groupLabel': 'ערך',
    'groups': [{'key': k, 'name': v} for k, v in GROUPS.items()],
    'sources': ['Numista — Israel, Palestine Pound (1948–1949) and Pound (1949–1960): types, dated issues, varieties and mintages'],
    'catalogVersion': '2026-10-05-1',
    'items': items,
}
ids = [i['id'] for i in items]
assert len(ids) == len(set(ids)), 'duplicate ids'
with io.open(OUT, 'w', encoding='utf8') as f:
    json.dump(data, f, ensure_ascii=False, indent=1)
print('pruta:', len(items), 'items,', sum(1 for i in items if i['variant']), 'variants,',
      sum(1 for i in items if i['rarityTier'] == 'key'), 'key,', sum(1 for i in items if i['rarityTier'] == 'semi-key'), 'semi')
