#!/usr/bin/env python3
"""KOOB image optimizer — convert a raw render to a display-sized WebP (keeps alpha).

Usage:
    python3 tools/optimize_image.py <src> <out.webp> <max_width> [quality=84]

Example (after generating with Higgsfield):
    python3 tools/optimize_image.py raw/white-coffee.png assets/white-coffee.webp 600
"""
import sys, os
from PIL import Image

def main():
    if len(sys.argv) < 4:
        print(__doc__); sys.exit(1)
    src, out, max_w = sys.argv[1], sys.argv[2], int(sys.argv[3])
    q = int(sys.argv[4]) if len(sys.argv) > 4 else 84
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    if w > max_w:
        im = im.resize((max_w, round(h * max_w / w)), Image.LANCZOS)
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    im.save(out, "WEBP", quality=q, method=6)
    print(f"{out}  {im.size[0]}x{im.size[1]}  {os.path.getsize(out)/1024:.1f} KB")

if __name__ == "__main__":
    main()
