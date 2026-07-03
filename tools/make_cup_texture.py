#!/usr/bin/env python3
"""Author the paper-cup albedo: kraft base + dark KOOB sticker.

The cup mesh (tools: koob-scene.blend, object "Cup") is unwrapped
cylindrically — u runs around the cup (seam at the back), v runs base→rim.
The sticker is drawn at a tunable u/v so the logo can be re-aimed at the
camera without touching the mesh: re-run with a different --u and re-export.

Usage: python3 tools/make_cup_texture.py [--size 2048] [--u 0.25] [--v 0.52]
       [--radius auto] — radius defaults to 430 scaled by size/2048
Writes: assets/models/src/paper_col.png   (size x size albedo)
        assets/models/src/logo_cream.png  (keyed logo, kept for reuse/debug)
"""
import argparse
import random

from PIL import Image, ImageDraw

LOGO = "assets/logo 2.pdf_20260703_174119_0000.png"
OUT = "assets/models/src/paper_col.png"
LOGO_OUT = "assets/models/src/logo_cream.png"
KRAFT = (211, 195, 171)   # warm kraft beige, sampled from the product photos
STICKER = (16, 30, 25)    # near-black with the brand green cast
CREAM = (239, 227, 207)   # logo cream


def key_logo():
    """Cream mark on solid green -> cream RGBA on transparent."""
    img = Image.open(LOGO).convert("RGB")
    bg = img.getpixel((4, 4))  # background is a solid fill; sample a corner
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    px, po = img.load(), out.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b = px[x, y]
            d = abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2])
            a = max(0, min(255, (d - 30) * 2))  # soft key, keeps stroke edges
            po[x, y] = (*CREAM, a)
    return out


def kraft_base(size):
    """Kraft sheet with a whisper of vertical grain and light speckle.

    Keep the grain amplitude tiny: KTX2's ETC1S encoding turns stronger
    per-column luminance variation into visible chroma banding on the cup
    (observed as yellow vertical streaks in-browser at +/-5)."""
    img = Image.new("RGB", (size, size), KRAFT)
    px = img.load()
    rnd = random.Random(7)  # seeded: texture is reproducible run to run
    for x in range(size):
        dv = rnd.randint(-2, 2)
        for y in range(size):
            r, g, b = px[x, y]
            px[x, y] = (r + dv, g + dv, b + dv)
    for _ in range(int(6000 * (size / 2048) ** 2)):
        x, y = rnd.randrange(size), rnd.randrange(size)
        d = rnd.randint(-7, 4)
        r, g, b = px[x, y]
        px[x, y] = (r + d, g + d, b + d)
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--size", type=int, default=2048)
    ap.add_argument("--u", type=float, default=0.25)
    ap.add_argument("--v", type=float, default=0.52)
    ap.add_argument("--radius", type=int, default=0)  # 0 → 430 scaled by size
    # map-height / circumference at sticker mid-height: 0.1035 / (2*pi*0.0355)
    ap.add_argument("--aspect", type=float, default=0.464)
    args = ap.parse_args()
    SIZE = args.size
    if not args.radius:
        args.radius = round(430 * SIZE / 2048)

    logo = key_logo()
    logo.save(LOGO_OUT)

    base = kraft_base(SIZE)
    cx, cy = int(args.u * SIZE), int((1 - args.v) * SIZE)  # v=0 is image bottom
    rx = int(args.radius * args.aspect)
    ry = args.radius
    # Cylindrical UVs stretch texture-space circles by ~circumference/height;
    # drawing an ellipse here (compressed on u) is what reads as a circle
    # once wrapped around the cup.
    ImageDraw.Draw(base).ellipse(
        [cx - rx, cy - ry, cx + rx, cy + ry],
        fill=STICKER,
    )
    w = int(args.radius * 2 * 0.72)  # logo spans ~72% of the sticker (y axis basis)
    h = int(w * logo.height / logo.width)
    lg_w = int(w * args.aspect)  # x compressed by the same factor as the sticker
    lg = logo.resize((lg_w, h), Image.LANCZOS)
    base.paste(lg, (cx - lg_w // 2, cy - h // 2), lg)
    base.save(OUT)

    # self-checks: sticker edge is dark, far corner is still kraft
    # logo occupies +/-0.72*rx horizontally, so 0.85*rx is clear of it
    assert base.getpixel((cx + int(rx * 0.85), cy))[0] < 70
    assert base.getpixel((40, 40))[0] > 180
    print(
        f"wrote {OUT} ({SIZE}x{SIZE}) sticker u={args.u} v={args.v} "
        f"r={args.radius} aspect={args.aspect} (rx={rx} ry={ry})"
    )


if __name__ == "__main__":
    main()
