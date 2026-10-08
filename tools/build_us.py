# Builds the US coin catalog (catalogs/us.json + shards per denomination in catalogs/us/) from tools/data/us_sources.json.
# One item per type, year and mint. Proofs and collector issues are kept with proof: true (hidden unless chosen in the
# album settings). Major catalogued varieties and famous errors are added from a curated list (see VARIETIES).
import io, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from us_notes_he import note_he
SRC = os.path.join(HERE, 'data', 'us_sources.json')
OUTDIR = os.path.join(HERE, '..', 'catalogs')

GROUPS = [('hc', 'חצי סנט'), ('c1', 'סנט'), ('c2', '2 סנט'), ('c3s', '3 סנט כסף'), ('c3n', '3 סנט ניקל'), ('hd', 'חצי דיים'),
          ('n5', 'ניקל (5 סנט)'), ('d10', 'דיים (10 סנט)'), ('c20', '20 סנט'), ('q25', 'רבע דולר'), ('h50', 'חצי דולר'), ('d1', 'דולר')]

SILVER90 = ('silver', 'כסף 900', '90% כסף, 10% נחושת')
CLAD = ('cuni', 'קופרו-ניקל על ליבת נחושת', 'שכבות קופרו-ניקל על ליבת נחושת')
GOLDEN = ('ngold', 'פליז מנגן', 'ציפוי פליז-מנגן על ליבת נחושת')

# (test on "page | caption", group, series key, Hebrew series, (metal, metalName, composition), diameter mm, weight g)
SERIES = [
    (r'Flowing Hair large cent', 'c1', 'lc-fh', 'סנט גדול "שיער גולש"', ('copper', 'נחושת', 'נחושת'), 27, 13.48),
    (r'Liberty Cap large cent', 'c1', 'lc-lcap', 'סנט גדול "כובע החירות"', ('copper', 'נחושת', 'נחושת'), 29, 13.48),
    (r'Draped Bust large cent', 'c1', 'lc-db', 'סנט גדול "חזה עטוף"', ('copper', 'נחושת', 'נחושת'), 29, 10.89),
    (r'Classic Head large cent', 'c1', 'lc-ch', 'סנט גדול "ראש קלאסי"', ('copper', 'נחושת', 'נחושת'), 29, 10.89),
    (r'Matron Head large cent', 'c1', 'lc-cor', 'סנט גדול "קורונט"', ('copper', 'נחושת', 'נחושת'), 28.5, 10.89),
    (r'Braided Hair large cent', 'c1', 'lc-bh', 'סנט גדול "שיער קלוע"', ('copper', 'נחושת', 'נחושת'), 27.5, 10.89),
    (r'Flying Eagle cent', 'c1', 'fe', 'סנט "נשר מעופף"', ('cuni', 'קופרו-ניקל', '88% נחושת, 12% ניקל'), 19, 4.67),
    (r'No shield on reverse, 1859|Shield on reverse, 1860', 'c1', 'ih-cn', 'סנט "ראש אינדיאני" (ניקל)', ('cuni', 'קופרו-ניקל', '88% נחושת, 12% ניקל'), 19, 4.67),
    (r'Shield on reverse, 1864–1909', 'c1', 'ih', 'סנט "ראש אינדיאני"', ('copper', 'ברונזה', '95% נחושת, 5% בדיל ואבץ'), 19, 3.11),
    (r'Wartime cent, 1943', 'c1', 'lw-steel', 'סנט לינקולן מפלדה', ('steel', 'פלדה מצופה אבץ', 'פלדה בציפוי אבץ'), 19, 2.70),
    (r'Wartime cent, 1944', 'c1', 'lw-brass', 'סנט לינקולן (שיבולים)', ('copper', 'פליז', '95% נחושת, 5% אבץ'), 19, 3.11),
    (r'Lincoln cent mintage figures \| (VDB on reverse|No VDB|VDB on Lincoln|Post-war wheat)', 'c1', 'lw', 'סנט לינקולן (שיבולים)', ('copper', 'ברונזה', '95% נחושת, 5% בדיל ואבץ'), 19, 3.11),
    (r'Lincoln Memorial cent, 1959|Lincoln Memorial cent, 1962', 'c1', 'lm', 'סנט לינקולן (אנדרטה)', ('copper', 'ברונזה', '95% נחושת, 5% אבץ'), 19, 3.11),
    (r'Lincoln Memorial cent, 1983', 'c1', 'lm-zn', 'סנט לינקולן (אנדרטה)', ('copper', 'אבץ מצופה נחושת', '97.5% אבץ, 2.5% נחושת'), 19, 2.5),
    (r'Bicentennial cent "Birthplace"', 'c1', 'lb1', 'סנט לינקולן 2009 "מקום הולדת"', ('copper', 'אבץ מצופה נחושת', '97.5% אבץ, 2.5% נחושת'), 19, 2.5),
    (r'Bicentennial cent "Formative', 'c1', 'lb2', 'סנט לינקולן 2009 "שנות עיצוב"', ('copper', 'אבץ מצופה נחושת', '97.5% אבץ, 2.5% נחושת'), 19, 2.5),
    (r'Bicentennial cent "Professional', 'c1', 'lb3', 'סנט לינקולן 2009 "חיים מקצועיים"', ('copper', 'אבץ מצופה נחושת', '97.5% אבץ, 2.5% נחושת'), 19, 2.5),
    (r'Bicentennial cent "Presidency', 'c1', 'lb4', 'סנט לינקולן 2009 "נשיאות"', ('copper', 'אבץ מצופה נחושת', '97.5% אבץ, 2.5% נחושת'), 19, 2.5),
    (r'Lincoln Shield cent', 'c1', 'ls', 'סנט לינקולן (מגן)', ('copper', 'אבץ מצופה נחושת', '97.5% אבץ, 2.5% נחושת'), 19, 2.5),
    (r'half cent', 'hc', 'hc', 'חצי סנט', ('copper', 'נחושת', 'נחושת'), 23.5, 5.44),
    (r'Two-cent piece', 'c2', 'c2', '2 סנט', ('copper', 'ברונזה', '95% נחושת, 5% בדיל ואבץ'), 23, 6.22),
    (r'Three-cent silver', 'c3s', 'c3s', '3 סנט כסף', ('silver', 'כסף', '75%–90% כסף'), 14, 0.75),
    (r'Three-cent nickel', 'c3n', 'c3n', '3 סנט ניקל', ('cuni', 'קופרו-ניקל', '75% נחושת, 25% ניקל'), 17.9, 1.94),
    (r'Early half dime', 'hd', 'hd-early', 'חצי דיים מוקדם', SILVER90, 16.5, 1.35),
    (r'Capped Bust half dime', 'hd', 'hd-cb', 'חצי דיים "חזה עם כיפה"', SILVER90, 15.5, 1.35),
    (r'Seated Liberty half dime', 'hd', 'hd-sl', 'חצי דיים "החירות היושבת"', SILVER90, 15.5, 1.24),
    (r'With Rays, 1866|Without Rays, 1867', 'n5', 'n-shield', 'ניקל "מגן"', ('cuni', 'קופרו-ניקל', '75% נחושת, 25% ניקל'), 20.5, 5.0),
    (r'Liberty Head V', 'n5', 'n-v', 'ניקל "ליברטי V"', ('cuni', 'קופרו-ניקל', '75% נחושת, 25% ניקל'), 21.2, 5.0),
    (r'Indian Head \(or Buffalo\)', 'n5', 'n-buf', 'ניקל "באפלו"', ('cuni', 'קופרו-ניקל', '75% נחושת, 25% ניקל'), 21.2, 5.0),
    (r'Wartime Composition', 'n5', 'n-jw', 'ניקל ג׳פרסון (מלחמה, כסף)', ('silver', 'כסף 350', '56% נחושת, 35% כסף, 9% מנגן'), 21.2, 5.0),
    (r'Westward Journey', 'n5', 'n-ww', 'ניקל ג׳פרסון "המסע מערבה"', ('cuni', 'קופרו-ניקל', '75% נחושת, 25% ניקל'), 21.2, 5.0),
    (r'Pre-War Composition|Post-War Composition|Return to Monticello', 'n5', 'n-j', 'ניקל ג׳פרסון', ('cuni', 'קופרו-ניקל', '75% נחושת, 25% ניקל'), 21.2, 5.0),
    (r'Draped Bust dime', 'd10', 'd-db', 'דיים "חזה עטוף"', SILVER90, 19, 2.7),
    (r'Capped Bust dime', 'd10', 'd-cb', 'דיים "חזה עם כיפה"', SILVER90, 18.5, 2.7),
    (r'Seated Liberty dime', 'd10', 'd-sl', 'דיים "החירות היושבת"', SILVER90, 17.9, 2.49),
    (r'Barber dime', 'd10', 'd-bar', 'דיים ברבר', SILVER90, 17.9, 2.5),
    (r'Mercury dime', 'd10', 'd-mer', 'דיים "מרקורי"', SILVER90, 17.9, 2.5),
    (r'Roosevelt.*\| Initial Composition', 'd10', 'd-r-ag', 'דיים רוזוולט (כסף)', SILVER90, 17.9, 2.5),
    (r'Roosevelt.*\| Copper-Nickel Clad', 'd10', 'd-r', 'דיים רוזוולט', CLAD, 17.9, 2.27),
    (r'Twenty-cent', 'c20', 'c20', '20 סנט', SILVER90, 22, 5.0),
    (r'quarter mintage figures \| (Small Eagle Reverse, 1796|Heraldic Eagle Reverse)', 'q25', 'q-db', 'רבע דולר "חזה עטוף"', SILVER90, 27.5, 6.74),
    (r'quarter mintage figures \| (Large diameter|Small diameter)', 'q25', 'q-cb', 'רבע דולר "חזה עם כיפה"', SILVER90, 27, 6.74),
    (r'United States quarter mintage figures \| (No drapery|No motto|Arrows|Motto)', 'q25', 'q-sl', 'רבע דולר "החירות היושבת"', SILVER90, 24.3, 6.25),
    (r'Barber quarter', 'q25', 'q-bar', 'רבע דולר ברבר', SILVER90, 24.3, 6.25),
    (r'Type 1, Exposed Breast|Type 2, Covered Breast|Type 3, Recessed', 'q25', 'q-sl2', 'רבע דולר "החירות העומדת"', SILVER90, 24.3, 6.25),
    (r'Gold centennial', 'q25', 'q-gold', 'רבע דולר "החירות העומדת" (זהב, 2016)', ('gold', 'זהב', '99.99% זהב'), 22, 7.78),
    (r'Washington quarter mintage figures \| Eagle reverse, 1932', 'q25', 'q-w-ag', 'רבע דולר וושינגטון (כסף)', SILVER90, 24.3, 6.25),
    (r'Washington quarter mintage figures \| (Eagle reverse, 1965|Eagle reverse, 1977)', 'q25', 'q-w', 'רבע דולר וושינגטון', CLAD, 24.3, 5.67),
    (r'Bicentennial reverse, 1976', 'q25', 'q-w76', 'רבע דולר וושינגטון — 200 שנה (1776–1976)', CLAD, 24.3, 5.67),
    (r'Washington Crossing the Delaware', 'q25', 'q-w21', 'רבע דולר וושינגטון "חציית הדלוור"', CLAD, 24.3, 5.67),
    (r'50 State quarter', 'q25', 'q-st', 'רבע דולר מדינות', CLAD, 24.3, 5.67),
    (r'District of Columbia reverse|Puerto Rico reverse|Guam reverse|American Samoa reverse|Virgin Islands reverse|Mariana Islands reverse', 'q25', 'q-dc', 'רבע דולר טריטוריות', CLAD, 24.3, 5.67),
    (r'America the Beautiful', 'q25', 'q-atb', 'רבע דולר פארקים לאומיים', CLAD, 24.3, 5.67),
    (r'American Women quarters', 'q25', 'q-aw', 'רבע דולר נשים אמריקאיות', CLAD, 24.3, 5.67),
    (r'half dollar mintage figures \| (Small eagle reverse, 1796|Small eagle reverse, 1796-1797)', 'h50', 'h-early', 'חצי דולר "שיער גולש / חזה עטוף"', SILVER90, 32.5, 13.48),
    (r'half dollar mintage figures \| Heraldic eagle', 'h50', 'h-db', 'חצי דולר "חזה עטוף"', SILVER90, 32.5, 13.48),
    (r'Lettered Edge|Reeded Edge', 'h50', 'h-cb', 'חצי דולר "חזה עם כיפה"', SILVER90, 32.5, 13.48),
    (r'United States half dollar mintage figures \| (No motto|Arrows|Motto)', 'h50', 'h-sl', 'חצי דולר "החירות היושבת"', SILVER90, 30.6, 12.44),
    (r'Barber half', 'h50', 'h-bar', 'חצי דולר ברבר', SILVER90, 30.6, 12.5),
    (r'Mint mark on obverse|Mint mark on reverse', 'h50', 'h-wl', 'חצי דולר "החירות הצועדת"', SILVER90, 30.6, 12.5),
    (r'Franklin', 'h50', 'h-fr', 'חצי דולר פרנקלין', SILVER90, 30.6, 12.5),
    (r'Kennedy', 'h50', 'h-k', 'חצי דולר קנדי', CLAD, 30.6, 11.34),
    (r'Early dollar', 'd1', 'd1-early', 'דולר "שיער גולש / חזה עטוף"', SILVER90, 39.5, 26.96),
    (r'Seated Liberty dollar', 'd1', 'd1-sl', 'דולר "החירות היושבת"', SILVER90, 38.1, 26.73),
    (r'Trade dollar', 'd1', 'd1-trade', 'דולר סחר', SILVER90, 38.1, 27.22),
    (r'Morgan dollar', 'd1', 'd1-mor', 'דולר מורגן', SILVER90, 38.1, 26.73),
    (r'Peace dollar', 'd1', 'd1-peace', 'דולר "שלום"', SILVER90, 38.1, 26.73),
    (r'Eisenhower', 'd1', 'd1-ike', 'דולר אייזנהאואר', CLAD, 38.1, 22.68),
    (r'Susan B. Anthony', 'd1', 'd1-sba', 'דולר סוזן ב. אנתוני', CLAD, 26.5, 8.1),
    (r'Sacagawea dollar \| Sacagawea', 'd1', 'd1-sac', 'דולר סקגאוויה', GOLDEN, 26.5, 8.1),
    (r'Native American dollar', 'd1', 'd1-na', 'דולר אינדיאני (Native American)', GOLDEN, 26.5, 8.1),
    (r'Presidential dollar', 'd1', 'd1-pres', 'דולר נשיאים', GOLDEN, 26.5, 8.1),
    (r'American Innovation', 'd1', 'd1-inn', 'דולר חדשנות אמריקאית', GOLDEN, 26.5, 8.1),
]

STATE_HE = {}   # state / park / person names stay as in the source (proper names)

# Curated major varieties and famous errors: (series key, year, mint, label, tier, note, kind)
VARIETIES = [
    ('lw', 1922, 'D', '1922 ללא D ("Plain")', 'key', 'סימן המטבעה D לא הוטבע בגלל רושמה סתומה.', 'variety'),
    ('lw', 1955, '(P)', 'Doubled Die Obverse', 'key', 'הכפלה בולטת של התאריך והכיתוב LIBERTY / IN GOD WE TRUST.', 'variety'),
    ('lw', 1936, '(P)', 'Doubled Die Obverse', 'semi-key', 'הכפלה בכיתובים בצד הפנים.', 'variety'),
    ('lm', 1960, '(P)', 'Small Date', 'semi-key', 'ספרות תאריך קטנות.', 'variety'),
    ('lm', 1960, 'D', 'Small Date', '', 'ספרות תאריך קטנות.', 'variety'),
    ('lm', 1969, 'S', 'Doubled Die Obverse', 'key', 'הכפלה בולטת בצד הפנים; ידועים מעט מאוד.', 'variety'),
    ('lm', 1970, 'S', 'Small Date (High 7)', 'semi-key', 'תאריך קטן, ה-7 גבוה.', 'variety'),
    ('lm', 1972, '(P)', 'Doubled Die Obverse', 'semi-key', 'הכפלה חזקה של התאריך והכיתובים.', 'variety'),
    ('lm-zn', 1983, '(P)', 'Doubled Die Reverse', 'semi-key', 'הכפלה בכיתובי הגב.', 'variety'),
    ('lm-zn', 1984, '(P)', 'Doubled Ear', 'semi-key', 'אוזן כפולה בדיוקן לינקולן.', 'variety'),
    ('lm-zn', 1995, '(P)', 'Doubled Die Obverse', '', 'הכפלה בכיתוב LIBERTY.', 'variety'),
    ('n-buf', 1937, 'D', '"שלוש רגליים"', 'key', 'הרגל הקדמית של הביזון חסרה בגלל ליטוש יתר של הרושמה.', 'variety'),
    ('n-buf', 1918, 'D', '8 מעל 7', 'key', 'תאריך 1918 מוטבע מעל 1917 (אוברדייט).', 'variety'),
    ('n-buf', 1916, '(P)', 'Doubled Die Obverse', 'key', 'הכפלה בולטת של התאריך.', 'variety'),
    ('n-buf', 1938, 'D', 'D מעל S', '', 'סימן המטבעה D מוטבע מעל S.', 'variety'),
    ('n-jw', 1943, 'P', '3 מעל 2', 'semi-key', 'תאריך 1943 מוטבע מעל 1942.', 'variety'),
    ('n-j', 1939, '(P)', 'Doubled MONTICELLO', 'semi-key', 'הכפלה של המילים MONTICELLO ו-FIVE CENTS בגב.', 'variety'),
    ('d-mer', 1942, '(P)', '2 מעל 1', 'key', 'תאריך 1942 מוטבע מעל 1941.', 'variety'),
    ('d-mer', 1942, 'D', '2 מעל 1', 'key', 'תאריך 1942 מוטבע מעל 1941.', 'variety'),
    ('d-r', 1982, '(P)', 'טעות: ללא P', 'semi-key', 'סימן המטבעה P חסר.', 'error'),
    ('q-sl2', 1918, 'S', '8 מעל 7', 'key', 'תאריך 1918 מוטבע מעל 1917.', 'variety'),
    ('q-st', 2004, 'D', 'Wisconsin — עלה נוסף גבוה', 'semi-key', 'עלה נוסף על קלח התירס (High Leaf).', 'variety'),
    ('q-st', 2004, 'D', 'Wisconsin — עלה נוסף נמוך', 'semi-key', 'עלה נוסף על קלח התירס (Low Leaf).', 'variety'),
    ('h-k', 1974, 'D', 'Doubled Die Obverse', '', 'הכפלה בכיתובים IN GOD WE TRUST ו-LIBERTY.', 'variety'),
    ('d1-mor', 1878, '(P)', '8 נוצות זנב', '', 'הגב הראשון של 1878 עם 8 נוצות זנב.', 'variety'),
    ('d1-mor', 1878, '(P)', '7 מעל 8 נוצות זנב', 'semi-key', 'שבע נוצות זנב מוטבעות מעל שמונה.', 'variety'),
    ('d1-sba', 1979, '(P)', 'שוליים רחבים ("Near Date")', 'semi-key', 'שוליים רחבים, התאריך קרוב לשפה.', 'variety'),
    ('d1-sac', 2000, '(P)', 'גב "Cheerios"', 'key', 'גב טיפוס אב עם נוצות זנב מפורטות, נמצא בקופסאות דגני Cheerios.', 'variety'),
    ('d1-sac', 2000, '(P)', 'טעות: "Wounded Eagle"', 'semi-key', 'פגם ברושמה שנראה כפצע בחזה הנשר.', 'error'),
    ('d1-pres', 2007, 'P', 'טעות: שפה בלי כיתוב (וושינגטון)', 'semi-key', 'הכיתוב IN GOD WE TRUST והתאריך על השפה לא הוטבעו.', 'error'),
]

# Key / Semi-Key by name even when the mintage alone does not show it.
CURATED_TIER = {('lw', 1914, 'D'): 'key', ('lw', 1931, 'S'): 'key', ('lw', 1909, 'S'): 'key', ('ih', 1877, '(P)'): 'key',
                ('d-mer', 1921, '(P)'): 'semi-key', ('d-mer', 1921, 'D'): 'semi-key', ('n-j', 1950, 'D'): 'semi-key',
                ('n-j', 1939, 'D'): 'semi-key', ('h-k', 1970, 'D'): 'semi-key', ('d-r', 1996, 'W'): 'semi-key',
                ('d1-mor', 1893, 'S'): 'key', ('d1-mor', 1889, 'CC'): 'key', ('d1-mor', 1895, '(P)'): 'key',
                ('d1-peace', 1928, '(P)'): 'key', ('d1-peace', 1934, 'S'): 'semi-key', ('lm-zn', 2009, 'S'): ''}

# Short Hebrew tags for the source comments that tell two coins of the same year and mint apart.
PHRASES = [
    (r'type 1, mound', 'טיפוס 1 (גבעה)'), (r'type 2, flat', 'טיפוס 2 (קרקע שטוחה)'), (r'chain reverse', 'גב שרשרת'), (r'wreath reverse', 'גב זר'),
    (r'lettered edge', 'שפה עם כיתוב'), (r'plain edge', 'שפה חלקה'), (r'reeded edge', 'שפה מחורצת'), (r'no "?cents"?', 'בלי CENTS'),
    (r'with "?cents"?', 'עם CENTS'), (r'small date \(high 7\)', 'תאריך קטן (7 גבוה)'), (r'large date \(low 7\)', 'תאריך גדול (7 נמוך)'),
    (r'small date, small letters', 'תאריך קטן, אותיות קטנות'), (r'medium date, large letters', 'תאריך בינוני, אותיות גדולות'),
    (r'large date', 'תאריך גדול'), (r'small date', 'תאריך קטן'), (r'closed 3', '3 סגור'), (r'open 3', '3 פתוח'), (r'filled s', 'S ממולא'),
    (r'clear s', 'S ברור'), (r'small letters', 'אותיות קטנות'), (r'large letters', 'אותיות גדולות'), (r'l on ribbon', 'L על הסרט'),
    (r'no drapery', 'בלי גלימה במרפק'), (r'drapery from elbow', 'עם גלימה במרפק'), (r'copper-plated zinc', 'אבץ'), (r'satin', 'גימור סאטן'),
    (r'special mint set', 'SMS'), (r'frosted matte', 'מט קפוא'), (r'brilliant finish', 'גימור מבריק'), (r'd over s', 'D מעל S'),
    (r'louisiana purchase', 'רכישת לואיזיאנה'), (r'keelboat', 'סירת הקיל'), (r'american bison', 'ביזון'), (r'ocean in view', 'האוקיינוס באופק'),
    (r'struck in 1975', 'הוטבע ב-1975'), (r'struck in 1976', 'הוטבע ב-1976'), (r'7 over 3', '7 מעל 3'), (r'double-die', 'DDO'),
    (r'uncirculated', 'מהדורת אספנים'),
]

def descriptor(text):
    t = text.lower(); out = []
    for rx, he in PHRASES:
        if re.search(rx, t) and he not in out:
            out.append(he)
            t = re.sub(rx, ' ', t)
    return ', '.join(out)

MINT_HE = {'P': 'פילדלפיה', '(P)': 'פילדלפיה', 'D': 'דנוור', 'S': 'סן פרנסיסקו', '(S)': 'סן פרנסיסקו', 'O': 'ניו אורלינס',
           'CC': 'קרסון סיטי', 'W': 'וסט פוינט', 'C': 'שרלוט'}

def series_for(r):
    key = r['page'] + ' | ' + r['caption']
    for rx, g, sk, he, metal, diam, w in SERIES:
        if re.search(rx, key, re.I): return g, sk, he, metal, diam, w
    return None

def slug(s, n=20):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')[:n].strip('-')

def main():
    rows = json.load(io.open(SRC, encoding='utf8'))
    # Coins struck without a mint mark at a branch mint ("(D)", "(S)", "(W)") look exactly like Philadelphia's:
    # merge them into the one unmarked coin of that year and sum the mintages.
    merged, index = [], {}
    for r in rows:
        m = (r['mint'] or '(P)').strip()
        if m.startswith('(') and m != '(P & D)':
            key = (r['page'], r['caption'], r['year'], r.get('ysuffix', ''), 'proof' in (r['comment'] or '').lower())
            if key in index:
                base = index[key]
                if r['mintage'] and base['mintage'] is not None: base['mintage'] += r['mintage']
                elif r['mintage'] is None: base['mintage'] = None
                base.setdefault('alsoAt', []).append(m.strip('()'))
                continue
            r = dict(r, mint='(P)', alsoAt=[] if m == '(P)' else [m.strip('()')])
            index[key] = r
        merged.append(r)
    rows = merged
    items, seen, unmatched = [], set(), {}
    for r in rows:
        c = r['comment'] or ''
        if re.search(r'pattern|bullion|restrike|none released|struck illegally|for collectors', c + ' ' + r['caption'], re.I):
            continue
        # off-metal strikes documented in the source (1943 bronze, 1944 steel cents) are errors, not separate years
        off_metal = re.search(r'known to exist in bronze|unique in bronze|zinc-plated steel\.\s*.*known', c, re.I)
        s = series_for(r)
        if not s:
            unmatched[r['page'] + ' | ' + r['caption']] = unmatched.get(r['page'] + ' | ' + r['caption'], 0) + 1
            continue
        g, sk, he, (metal, mname, comp), diam, weight = s
        mint = (r['mint'] or '(P)').strip()
        mint = {'': '(P)', 'P & D': 'P/D', '(P & D)': 'P/D'}.get(mint, mint)
        proof = bool(re.search(r'proof|reverse proof|enhanced|burnished|uncirculated silver|silver set|40% silver|99\.9% silver|satin|special mint set|frosted matte|^uncirculated$', c, re.I)) \
            or bool(re.search(r'99\.9% silver|silver', r.get('ysuffix', ''), re.I))
        y = r['year']
        # series extras that name the coin: state / park / woman / president / innovation
        extra = ''
        if sk in ('q-st', 'q-dc', 'q-atb', 'q-aw'):
            extra = re.sub(r'\s*reverse,.*$', '', r['caption']).strip()
        elif sk in ('d1-pres', 'd1-inn'):
            extra = r['caption'].split('—', 1)[-1].strip()
            extra = re.sub(r'\s*\((?:Manganese brass)\)\s*$', '', extra)
        elif sk == 'd1-na':
            extra = c
        elif sk == 'lw' and r['caption'].startswith('VDB on reverse'):
            extra = 'VDB'
        elif sk == 'd1-ike' and 'Bicentennial' in c:
            extra = '200 שנה, ' + ('טיפוס I' if 'Type I' in c and 'Type II' not in c else 'טיפוס II')
        mm = '' if mint.startswith('(') else mint
        label = he + (' — ' + extra if extra else '') + ' ' + str(y) + (('-' + mm) if mm else '')
        desc = descriptor(c + ' ' + r.get('ysuffix', ''))
        if proof:
            silver = re.search(r'silver', c + ' ' + r.get('ysuffix', ''), re.I)
            kind = 'פרוף כסף' if silver else 'פרוף'
            if re.search(r'reverse proof', c, re.I): kind = 'פרוף הפוך' + (' כסף' if silver else '')
            if re.search(r'enhanced', c, re.I): kind = 'Enhanced Uncirculated'
            if not re.search(r'proof', c, re.I):
                kind = 'כסף 40%' if '40%' in c or 'uncirculated silver' in c.lower() else (desc or 'מהדורת אספנים')
                desc = ''
            label += ' (' + kind + (', ' + desc if desc and desc not in kind else '') + ')'
        elif off_metal:
            metal_he = 'ברונזה' if 'bronze' in c.lower() else 'פלדה'
            label += ' — טעות: מוטבע ב' + metal_he
        elif desc:
            label += ' — ' + desc
        id_ = 'us-%s-%d-%s%s%s%s' % (sk, y, slug(mm or 'p'), ('-' + slug(extra)) if extra else '', '-pf' if proof else '',
                                      '-err-' + ('bronze' if 'bronze' in c.lower() else 'steel') if off_metal else '')
        while id_ in seen: id_ += 'x'
        seen.add(id_)
        n = r['mintage']
        tier = CURATED_TIER.get((sk, y, mint), None)
        reason = ''
        if tier is None:
            tier = ''
            if n and not proof:
                if n <= 100000: tier = 'key'
                elif n <= 500000: tier = 'semi-key'
        if tier:
            reason = ('Key Date' if tier == 'key' else 'Semi-Key') + (': ' + '{:,}'.format(n) + ' מטבעות.' if n else '.')
        note_bits = []
        if c and not proof and not desc and not re.fullmatch(r'Proof|Proof only', c) and c != extra and 'Women Quarters' not in c:
            note_bits.append('הערת המקור: ' + note_he(c).rstrip('.') + '.')
        also = list(dict.fromkeys(MINT_HE.get(m, m) for m in r.get('alsoAt', []) if m and m != 'P'))
        if also: note_bits.append('כולל מטבעות שהוטבעו ב' + ' וב'.join(also) + ' ללא סימן מטבעה (זהים למטבעות פילדלפיה).')
        if off_metal:
            tier = 'key'; reason = 'Key: טעות מתכת מפורסמת; ' + c
            note_bits = ['הוטבע בטעות על דסקית של שנה אחרת (' + c + ').']
        items.append(dict(id=id_, group=g, y=y, label=label, typeKey=sk, metal=metal, metalName=mname, composition=comp, diam=diam, weight=weight,
                          mintage=n, mintageText='' if n else (r.get('raw') or ''), mint=MINT_HE.get(mint, mint), mintMark=mm,
                          mintVariant=bool(mm) and mm not in ('P',), proof=proof, variant=False, tag=('Proof' if proof else mm),
                          rarityTier=tier, rarityReason=reason, rare=reason.split(': ', 1)[-1] if tier and n else '',
                          note=' '.join(note_bits), orientation='יישור מטבע ↑↓',
                          error=bool(off_metal), errorName=('מוטבע ב' + ('ברונזה' if 'bronze' in c.lower() else 'פלדה')) if off_metal else '',
                          errorCategory='Wrong planchet' if off_metal else ''))
        if off_metal: items[-1].update(variant=True, tag='ERR', mintage=None, mintageText=c)
    # curated varieties / errors, attached next to their base coin
    by_key = {}
    for it in items:
        if not it['proof']: by_key.setdefault((it['typeKey'], it['y'], it['mintMark'] or '(P)'), it)
    for sk, y, mint, vlabel, tier, note, kind in VARIETIES:
        base = by_key.get((sk, y, '' if mint == '(P)' else mint) if False else (sk, y, mint if mint != '(P)' else '(P)'))
        if not base:
            base = next((it for it in items if it['typeKey'] == sk and it['y'] == y and (it['mintMark'] or '(P)') == mint and not it['proof']), None)
        if not base:
            print('variety base missing', sk, y, mint, vlabel); continue
        v = dict(base); v['id'] = base['id'] + '-' + ('err' if kind == 'error' else 'var') + '-' + slug(vlabel.encode('ascii', 'ignore').decode() or str(len(seen)), 16)
        while v['id'] in seen: v['id'] += 'x'
        seen.add(v['id'])
        v.update(label=base['label'] + ' — ' + vlabel, variant=True, tag=('ERR' if kind == 'error' else 'VAR'), mintage=None,
                 mintageText='כלול בכמות של ' + base['label'] if base.get('mintage') else '', rarityTier=tier,
                 rarityReason=(('Key' if tier == 'key' else 'Semi-Key') + ': ' + note) if tier else '', rare=note, note=note,
                 error=kind == 'error', errorName=vlabel if kind == 'error' else '', errorCategory='Major error' if kind == 'error' else '')
        items.append(v)
    seen_labels = {}
    for it in items:
        k = it['label']; seen_labels[k] = seen_labels.get(k, 0) + 1
    dup = {k for k, n in seen_labels.items() if n > 1}
    count = {}
    for it in items:
        if it['label'] in dup:
            count[it['label']] = count.get(it['label'], 0) + 1
            it['label'] += ' (' + str(count[it['label']]) + ')'
    if dup: print('labels still identical (numbered):', len(dup))
    if unmatched:
        print('UNMATCHED captions:'); [print('  ', k, n) for k, n in sorted(unmatched.items())]
    # programs with a new design every issue (states, parks, presidents...): each design is its own coin type
    MULTI = {'q-st', 'q-dc', 'q-atb', 'q-aw', 'd1-pres', 'd1-inn', 'd1-na', 'n-ww'}
    for it in items:
        if it.get('typeKey') in MULTI:
            m = re.search(r' — (.+?) (?:1[789]|20)\d\d', it['label'])
            design = m.group(1) if m else (str(it['y']) if it['typeKey'] == 'd1-na' and it['y'] >= 2009 else '')
            if design: it['typeKey'] += '-' + slug(design)
    # write: one shard per group
    os.makedirs(os.path.join(OUTDIR, 'us'), exist_ok=True)
    shards, order = [], {g: k for k, (g, _) in enumerate(GROUPS)}
    for g, _ in GROUPS:
        part = sorted([i for i in items if i['group'] == g], key=lambda i: (i['y'], i['id']))
        if not part: continue
        for it in part:
            for k in [k for k, v in it.items() if v in ('', None, False) and k not in ('id', 'group', 'y', 'label')]: del it[k]
        with io.open(os.path.join(OUTDIR, 'us', g + '.json'), 'w', encoding='utf8') as f:
            json.dump({'items': part}, f, ensure_ascii=False, separators=(',', ':'))
        shards.append('catalogs/us/%s.json' % g)
    manifest = {
        'name': 'ארצות הברית', 'sub': '1793–היום, מחצי סנט ועד דולר',
        'about': 'כל מטבעות המחזור של ארה״ב לפי ערך, סוג, שנה ומטבעה (P, D, S, O, CC, W): סנטים גדולים וקטנים, ניקלים, דיימים, '
                 'רבעי דולר (כולל המדינות, הפארקים והנשים), חצאי דולר ודולרים. וריאנטים ושגיאות מפורסמים (1955 DDO, 1937-D "שלוש רגליים" ועוד), '
                 'מטבעות פרוף (מוסתרים כברירת מחדל) ו-Key / Semi-Key.',
        'theme': 'file', 'groupLabel': 'ערך', 'groups': [{'key': g, 'name': n} for g, n in GROUPS],
        'defaultSort': {'by': 'group'},
        'sources': ['Wikipedia (en) — US coin mintage figure articles (cents, nickels, Roosevelt dime, quarters, half dollars, Kennedy, Morgan, Peace, Sacagawea, Presidential, 2c, 3c silver, 20c, Eisenhower)',
                    'Wikipedia (ru) — mintage tables for early and Seated Liberty coinage, Barber and Mercury dimes, half dimes, half cents, three-cent nickel, early, Seated and Trade dollars'],
        'catalogVersion': '2026-10-05-1', 'shards': shards,
    }
    with io.open(os.path.join(OUTDIR, 'us.json'), 'w', encoding='utf8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    import collections
    print('us:', len(items), 'items', dict(collections.Counter(i['group'] for i in items)))
    print('proof', sum(bool(i.get('proof')) for i in items), 'variants', sum(bool(i.get('variant')) for i in items),
          'key', sum(i.get('rarityTier') == 'key' for i in items), 'semi', sum(i.get('rarityTier') == 'semi-key' for i in items))

if __name__ == '__main__':
    main()
