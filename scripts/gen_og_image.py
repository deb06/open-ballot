#!/usr/bin/env python3
"""Generate the Open Graph sharing image (1200x630) for Open Ballot.

Usage: python scripts/gen_og_image.py
Requires: pip install Pillow
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "og-image.png"
W, H = 1200, 630


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        r"C:\Windows\Fonts\seguisb.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def main() -> None:
    img = Image.new("RGB", (W, H), (8, 11, 18))
    px = img.load()

    # Diagonal indigo -> cyan gradient with a soft vignette.
    for y in range(H):
        for x in range(W):
            t = (x / W * 0.6 + y / H * 0.4)
            r = int(18 + (20 - 18) * t + 20 * (1 - abs(x - W / 2) / (W / 2)))
            g = int(20 + (30 - 20) * t)
            b = int(40 + (70 - 40) * t)
            dx, dy = (x - W / 2) / (W / 2), (y - H / 2) / (H / 2)
            v = max(0, 1 - (dx * dx + dy * dy) * 0.45)
            px[x, y] = (int(r * v), int(g * v), int(b * v))

    draw = ImageDraw.Draw(img, "RGBA")

    # Brand mark: rounded square with purple/cyan gradient + check.
    mark = Image.new("RGBA", (150, 150), (0, 0, 0, 0))
    mp = mark.load()
    for y in range(150):
        for x in range(150):
            # rounded-rect mask
            cx = min(max(x, 26), 124)
            cy = min(max(y, 26), 124)
            inside = math.hypot(x - cx, y - cy) <= 26
            if inside:
                t = y / 150
                mp[x, y] = (int(157 - 66 * t), int(139 + 40 * t), 255, 255)
    md = ImageDraw.Draw(mark)
    md.line([(48, 78), (68, 99), (105, 55)], fill=(255, 255, 255, 255), width=11, joint="curve")
    img.paste(mark, (80, 150), mark)

    draw.text((270, 166), "OPEN BALLOT", font=font(72, True), fill=(245, 246, 255))
    draw.text((274, 258), "SECURE ONLINE VOTING", font=font(26), fill=(167, 180, 220))

    draw.rounded_rectangle((80, 360, 520, 420), radius=30, fill=(139, 123, 255, 45))
    draw.text((110, 374), "One person. One vote.", font=font(30, True), fill=(190, 180, 255))
    draw.text((80, 460), "Secret ballots  ·  Receipt-verifiable  ·  Audit-ready", font=font(28), fill=(200, 210, 235))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, "PNG", optimize=True)
    print(f"Wrote {OUT.relative_to(ROOT)} ({W}x{H})")


if __name__ == "__main__":
    main()
