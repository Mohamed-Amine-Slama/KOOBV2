"""Generate a soft vertical steam-wisp RGBA texture for the 3D cup."""
import math, random
from PIL import Image, ImageDraw, ImageFilter

W, H = 256, 512
img = Image.new("RGBA", (W, H), (245, 240, 232, 0))
d = ImageDraw.Draw(img)
random.seed(7)
for stroke in range(3):
    x = W * (0.35 + 0.15 * stroke)
    pts = []
    for i in range(40):
        t = i / 39
        pts.append((x + math.sin(t * math.pi * 2.2 + stroke * 2) * W * 0.12 * (0.4 + t),
                    H * (1 - t)))
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        alpha = int(150 * (1 - abs(0.5 - y0 / H) * 1.6))
        if alpha > 0:
            d.line([(x0, y0), (x1, y1)], fill=(245, 240, 232, alpha),
                   width=int(10 + 26 * (1 - y0 / H)))
img = img.filter(ImageFilter.GaussianBlur(9))
img.save("assets/models/src/steam.png")
print("wrote assets/models/src/steam.png")
