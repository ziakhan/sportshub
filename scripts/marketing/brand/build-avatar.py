"""
Builds the circle-safe Instagram profile picture from the REAL logo pixels.

    python3 scripts/marketing/brand/build-avatar.py [outDir]

WHY NOT RENDER THE SVG. public/brand/icon-n3.svg sets the S and the 1 as
TEXT in a system font stack (-apple-system, Segoe UI, Roboto, Helvetica,
Arial). That resolves to a different face on different machines: rendering it
here produced an S 485px wide where the shipped icon-n3-1024.png has one 473px
wide, which shifted the badge away from the S and changed the mark. A logo
must not depend on an installed font.

So this treats icon-n3-1024.png as the source of truth and never redraws
anything. It lifts the mark off its background by alpha, then recomposites it
on a full-bleed version of the same gradient.

The only change is POSITION. The icon is drawn for a rounded SQUARE, which has
corners to fill, so the mark deliberately sits up and to the right. Instagram
crops to a CIRCLE, where that same placement reads as off-centre and clips the
badge. The whole lockup is centred as one object, so the S alone still reads
slightly left, which is correct: the mark is balanced, not the letter.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

REPO = Path(__file__).resolve().parents[3]
SRC = REPO / "apps/web/public/brand/icon-n3-1024.png"
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else REPO / "apps/web/public/brand"

SIZE = 1024
# The icon's own gradient, straight from icon-n3.svg.
G0, G1 = (0x1E, 0x2D, 0x4D), (0x0B, 0x16, 0x28)
SAFE = 0.92  # bbox diagonal as a fraction of the circle's radius


def gradient(size: int) -> Image.Image:
    """linearGradient x1=0 y1=0 x2=1 y2=1 — a 135° diagonal ramp."""
    y, x = np.mgrid[0:size, 0:size]
    t = ((x + y) / (2 * (size - 1)))[..., None]
    a = np.array(G0, float)
    b = np.array(G1, float)
    return Image.fromarray((a + (b - a) * t).astype(np.uint8), "RGB")


def lift_mark(img: Image.Image) -> Image.Image:
    """Alpha = how far a pixel is from the background gradient beneath it, so
    antialiased edges survive instead of being thresholded into jaggies.

    The source is RGBA with TRANSPARENT rounded corners. Converting it to RGB
    turns those into black, which is nowhere near the navy gradient, so they
    read as mark and the bbox becomes the whole canvas. The source alpha has to
    gate the mask."""
    rgba = np.asarray(img.convert("RGBA")).astype(float)
    rgb, src_a = rgba[..., :3], rgba[..., 3] / 255.0
    bg = np.asarray(gradient(img.size[0])).astype(float)
    dist = np.linalg.norm(rgb - bg, axis=2)
    # Hard-gate on opacity. The rounded-square EDGE is black-with-partial-
    # alpha, which is maximally far from navy, so a soft gate keeps a faint
    # ring of it and the bbox becomes the whole canvas again.
    alpha = np.clip((dist - 8) / 48, 0, 1) * (src_a > 0.9)
    return Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8), "RGBA")


def main():
    src = Image.open(SRC)
    mark = lift_mark(src)
    box = mark.getbbox()  # bbox of non-transparent pixels
    mark = mark.crop(box)
    w, h = mark.size

    # Scale so the DIAGONAL clears the circle, not merely the width: the badge
    # sits on a corner, and a corner is what a circle takes first.
    half_diag = (w**2 + h**2) ** 0.5 / 2
    scale = (SIZE / 2 * SAFE) / half_diag
    new = (max(1, round(w * scale)), max(1, round(h * scale)))
    mark = mark.resize(new, Image.LANCZOS)

    canvas = gradient(SIZE).convert("RGBA")
    pos = ((SIZE - new[0]) // 2, (SIZE - new[1]) // 2)
    canvas.alpha_composite(mark, pos)
    canvas = canvas.convert("RGB")

    OUT.mkdir(parents=True, exist_ok=True)
    full = OUT / "instagram-avatar-1024.png"
    canvas.save(full)

    # Proof: the circle crop Instagram will apply, and the sizes it shows.
    mask = Image.new("L", (SIZE, SIZE), 0)
    from PIL import ImageDraw
    ImageDraw.Draw(mask).ellipse((0, 0, SIZE, SIZE), fill=255)
    circ = Image.new("RGB", (SIZE, SIZE), (233, 236, 242))
    circ.paste(canvas, mask=mask)
    circ.save(OUT / "instagram-avatar-circle-preview.png")

    strip = Image.new("RGB", (560, 190), (255, 255, 255))
    x = 30
    for px in (110, 56, 32):
        strip.paste(circ.resize((px, px), Image.LANCZOS), (x, 95 - px // 2))
        x += px + 45
    strip.save(OUT / "instagram-avatar-sizes.png")

    cx, cy = pos[0] + new[0] / 2, pos[1] + new[1] / 2
    corners = [(pos[0], pos[1]), (pos[0] + new[0], pos[1]),
               (pos[0], pos[1] + new[1]), (pos[0] + new[0], pos[1] + new[1])]
    far = max(((c[0] - SIZE / 2) ** 2 + (c[1] - SIZE / 2) ** 2) ** 0.5 for c in corners)
    print(f"source mark bbox in icon-n3-1024.png: {box}")
    print(f"mark placed at {new[0]}x{new[1]}, centre ({cx:.0f}, {cy:.0f})")
    print(f"farthest corner {far:.0f} vs circle radius {SIZE//2} -> "
          f"{'CLEARS' if far < SIZE/2 else 'CLIPPED'}")
    print(f"wrote {full}")


if __name__ == "__main__":
    main()
