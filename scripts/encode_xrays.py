"""Convert the downloaded real chest X-rays to compact base64 JPEG data URLs
for embedding as frontend demo assets. Output: src/data/xray_b64/<name>.txt
"""
import os
import io
import base64
from PIL import Image

SRC_DIR = os.path.join('public', 'demo-xrays')
OUT_DIR = os.path.join('src', 'data', 'xray_b64')
os.makedirs(OUT_DIR, exist_ok=True)

NAMES = ['pneumonia', 'cardiomegaly', 'copd', 'appendicitis']

for name in NAMES:
    src = os.path.join(SRC_DIR, name + '.png')
    if not os.path.exists(src):
        print('MISSING', src)
        continue
    im = Image.open(src).convert('L').convert('RGB')
    im = im.resize((448, 448), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, format='JPEG', quality=82)
    b64 = base64.b64encode(buf.getvalue()).decode('ascii')
    out = os.path.join(OUT_DIR, name + '.txt')
    with open(out, 'w') as f:
        f.write('data:image/jpeg;base64,' + b64)
    print(name, '->', len(b64) // 1024, 'KB base64,', im.size)

print('DONE')
