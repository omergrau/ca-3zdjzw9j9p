# Marks Key / Semi-Key dates in a catalog file from its circulation mintages.
# Only regular (non-variant) issues with a known mintage are considered, and a tier that is
# already set by hand is never changed.  Usage: python tools/mark_key_dates.py <catalog> <key_max> <semi_max>
import io, json, os, sys

def mark(path, key_max, semi_max):
    with io.open(path, encoding='utf8') as f:
        data = json.load(f)
    changed = 0
    for it in data['items']:
        n = it.get('mintage')
        if it.get('variant') or it.get('error') or it.get('rarityTier') or not isinstance(n, (int, float)) or n <= 0:
            continue
        txt = '{:,}'.format(int(n))
        if n <= key_max:
            it['rarityTier'] = 'key'
            it['rarityReason'] = 'Key Date: ' + txt + ' מטבעות בלבד בהנפקת המחזור.'
        elif n <= semi_max:
            it['rarityTier'] = 'semi-key'
            it['rarityReason'] = 'Semi-Key: ' + txt + ' מטבעות בלבד בהנפקת המחזור.'
        else:
            continue
        if not it.get('rare'):
            it['rare'] = txt + ' מטבעות בלבד.'
        changed += 1
    with io.open(path, 'w', encoding='utf8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return changed

if __name__ == '__main__':
    root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'catalogs')
    name, key_max, semi_max = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    print(name, mark(os.path.join(root, name + '.json'), key_max, semi_max), 'marked')
