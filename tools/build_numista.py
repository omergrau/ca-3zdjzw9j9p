# Generic album builder for countries scraped from Numista type pages (tools/data/<key>_numista.json).
# One album slot per date row. Groups are denominations ordered by value; the "countries" axis of the album is the
# ruler / period (king, sultan, republic...), so an album can be split by reign. Key / Semi-Key are computed in the app
# (catalog.js markSeriesKeys) from the mintages written here.
#   python tools/build_numista.py egypt
import io, json, os, re, statistics, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from build_ottoman import SULTANS, FIX_SULTAN  # Ottoman sultans appear on Egyptian, Levant and Balkan coins too

AR_DIGITS = str.maketrans('٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789')
FRAC = {'½': .5, '¼': .25, '¾': .75, '⅛': .125, '⅜': .375, '⅞': .875, '⅒': .1}
SULTAN_HE = {pre.strip(): he for pre, _, he in SULTANS}

CONFIGS = {
    'egypt': dict(
        src='egypt_numista.json', out='egypt.json', id='eg',
        name='מצרים', sub='1517–היום, מהתקופה העות׳מאנית ועד הרפובליקה',
        about='מטבעות מצרים: התקופה העות׳מאנית, הסולטנות והממלכה (חוסיין כאמל, פואד, פארוק) והרפובליקה, כולל מטבעות ההנצחה '
              'למחזור. כל תאריך ושנה, עם כמות ההטבעה כשידועה. אפשר לסדר לפי שליט / תקופה.',
        rulerLabel='👑 לפי שליט', rulersLabel='שליטים ותקופות',
        currency={'Akçe': 1 / 120 / 40, 'Piastre': 1 / 40, 'Pound': 1},  # value in pounds; ratios are given per currency unit
        units=[(r'Milli[eè]mes?', 'מיל'), (r'Piastres?|Qirsh|Qurush', 'קרש'), (r'Pounds?', 'לירה'), (r'Para', 'פארה'),
               (r'Sultani', 'סולטאני'), (r'Akce|Akçe', 'אקצ׳ה'), (r'Mangh?ir', 'מנגיר'), (r'Medin[i]?', 'מדין'), (r'Fals|Falus', 'פלס'),
               (r'Mahbub|Ma[hḥ]b[uū]b|Zeri|Zari', 'זרי מחבוב'), (r'Findik', 'פינדיק'), (r'Beshlik', 'בשליק'), (r'Altin|Altın', 'אלטין'), (r'Jadid|Cedid', 'ג׳דיד')],
        rulers=[('Hussein Kamel', 'husseinkamel', 'הסולטן חוסיין כאמל'), ('Fuad', 'fuad', 'פואד הראשון'), ('Farouk', 'farouk', 'המלך פארוק'),
                ('Republic (1953', 'rep1953', 'הרפובליקה (1953–1958)'), ('United Arab Republic', 'uar', 'הרפובליקה הערבית המאוחדת (1958–1971)'),
                ('Arab Republic of Egypt', 'are', 'הרפובליקה הערבית של מצרים (1971–)')],
        mints={'Cairo': 'קהיר', 'Misr': 'מצרים (קהיר)', 'London': 'לונדון', 'Royal Mint': 'המטבעה המלכותית', 'Birmingham': 'בירמינגהם',
               'Heaton': 'Heaton, בירמינגהם', 'Paris': 'פריז', 'Berlin': 'ברלין', 'Bombay': 'בומביי', 'Pretoria': 'פרטוריה'},
    ),
}

RU_UNITS = [(r'Polushka', 'פולושקה'), (r'Denga|Denezhka', 'דנגה'), (r'Kopecks?|Kopeks?|Kopeyka|Kopeek', 'קופייקה'), (r'Altyn', 'אלטין'),
            (r'Grivennik', 'גריבניק'), (r'Polupoltinnik', 'פולופולטיניק'), (r'Poltina|Poltinnik', 'פולטינה'), (r'Polupoltina', 'פולופולטינה'),
            (r'Roubles?|Rubles?', 'רובל'), (r'Chervonets', 'צ׳רבונץ'), (r'Imperial', 'אימפריאל'), (r'Poluimperial', 'פולואימפריאל'),
            (r'Ducat', 'דוקט'), (r'Grivna', 'גריבנה'), (r'Para', 'פארה'), (r'Zlot', 'זלוטי'), (r'Groszy|Grosz', 'גרוש')]
RU_RULERS = [('Ivan IV', 'ivan4', 'איוואן הרביעי (האיום)'), ('Peter I ', 'peter1', 'פיוטר הראשון (הגדול)'), ('Peter I (', 'peter1', 'פיוטר הראשון (הגדול)'),
             ('Catherine I ', 'catherine1', 'יקטרינה הראשונה'), ('Catherine I (', 'catherine1', 'יקטרינה הראשונה'), ('Peter II', 'peter2', 'פיוטר השני'),
             ('Anna', 'anna', 'אנה'), ('Ivan VI', 'ivan6', 'איוואן השישי'), ('Elizabeth', 'elizabeth', 'אליזבטה'), ('Peter III', 'peter3', 'פיוטר השלישי'),
             ('Catherine II', 'catherine2', 'יקטרינה השנייה (הגדולה)'), ('Paul I', 'paul1', 'פאבל הראשון'), ('Alexander I ', 'alexander1', 'אלכסנדר הראשון'),
             ('Alexander I (', 'alexander1', 'אלכסנדר הראשון'), ('Nicholas I ', 'nicholas1', 'ניקולאי הראשון'), ('Nicholas I (', 'nicholas1', 'ניקולאי הראשון'),
             ('Alexander II ', 'alexander2', 'אלכסנדר השני'), ('Alexander II (', 'alexander2', 'אלכסנדר השני'), ('Alexander III', 'alexander3', 'אלכסנדר השלישי'),
             ('Nicholas II', 'nicholas2', 'ניקולאי השני'), ('Provisional', 'provisional', 'הממשלה הזמנית (1917)'), ('Russian Republic', 'provisional', 'הממשלה הזמנית (1917)'),
             ('Russian Socialist', 'rsfsr', 'הרפובליקה הסובייטית הרוסית (1917–1922)'), ('RSFSR', 'rsfsr', 'הרפובליקה הסובייטית הרוסית (1917–1922)'),
             ('Soviet Union', 'ussr', 'ברית המועצות'), ('USSR', 'ussr', 'ברית המועצות'), ('Union of Soviet', 'ussr', 'ברית המועצות'),
             ('Russian Federation', 'rf', 'הפדרציה הרוסית'), ('Federation', 'rf', 'הפדרציה הרוסית')]
RU_MINTS = {'Saint Petersburg': 'סנקט פטרבורג', 'St. Petersburg': 'סנקט פטרבורג', 'Leningrad': 'לנינגרד', 'Moscow': 'מוסקבה', 'Ekaterinburg': 'יקטרינבורג',
            'Yekaterinburg': 'יקטרינבורג', 'Suzun': 'סוזון', 'Kolyvan': 'קוליבן', 'Warsaw': 'ורשה', 'Tiflis': 'טביליסי', 'Birmingham': 'בירמינגהם',
            'Osaka': 'אוסקה', 'Paris': 'פריז', 'Brussels': 'בריסל', 'Izhora': 'איז׳ורה', 'Sestroretsk': 'סטרורצק'}
for _key, _name, _sub, _about in (
        ('ussr', 'ברית המועצות', '1921–1991, מקופייקה ועד רובל',
         'מטבעות הרפובליקה הסובייטית הרוסית וברית המועצות: כל ערך וכל שנה, כולל רובלי ההנצחה למחזור, עם כמות ההטבעה כשידועה.'),
        ('russia', 'הפדרציה הרוסית', '1992–היום, מקופייקה ועד 25 רובל',
         'מטבעות רוסיה מ-1992: כל ערך, שנה ומטבעה (מוסקבה / סנקט פטרבורג), ומטבעות ההנצחה למחזור.'),
        ('russian_empire', 'האימפריה הרוסית', 'עד 1917, מפולושקה ועד אימפריאל',
         'מטבעות האימפריה הרוסית לפי צאר ושנה: נחושת, כסף וזהב, כולל מטבעות המטבעות המקומיות.')):
    CONFIGS[_key] = dict(src=_key + '_numista.json', out=_key.replace('_', '-') + '.json', id={'ussr': 'su', 'russia': 'ru', 'russian_empire': 're'}[_key],
                         name=_name, sub=_sub, about=_about, rulerLabel='👑 לפי שליט / תקופה', rulersLabel='שליטים ותקופות',
                         currency={'Rouble': 1, 'Ruble': 1, 'Kopeck': 0.01}, units=RU_UNITS, rulers=RU_RULERS, mints=RU_MINTS)

# British colonies: one album per colony, split by monarch. `until` drops date rows after independence when Numista's
# issuer also covers the independent state. `numista` is the issuer code the list pages were collected from.
BR_UNITS = [(r'Mohur', 'מוהר'), (r'Rupees?', 'רופי'), (r'Annas?', 'אנה'), (r'Pice|Paisa', 'פייס'), (r'Pies?\b', 'פאי'), (r'Farthings?', 'פרת׳ינג'),
            (r'Half ?pennys?|Halfpence', 'חצי פני'), (r'Threepence', 'שלושה פני'), (r'Sixpence', 'שישה פני'), (r'Pennys?|Pence', 'פני'),
            (r'Shillings?', 'שילינג'), (r'Florins?', 'פלורין'), (r'Half ?Crowns?', 'חצי קראון'), (r'Crowns?', 'קראון'), (r'Sovereigns?', 'סוברין'),
            (r'Rix ?dollars?|Rixdollar', 'ריקסדולר'), (r'Pounds?', 'לירה'), (r'Cents?', 'סנט'), (r'Dollars?', 'דולר'), (r'Mils?\b|Mills?\b', 'מיל'), (r'Piastres?', 'גרוש'),
            (r'Stuivers?|Stivers?', 'סטויבר'), (r'Bazarucos?', 'בזרוקו'), (r'Tangas?', 'טנגה'), (r'Doits?|Duits?', 'דויט'), (r'Fanams?', 'פנם'), (r'Pagodas?', 'פגודה'),
            (r'Kas\b|Cash\b', 'קאש'), (r'Tenths?', 'עשירית'), (r'Grains?', 'גריין')]
BR_RULERS = [('East India Company', 'eic', 'חברת הודו המזרחית'), ('George III', 'george3', 'ג׳ורג׳ השלישי'), ('George IV', 'george4', 'ג׳ורג׳ הרביעי'),
             ('William IV', 'william4', 'ויליאם הרביעי'), ('Victoria', 'victoria', 'המלכה ויקטוריה'), ('Edward VII ', 'edward7', 'אדוארד השביעי'),
             ('Edward VII (', 'edward7', 'אדוארד השביעי'), ('George V ', 'george5', 'ג׳ורג׳ החמישי'), ('George V (', 'george5', 'ג׳ורג׳ החמישי'),
             ('Edward VIII', 'edward8', 'אדוארד השמיני'), ('George VI', 'george6', 'ג׳ורג׳ השישי'), ('Elizabeth II', 'elizabeth2', 'המלכה אליזבת השנייה'),
             ('Dutch East India', 'voc', 'חברת הודו המזרחית ההולנדית'), ('Dutch occupation', 'voc', 'השלטון ההולנדי'),
             ('Portuguese occupation', 'portugal', 'השלטון הפורטוגלי'), ('Independent States', 'indep', 'המדינות העצמאיות (1964)')]
BR_MINTS = {'Calcutta': 'כלכותה', 'Bombay': 'בומביי', 'Madras': 'מדרס', 'Lahore': 'להור', 'Hyderabad': 'היידראבאד', 'Pretoria': 'פרטוריה',
            'London': 'לונדון', 'Royal Mint': 'המטבעה המלכותית', 'Birmingham': 'בירמינגהם', 'Heaton': 'Heaton, בירמינגהם', 'Ottawa': 'אוטווה',
            'Melbourne': 'מלבורן', 'Sydney': 'סידני', 'Perth': 'פרת׳', 'Kings Norton': 'קינגס נורטון', 'Colombo': 'קולומבו', 'Paris': 'פריז'}
for _key, _src, _id, _name, _sub, _about, _cur, _to in (
        ('br_india', 'inde_britannique', 'bi', 'הודו הבריטית', '1835–1947, מפאי ועד מוהר',
         'מטבעות הודו תחת חברת הודו המזרחית והכתר הבריטי: נחושת, כסף וזהב, לפי מלך ושנה, עם כמות ההטבעה כשידועה.',
         {'Rupee': 1, 'Mohur': 15}, 1947),
        ('br_ceylon', 'ceylon_period', 'cy', 'ציילון', 'עד 1972, מהשלטון ההולנדי ועד הדומיניון',
         'מטבעות ציילון (סרי לנקה) מתקופת חברת הודו המזרחית ההולנדית, השלטון הבריטי והדומיניון, עד הרפובליקה ב-1972.',
         {'Rupee': 1, 'Rixdollar': 1, 'Rix': 1, 'Stuiver': 1 / 48}, 1972),
        ('br_rhodesia', 'rhodesie_du_sud', 'rh', 'רודזיה הדרומית', '1932–1955, זימבבואה הבריטית',
         'מטבעות רודזיה הדרומית (היום זימבבואה) תחת ג׳ורג׳ החמישי, ג׳ורג׳ השישי ואליזבת השנייה.', {'Pound': 1, 'Shilling': 1 / 20, 'Penny': 1 / 240}, 1965),
        ('br_rhod_nyasa', 'rhodesie_et_nyassaland', 'rn', 'רודזיה וניאסלנד', '1955–1964, הפדרציה המרכז-אפריקאית',
         'מטבעות הפדרציה של רודזיה וניאסלנד (זימבבואה, זמביה ומלאווי של היום) תחת אליזבת השנייה.', {'Pound': 1, 'Shilling': 1 / 20, 'Penny': 1 / 240}, 1964),
        ('br_south_africa', 'afrique_du_sud', 'za', 'דרום אפריקה', '1923–1960, איחוד דרום אפריקה',
         'מטבעות איחוד דרום אפריקה, מהפרת׳ינג ועד הסוברין, תחת ג׳ורג׳ החמישי, ג׳ורג׳ השישי ואליזבת השנייה, עד המעבר לראנד ב-1961.',
         {'Pound': 1, 'Shilling': 1 / 20, 'Penny': 1 / 240}, 1960),
        ('br_west_africa', 'afrique_occidentale_britannique', 'wa', 'מערב אפריקה הבריטית', '1907–1958, ניגריה, חוף הזהב, סיירה לאון וגמביה',
         'המטבע המשותף של המושבות הבריטיות במערב אפריקה.', {'Shilling': 1 / 20, 'Penny': 1 / 240, 'Pound': 1}, 1958),
        ('br_east_africa', 'afrique_de_l_est', 'ea', 'מזרח אפריקה הבריטית', '1906–1964, קניה, אוגנדה וטנגניקה',
         'המטבע המשותף של מזרח אפריקה הבריטית: סנט ושילינג.', {'Shilling': 1, 'Cent': 0.01, 'Rupee': 1, 'Florin': 1}, 1964),
        ('br_straits', 'straits', 'ss', 'מושבות המצרים', '1845–1939, סינגפור, פנאנג ומלאקה',
         'מטבעות מושבות המצרים (Straits Settlements) לפי מלך ושנה.', {'Dollar': 1, 'Cent': 0.01}, 1946),
        ('br_malaya', 'malaya', 'ma', 'מלאיה הבריטית', '1939–1950', 'מטבעות מלאיה תחת ג׳ורג׳ השישי.', {'Dollar': 1, 'Cent': 0.01}, 1957),
        ('br_malaya_borneo', 'malaya_borneo', 'mb', 'מלאיה ובורנאו הבריטית', '1953–1961', 'מטבעות מלאיה ובורנאו הבריטית תחת אליזבת השנייה.',
         {'Dollar': 1, 'Cent': 0.01}, 1967),
        ('br_cyprus', 'chypre', 'cp', 'קפריסין הבריטית', '1879–1955, מגרוש ועד 45 גרוש',
         'מטבעות קפריסין תחת השלטון הבריטי, לפי מלך ושנה.', {'Piastre': 1, 'Shilling': 9, 'Mil': 0.009}, 1959)):
    CONFIGS[_key] = dict(src='br_colonies_numista.json', ids='br_colonies_ids.json', out=_key.replace('_', '-') + '.json', id=_id, name=_name, sub=_sub, about=_about,
                         numista=_src, until=_to, rulerLabel='👑 לפי מלך / תקופה', rulersLabel='מלכים ותקופות',
                         currency=_cur, units=BR_UNITS, rulers=BR_RULERS, mints=BR_MINTS)

# French colonies and protectorates: one album each, split by French regime (and by sultan / bey in the protectorates).
FR_UNITS = [(r'Centimes?', 'סנטים'), (r'Francs?', 'פרנק'), (r'D[ée]cimes?', 'דסים'), (r'Sous?\b', 'סו'), (r'Liards?', 'ליאר'),
            (r'Piastres?', 'פיאסטר'), (r'Cents?\b', 'סנט'), (r'Sap[eè]ques?', 'ספק'), (r'Rials?|Riyals?', 'ריאל'), (r'Mazunas?|Mouzounas?', 'מזונה'),
            (r'Dirhams?', 'דירהם'), (r'Kharubs?|Caroubes?', 'חרוב'), (r'Fanons?', 'פנון'), (r'Doudous?|Cash', 'דודו'), (r'Roupies?|Rupees?', 'רופי'),
            (r'Fels|Falus', 'פלס'), (r'Nasri', 'נסרי'), (r'Budju|Boudjou', 'בוג׳ו'), (r'Mahbub', 'מחבוב'), (r'Sultani', 'סולטאני'),
            (r'Para', 'פארה'), (r'Livres?', 'ליברה'), (r'Ecus?|Écus?', 'אקו'), (r'Kurush|Qirsh', 'קרש')]
FR_RULERS = [('Louis XV', 'louis15', 'לואי ה-15'), ('Louis XVI', 'louis16', 'לואי ה-16'), ('Napoleon I', 'napoleon1', 'נפוליאון הראשון'),
             ('Louis XVIII', 'louis18', 'לואי ה-18'), ('Charles X', 'charles10', 'שארל ה-10'), ('Louis Philippe', 'louisphilippe', 'לואי פיליפ'),
             ('Second Republic', 'rep2', 'הרפובליקה השנייה'), ('Napoleon III', 'napoleon3', 'נפוליאון השלישי'),
             ('Third Republic', 'rep3', 'הרפובליקה השלישית (1870–1940)'), ('French State', 'vichy', 'משטר וישי (1940–1944)'),
             ('Free France', 'freefrance', 'צרפת החופשית'), ('Provisional Government', 'gprf', 'הממשלה הזמנית (1944–1947)'),
             ('Fourth Republic', 'rep4', 'הרפובליקה הרביעית (1947–1958)'), ('Fifth Republic', 'rep5', 'הרפובליקה החמישית (1958–)'),
             ('Abdelaziz', 'abdelaziz', 'הסולטן עבד אל-עזיז'), ('Abd al-Aziz', 'abdelaziz', 'הסולטן עבד אל-עזיז'), ('Abdelhafid', 'abdelhafid', 'הסולטן עבד אל-חפיט'),
             ('Yusuf', 'yusuf', 'הסולטן יוסף'), ('Youssef', 'yusuf', 'הסולטן יוסף'), ('Mohammed V', 'mohammed5', 'מוחמד החמישי'),
             ('Muhammad V an-Nasir', 'nasir', 'מוחמד אל-נאסר (ביי תוניס)'), ('Muhammad V', 'mohammed5', 'מוחמד החמישי'), ('Hassan I', 'hassan1', 'הסולטן חסן הראשון'),
             ('Ali III', 'ali3', 'עלי השלישי (ביי תוניס)'), ('Muhammad V an-Nasir', 'nasir', 'מוחמד אל-נאסר (ביי תוניס)'),
             ('Muhammad VI', 'habib', 'מוחמד אל-חביב (ביי תוניס)'), ('Ahmad II', 'ahmad2', 'אחמד השני (ביי תוניס)'), ('Muhammad VII', 'moncef', 'מוחמד אל-מונסף (ביי תוניס)'),
             ('Muhammad VIII', 'lamine', 'מוחמד אל-אמין (ביי תוניס)'), ('Muhammad III', 'sadok', 'מוחמד א-סאדק (ביי תוניס)')]
FR_MINTS = {'Paris': 'פריז', 'Beaumont': 'Beaumont-le-Roger', 'Pessac': 'פסאק', 'Hanoi': 'האנוי', 'Pretoria': 'פרטוריה', 'Philadelphia': 'פילדלפיה',
            'Algiers': 'אלג׳יר', 'Tunis': 'תוניס', 'Fez': 'פאס', 'Rabat': 'רבאט', 'Bombay': 'בומביי', 'Brussels': 'בריסל', 'Birmingham': 'בירמינגהם',
            'Osaka': 'אוסקה', 'Saint-Louis': 'סן לואי'}
for _key, _src, _id, _name, _sub, _about, _cur, _to in (
        ('fr_algeria', 'algerie', 'dz', 'אלג׳יריה', 'עד 1962, מהעות׳מאנים ועד אלג׳יריה הצרפתית',
         'מטבעות אלג׳יריה: תקופת הדאים העות׳מאנים ואלג׳יריה הצרפתית, עד העצמאות ב-1962.', {'Franc': 1, 'Budju': 1}, 1962),
        ('fr_tunisia', 'tunisie', 'tn', 'תוניסיה (הפרוטקטורט)', 'עד 1956, ביי תוניס תחת צרפת',
         'מטבעות תוניסיה בתקופת הביים והפרוטקטורט הצרפתי, לפי ביי ושנה, עד העצמאות ב-1956.', {'Franc': 1, 'Piastre': 1, 'Kharub': 1 / 16}, 1957),
        ('fr_morocco', 'maroc', 'mo', 'מרוקו (הפרוטקטורט)', 'עד 1956, הסולטנים והפרוטקטורט',
         'מטבעות מרוקו לפני העצמאות: הסולטנים חסן הראשון, עבד אל-עזיז, יוסף ומוחמד החמישי, כולל תקופת הפרוטקטורט הצרפתי.',
         {'Franc': 1, 'Rial': 1, 'Dirham': 0.1, 'Mazuna': 1 / 400}, 1956),
        ('fr_indochina', 'indochine', 'ic', 'הודו-סין הצרפתית', '1879–1954, וייטנאם, לאוס וקמבודיה',
         'מטבעות הודו-סין הצרפתית: ספק, סנט ופיאסטר, לפי משטר ושנה.', {'Piastre': 1, 'Cent': 0.01, 'Sapèque': 1 / 500}, 1954),
        ('fr_west_africa', 'aof', 'ao', 'מערב אפריקה הצרפתית', '1944–1959', 'המטבע המשותף של מערב אפריקה הצרפתית.', {'Franc': 1}, 1959),
        ('fr_equatorial', 'aef', 'ae', 'אפריקה המשוונית הצרפתית', '1942–1958', 'מטבעות אפריקה המשוונית הצרפתית (צ׳אד, גבון, קונגו, אובנגי-שארי).', {'Franc': 1}, 1959),
        ('fr_cameroon', 'cameroon_french', 'cm', 'קמרון הצרפתית', '1924–1958', 'מטבעות קמרון תחת המנדט הצרפתי.', {'Franc': 1}, 1960),
        ('fr_togo', 'togo', 'tg', 'טוגו הצרפתית', '1924–1956', 'מטבעות טוגו תחת המנדט הצרפתי.', {'Franc': 1}, 1960),
        ('fr_madagascar', 'madagascar', 'mg', 'מדגסקר הצרפתית', '1943–1958', 'מטבעות מדגסקר הצרפתית.', {'Franc': 1}, 1959),
        ('fr_somaliland', 'french_somaliland_period', 'so', 'סומליה הצרפתית', '1948–1967', 'מטבעות חוף הסומלים הצרפתי (היום ג׳יבוטי).', {'Franc': 1}, 1967),
        ('fr_reunion', 'reunion_period', 're2', 'ראוניון', '1816–1973', 'מטבעות האי ראוניון.', {'Franc': 1}, 1975),
        ('fr_west_indies', 'colonies_francaises', 'wi', 'המושבות הצרפתיות', '1670–1896, מושבות כלליות', 'מטבעות "Colonies Françaises" ששימשו בכל המושבות.',
         {'Sou': 1 / 20, 'Livre': 1, 'Franc': 1}, 1900),
        ('fr_guadeloupe', 'guadeloupe', 'gp', 'גוואדלופ', '1903–1921', 'מטבעות גוואדלופ.', {'Franc': 1}, 1950),
        ('fr_martinique', 'martinique', 'mq', 'מרטיניק', '1897–1922', 'מטבעות מרטיניק.', {'Franc': 1}, 1950),
        ('fr_guiana', 'french-guiana', 'gf', 'גיאנה הצרפתית', '1789–1846', 'מטבעות גיאנה הצרפתית.', {'Sou': 1 / 20, 'Franc': 1}, 1950),
        ('fr_new_caledonia', 'nouvelle-caledonie', 'nc', 'קלדוניה החדשה', '1949–היום', 'מטבעות קלדוניה החדשה.', {'Franc': 1}, 2100),
        ('fr_oceania', 'etablissements_francais_oceanie_period', 'oc', 'אוקיאניה הצרפתית', '1949–1957', 'מטבעות היישובים הצרפתיים באוקיאניה (פולינזיה).', {'Franc': 1}, 1957),
        ('fr_new_hebrides', 'new_hebrides_period', 'nh', 'הברידים החדשים', '1966–1980', 'מטבעות הקונדומיניום הצרפתי-בריטי (היום ונואטו).', {'Franc': 1}, 1980),
        ('fr_india', 'india-french', 'fi', 'הודו הצרפתית', 'עד 1954, פונדיצ׳רי', 'מטבעות ההתיישבויות הצרפתיות בהודו.', {'Rupee': 1, 'Fanon': 1 / 8}, 1954),
        ('fr_syria', 'syrie', 'sy', 'סוריה (המנדט הצרפתי)', '1921–1946', 'מטבעות סוריה תחת המנדט הצרפתי, עד העצמאות.', {'Piastre': 1}, 1946),
        ('fr_lebanon', 'liban', 'lb', 'לבנון (המנדט הצרפתי)', '1924–1943', 'מטבעות לבנון תחת המנדט הצרפתי, עד העצמאות.', {'Piastre': 1}, 1943),
        ('fr_comoros', 'comores', 'km', 'קומורו', '1890–1975', 'מטבעות קומורו תחת צרפת.', {'Franc': 1, 'Centime': 0.01}, 1975)):
    CONFIGS[_key] = dict(src='fr_colonies_numista.json', ids='fr_colonies_ids.json', out=_key.replace('_', '-') + '.json', id=_id, name=_name, sub=_sub,
                         about=_about, numista=_src, until=_to, rulerLabel='👑 לפי משטר / שליט', rulersLabel='משטרים ושליטים',
                         currency=_cur, units=FR_UNITS, rulers=FR_RULERS, mints=FR_MINTS)

PLURAL = {'קופייקה': 'קופייקות', 'פולושקה': 'פולושקות', 'דנגה': 'דנגות', 'אנה': 'אנות', 'פרת׳ינג': 'פרת׳ינגים'}

def fnum(s):
    s = s.strip().replace('⁄', '/')
    m = re.fullmatch(r'(\d+)?([½¼¾⅛⅜⅞⅒])', s)
    if m: return (int(m.group(1)) if m.group(1) else 0) + FRAC[m.group(2)]
    m = re.fullmatch(r'(\d+)/(\d+)', s)
    if m: return int(m.group(1)) / int(m.group(2))
    try: return float(s.replace(',', ''))
    except ValueError: return None

def mm(s):
    m = re.search(r'([\d.]+)', s or '')
    return float(m.group(1)) if m else None

def number(s):
    d = re.sub(r'\D', '', s or '')
    return int(d) if d else None

def metal(comp):
    c = (comp or '').lower()
    for k, v in (('gold', ('gold', 'זהב')), ('billon', ('silver', 'בילון')), ('silver', ('silver', 'כסף')),
                 ('nickel brass', ('bronze', 'פליז-ניקל')), ('aluminium-bronze', ('bronze', 'ברונזה-אלומיניום')),
                 ('aluminum-bronze', ('bronze', 'ברונזה-אלומיניום')), ('aluminium', ('alu', 'אלומיניום')), ('aluminum', ('alu', 'אלומיניום')),
                 ('bimetallic', ('bimetal', 'דו-מתכתי')), ('copper-nickel', ('cuni', 'קופרו-ניקל')), ('cupronickel', ('cuni', 'קופרו-ניקל')),
                 ('nickel', ('cuni', 'ניקל')), ('steel', ('steel', 'פלדה')), ('brass', ('bronze', 'פליז')), ('bronze', ('bronze', 'ברונזה')),
                 ('zinc', ('steel', 'אבץ'))):
        if c.startswith(k) or (k in ('bimetallic', 'steel') and k in c): return v
    return 'copper', 'נחושת'

def ruler(cfg, f, title):
    raw = f.get('King') or f.get('Queen') or f.get('Sultan') or f.get('Ruler') or f.get('Emperor') or f.get('Period') or ''
    if not raw:   # no ruler on the page: the issuer may name the period (RSFSR), when it is a known one
        iss = f.get('Issuer', '')
        raw = iss if any(re.search(r'(^|\s)' + re.escape(p.strip()) + r'(?![A-Za-z])', iss) for p, _, _ in cfg['rulers']) else ''
    first = re.match(r'^(.*?\(\d{3,4}[^)]*\))', raw)
    raw1 = first.group(1) if first else raw
    years = [int(y) for y in re.findall(r'\((\d{3,4})', raw)]
    start = min(years) if years else 9999
    for pre, key, he in cfg['rulers']:
        if re.search(r'(^|\s)' + re.escape(pre.strip()) + r'(?![A-Za-z])', raw1): return key, he, start
    s = raw1
    for k, v in FIX_SULTAN.items():
        if s.startswith(k): s = v
    for pre, key, he in SULTANS:
        if (s + ' ').startswith(pre): return key, he, start
    if raw1:
        name = re.sub(r'\s*\(.*', '', raw1).strip()
        return re.sub(r'[^a-z0-9]+', '', name.lower())[:20] or 'x', name + (' (' + str(start) + ')' if years else ''), start
    return 'anon', 'לא מזוהה', 9999

def denomination(cfg, f, title):
    v = f.get('Value') or title.split(' - ')[0]
    cur = f.get('Currency') or ''
    factor = next((x for k, x in cfg['currency'].items() if cur.startswith(k)), 1)
    ratio = None
    m = re.search(r'\(?([\d.,/⁄½¼¾⅛⅒]+)\s*[A-Z]{3}\)?', v) or re.search(r'\(([\d.,/⁄½¼¾⅛⅒]+)\)\s*$', v)
    if m: ratio = fnum(m.group(1))
    name = re.split(r'\s*\(|\s+\d[\d.,]*\s*[A-Z]{3}', v)[0].strip()
    qm = re.match(r'^([\d½¼¾⅛⅜⅞⅒/⁄.,]+)\s+(.*)$', name)
    qty, unit = (qm.group(1), qm.group(2)) if qm else ('1', name)
    he = next((h for r, h in cfg['units'] if re.search(r, unit, re.I)), unit)
    q = re.sub(r'^1⁄2$', '½', qty).replace('⁄', '/')
    label = he if q == '1' else q + ' ' + (PLURAL.get(he, he) if (fnum(q) or 0) > 1 else he)
    rank = (ratio if ratio is not None else (fnum(qty) or 1)) * factor
    key = re.sub(r'[^0-9a-z]+', '-', (q + '-' + unit).lower().replace('½', 'h').replace('/', '-')).strip('-')
    return label, rank, key

def build(key):
    cfg = CONFIGS[key]
    data = json.load(io.open(os.path.join(HERE, 'data', cfg['src']), encoding='utf8'))
    if cfg.get('ids'):   # one data file for several issuers: keep this issuer's types
        keep = {str(i) for i in json.load(io.open(os.path.join(HERE, 'data', cfg['ids']), encoding='utf8'))[cfg['numista']]}
        data = [x for x in data if str(x['id']) in keep]
    groups, rulers, items, ids = {}, {}, [], set()
    for x in data:
        f = x.get('f') or x.get('feat') or {}
        typ = f.get('Type', '')
        if not re.match(r'(Standard circulation|Circulating commemorative|Non-circulating)', typ): continue
        den, rank, gkey = denomination(cfg, f, x['t'])
        g = groups.setdefault(den, {'key': gkey, 'name': den, 'rank': []}); g['rank'].append(rank); gkey = g['key']
        rkey, rhe, start = ruler(cfg, f, x['t'])
        r = rulers.setdefault(rkey, {'key': rkey, 'name': rhe, 'start': start}); r['start'] = min(r['start'], start)
        met, metname = metal(f.get('Composition'))
        mint_src = (x.get('mint') or '') + ' ' + x['t']
        mint_he = next((h for k, h in cfg['mints'].items() if k in mint_src), '')
        nonc, comm = typ.startswith('Non-circulating'), typ.startswith('Circulating commemorative')
        extra = x['t'].split(' - ', 1)[1] if ' - ' in x['t'] else ''
        refs = re.findall(r'(KM#\s*[\w.]+|Schön#\s*[\w.]+)', f.get('References', ''))
        rows = x['rows'] or [[f.get('Year') or f.get('Years') or '', '', '', '']]
        for ri, row in enumerate(rows):
            date = (row[0] or '').replace('\xa0', ' ').strip()
            dm = re.match(r'^(\d{3,4}|ND)\s*(?:\((\d{3,4})(?:-(\d{3,4}))?\))?\s*(\S+)?', date)
            first, greg, tail = (dm.group(1), dm.group(2), (dm.group(4) or '').translate(AR_DIGITS)) if dm else ('', None, '')
            hijri = f.get('Dating', '').startswith('Islamic') and first and first != 'ND'
            if not greg and first and first != 'ND': greg = str(round(int(first) * 0.97 + 622)) if hijri else first
            y = int(greg) if greg else (start if start < 9999 else None)
            if cfg.get('until') and y and y > cfg['until']: continue   # after independence: another album
            when = (first + ('/' + tail if tail.isdigit() else '') + (' (' + greg + ')' if hijri and greg else '')) if first and first != 'ND' else 'ללא תאריך'
            n = number(row[1]) if len(row) > 1 else None
            raw_comment = row[2] if len(row) > 2 else ''
            row_proof = bool(re.search(r'proof', raw_comment, re.I))
            comment = re.sub(r'[؀-ۿ]+', ' ', raw_comment)
            comment = re.sub(r'\(?\s*mintage in \d{4}\s*\)?|Year\s*,\s*Minting Year\s*\d+|no regnal year', ' ', comment, flags=re.I)
            comment = re.sub(r'^[\s\d/()–-]+|[\s;,–-]+$', '', re.sub(r'\s+', ' ', comment)).strip()
            comment = re.sub(r'\b(hijri|gregorian|islamic date|christian date|ah|ad|fr|regnal year|regnal|year|being revised)\b|[()*]', ' ', comment, flags=re.I)
            comment = re.sub(r'^[\s\d/;,.:–-]+|[\s;,.:–-]+$', '', re.sub(r'\s+', ' ', comment)).strip()
            label = den + ' ' + when + (' — ' + extra if comm and extra else '') + (' — ' + comment if comment and len(comment) < 40 else '')
            base = '%s-%s-%s' % (cfg['id'], x['id'], re.sub(r'[^0-9a-z]+', '-', (date + '-' + comment).lower()).strip('-')[:40] or str(ri))
            id_ = base
            while id_ in ids: id_ += 'x'
            ids.add(id_)
            note = ['סוג: ' + x['t'] + ' (Numista N#' + x['id'] + ').', 'שליט / תקופה: ' + rhe + '.']
            if mint_he: note.append('מטבעה: ' + mint_he + '.')
            if comment: note.append('הערת המקור: ' + comment + '.')
            if nonc: note.append('הוטבע שלא למחזור (מטבע אספנים / השקעה).')
            items.append({k: v for k, v in dict(
                id=id_, group=gkey, country=rkey, typeKey=x['id'], y=y, label=label, metal=met, metalName=metname, composition=f.get('Composition', ''),
                diam=mm(f.get('Diameter')) or 20, weight=mm(f.get('Weight')), thickness=mm(f.get('Thickness')), mintage=n,
                catalog=', '.join(refs), edge=(x.get('edge') or '').split(' ©')[0][:80], mint=mint_he, proof=nonc or row_proof, commemorative=comm,
                tag='לא למחזור' if nonc else ('פרוף' if row_proof else ('הנצחה' if comm else '')), note=' '.join(note)).items()
                if v not in ('', None, False) or k in ('id', 'group', 'y', 'label')})
    if key == 'ussr':   # Numista leaves most Soviet commemorative mintages empty; the Wikipedia list has them
        from enrich_ussr import enrich
        print('  ussr commemoratives given a mintage from Wikipedia:', enrich(items))
    used_g, used_r = {i['group'] for i in items}, {i['country'] for i in items}   # dates cut by `until` may leave a group or ruler empty
    groups = {k: g for k, g in groups.items() if g['key'] in used_g}
    rulers = {k: r for k, r in rulers.items() if k in used_r}
    glist = sorted(groups.values(), key=lambda g: (statistics.median(g['rank']), g['name']))
    seen, gout = set(), []
    for g in glist:
        if g['key'] not in seen: seen.add(g['key']); gout.append({'key': g['key'], 'name': g['name']})
    order = {g['key']: i for i, g in enumerate(gout)}
    items.sort(key=lambda i: (order[i['group']], i['y'] or 0, i['id']))
    rout = sorted(rulers.values(), key=lambda r: (r['start'], r['name']))
    out = dict(name=cfg['name'], sub=cfg['sub'], about=cfg['about'], theme='file', groupLabel='ערך', groups=gout,
               countries=[{'key': r['key'], 'name': r['name']} for r in rout], countryLabel=cfg['rulerLabel'], countriesLabel=cfg['rulersLabel'],
               sources=['Numista — type pages'], sourceAttribution='נתונים: Numista (en.numista.com)', catalogVersion='2026-10-05-1', items=items)
    with io.open(os.path.join(HERE, '..', 'catalogs', cfg['out']), 'w', encoding='utf8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    print(key + ':', len(items), 'items,', len(gout), 'groups,', len(rout), 'rulers, proof', sum(1 for i in items if i.get('proof')))

if __name__ == '__main__':
    for k in sys.argv[1:] or CONFIGS: build(k)
