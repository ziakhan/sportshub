#!/usr/bin/env python3
"""
Crop and encode the deck screenshots. Second half of `npm run deck:shots`.

Takes the raw PNGs from deck-shots.mjs and writes WebP into
apps/web/public/deck (the NPH set) and apps/web/public/deck/neutral.

Two numbers here carry the readability of the whole deck, so they are
explained rather than left as magic:

RIGHT_KEEP  The demo ribbon rides the right edge of every console page. It is
            not worth hiding in CSS (it survived two attempts); cropping is
            reliable.

HEIGHT_KEEP The deck's picture box is about 2.7:1. The captured band is about
            1.8:1, which is height-bound inside it and renders at roughly 0.84
            scale, so a 14px label lands under 12px. Trimming to ~2.24:1 makes
            it width-bound instead and it renders at about 1.09, i.e. slightly
            larger than the product looks on a real screen. If you widen the
            slide's copy column or change the type scale, re-measure this.
"""
from __future__ import annotations
import os
import sys
import glob
import re
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.environ.get("DECK_RAW", os.path.join(REPO, ".deck-shots"))
PUBLIC = os.path.join(REPO, "apps", "web", "public", "deck")

RIGHT_KEEP = 0.955
HEIGHT_KEEP = 0.77
MAX_WIDTH = 1900
QUALITY = 86

SETS = [("nph", PUBLIC), ("neutral", os.path.join(PUBLIC, "neutral"))]


def convert(src_dir: str, out_dir: str) -> tuple[int, int, str]:
    os.makedirs(out_dir, exist_ok=True)
    pngs = sorted(glob.glob(os.path.join(src_dir, "*.png")))
    if not pngs:
        raise SystemExit(f"no PNGs in {src_dir}. Run scripts/marketing/deck-shots.mjs first.")
    # only clear what we are about to replace, so a --nph run leaves neutral alone
    for old in glob.glob(os.path.join(out_dir, "*.webp")):
        os.remove(old)
    total = 0
    dims = ""
    for png in pngs:
        name = os.path.basename(png)[:-4]
        im = Image.open(png).convert("RGB")
        w, h = im.size
        im = im.crop((0, 0, int(w * RIGHT_KEEP), int(h * HEIGHT_KEEP)))
        if im.width > MAX_WIDTH:
            im = im.resize((MAX_WIDTH, round(im.height * MAX_WIDTH / im.width)), Image.LANCZOS)
        dest = os.path.join(out_dir, f"{name}.webp")
        im.save(dest, "WEBP", quality=QUALITY, method=6)
        total += os.path.getsize(dest)
        dims = f"{im.width}x{im.height}"
    return len(pngs), total, dims


def stamp_version() -> str:
    """Bump the cache-busting stamp the deck appends to every shot URL.

    Filenames are stable across re-shoots, so without this a browser that has
    already seen the deck keeps showing the previous pictures out of memory
    cache and the re-shoot looks like it did nothing at all."""
    from datetime import datetime

    version = datetime.now().strftime("%Y%m%d-%H%M")
    path = os.path.join(REPO, "apps", "web", "src", "app", "deck", "_deck", "shots-version.ts")
    with open(path) as fh:
        src = fh.read()
    with open(path, "w") as fh:
        fh.write(re.sub(r'SHOTS_VERSION = "[^"]*"', f'SHOTS_VERSION = "{version}"', src))
    return version


def main() -> None:
    wanted = sys.argv[1:] or [s[0] for s in SETS]
    for label, out_dir in SETS:
        if label not in wanted:
            continue
        src = os.path.join(RAW, label)
        if not os.path.isdir(src):
            print(f"{label}: no raw captures, skipped")
            continue
        n, total, dims = convert(src, out_dir)
        ratio = eval(dims.replace("x", "/"))  # noqa: S307 - our own string
        print(f"{label:8s} {n} files  {dims} (ratio {ratio:.2f})  {total/1024:.0f}KB  -> {out_dir}")
    print(f"\nshots version -> {stamp_version()}  (browser cache-buster bumped)")
    print(
        "\nIf the frame count changed, update SHOTS in\n"
        "  apps/web/src/app/deck/_deck/league-deck.tsx\n"
        "so `frames` and the declared w/h match."
    )


if __name__ == "__main__":
    main()
