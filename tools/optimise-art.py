# Makes the runtime pictures: every PNG original in art-source/ becomes a WebP in assets/.
# The originals stay untouched (and stay off the public site); WebP at quality 80 looks the same
# in the game at about a sixth of the size (124 sprites: 28.5 MB of PNG → about 4.7 MB).
# Usage: python3 tools/optimise-art.py   then   npm run zoo-art   (needs Pillow: pip install pillow)
import glob, os, sys
from PIL import Image

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
src = os.path.join(root, 'art-source')
dst = os.path.join(root, 'assets')
os.makedirs(dst, exist_ok=True)
made = 0
for p in sorted(glob.glob(os.path.join(src, '*.png'))):
    out = os.path.join(dst, os.path.basename(p)[:-4] + '.webp')
    if os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(p) and '--all' not in sys.argv:
        continue
    Image.open(p).convert('RGBA').save(out, 'WEBP', quality=80, method=6, alpha_quality=90)
    made += 1
total = sum(os.path.getsize(f) for f in glob.glob(os.path.join(dst, '*.webp')))
print(f'{made} WebP made; assets/ holds {total / 1e6:.1f} MB of pictures.')
