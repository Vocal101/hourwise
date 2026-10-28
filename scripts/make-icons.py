# Draws the app icons: a yellow tile with a dark hourglass, matching icons/favicon.svg.
# Usage: python scripts/make-icons.py
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / 'icons'
YELLOW = (255, 201, 60)
INK = (42, 34, 51)


def bezier(p0, p1, p2, p3, steps=400):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        pts.append((u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
                    u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1]))
    return pts


def icon(size, maskable=False):
    scale = 4  # supersample for smooth edges
    s = size * scale
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable:
        d.rectangle([0, 0, s, s], fill=YELLOW)
        glyph = 0.62  # keep inside the maskable safe zone
    else:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.28), fill=YELLOW)
        glyph = 0.9
    # Same geometry as the 32-unit favicon, scaled around the center.
    k = s / 32 * glyph
    off = (s - 32 * k) / 2
    P = lambda x, y: (off + x * k, off + y * k)
    w = int(2.4 * k)
    d.line([P(10, 7), P(22, 7)], fill=INK, width=w)
    d.line([P(10, 25), P(22, 25)], fill=INK, width=w)
    left = bezier(P(11, 7), P(11, 12), P(15, 13), P(15, 16)) + bezier(P(15, 16), P(15, 19), P(11, 20), P(11, 25))[1:]
    right = bezier(P(21, 7), P(21, 12), P(17, 13), P(17, 16)) + bezier(P(17, 16), P(17, 19), P(21, 20), P(21, 25))[1:]
    # Stamp round dots along each curve; wide PIL polylines get notches at the joints.
    for cx, cy in left + right:
        d.ellipse([cx - w / 2, cy - w / 2, cx + w / 2, cy + w / 2], fill=INK)
    for x, y in [(10, 7), (22, 7), (10, 25), (22, 25)]:
        cx, cy = P(x, y)
        d.ellipse([cx - w / 2, cy - w / 2, cx + w / 2, cy + w / 2], fill=INK)
    d.polygon([P(12.6, 24), P(19.4, 24), P(16, 20.2)], fill=INK)
    d.polygon([P(13.4, 10.5), P(18.6, 10.5), P(16, 13.6)], fill=INK)
    return img.resize((size, size), Image.LANCZOS)


OUT.mkdir(exist_ok=True)
icon(192).save(OUT / 'icon-192.png')
icon(512).save(OUT / 'icon-512.png')
icon(512, maskable=True).save(OUT / 'icon-maskable-512.png')
# iOS draws its own rounded corners, so the touch icon is a full square.
icon(180, maskable=True).convert('RGB').save(OUT / 'apple-touch-icon.png')
print('icons written to', OUT)
