#!/usr/bin/env python3
"""
Bake buku/globe as 1024×576 comp-aligned layers from user exports + KV_Outline reference.
"""

from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
KV = ROOT / "public" / "assets" / "wall-kv"
AS = (
    ROOT.parent.parent
    / ".cursor/projects/Users-rio-Documents-gsa-scratch/assets"
)
W, H = 1024, 576

REF = AS / "KV_Outline-4edb605f-9109-4414-80e6-1a467d81a110.jpg"
PAIRS = [
    (
        "buku",
        AS / "buku-856ed6e7-0707-4300-94db-510d6d87c067.png",
    ),
    (
        "globe",
        AS / "globe-ca244a2d-a878-4e28-8b3f-c602dd720cc9.png",
    ),
]


def is_stroke(r: int, g: int, b: int, a: int = 255) -> bool:
    return a > 200 and r > 175 and g > 175 and b > 175


def ink_mask(im: Image.Image) -> Image.Image:
    """Alpha / non-black mask for a comp fill export."""
    im = im.convert("RGBA").resize((W, H), Image.Resampling.LANCZOS)
    px = im.load()
    mask = Image.new("L", (W, H), 0)
    mp = mask.load()
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a < 12:
                continue
            if r + g + b > 45:
                mp[x, y] = 255
    return mask.filter(ImageFilter.MaxFilter(5))


def bake_outline(ref: Image.Image, guide: Image.Image) -> Image.Image:
    ref = ref.convert("RGBA").resize((W, H), Image.Resampling.LANCZOS)
    mask = ink_mask(guide)
    mp = mask.load()
    rp = ref.load()
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    op = out.load()
    for y in range(H):
        for x in range(W):
            if mp[x, y] < 40:
                continue
            r, g, b, a = rp[x, y]
            if is_stroke(r, g, b, a):
                op[x, y] = (255, 255, 255, 255)
    return out


def main() -> None:
    if not REF.is_file():
        raise SystemExit(f"Missing reference {REF}")
    ref = Image.open(REF)

    for stem, fill_src in PAIRS:
        if not fill_src.is_file():
            raise SystemExit(f"Missing {fill_src}")
        fill = Image.open(fill_src)
        fill_out = KV / f"{stem}-comp-fill.png"
        outline_out = KV / f"{stem}-comp-outline.png"
        fill.convert("RGBA").resize((W, H), Image.Resampling.LANCZOS).save(
            fill_out, optimize=True
        )
        bake_outline(ref, fill).save(outline_out, optimize=True)
        print(f"Wrote {fill_out.name}, {outline_out.name}")


if __name__ == "__main__":
    main()
