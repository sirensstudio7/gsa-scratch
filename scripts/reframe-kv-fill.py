#!/usr/bin/env python3
"""Reframe color fill PNGs to match outline canvas + ink bbox (book/globe)."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
KV = ROOT / "public" / "assets" / "wall-kv"


def alpha_bbox(im: Image.Image, threshold: int = 40) -> tuple[int, int, int, int]:
    px = im.load()
    w, h = im.size
    xs, ys = [], []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > threshold:
                xs.append(x)
                ys.append(y)
    if not xs:
        raise SystemExit("empty image")
    return min(xs), min(ys), max(xs), max(ys)


def reframe_pair(outline_name: str, fill_name: str, out_name: str) -> None:
    outline = Image.open(KV / outline_name).convert("RGBA")
    fill = Image.open(KV / fill_name).convert("RGBA")
    ox0, oy0, ox1, oy1 = alpha_bbox(outline)
    fx0, fy0, fx1, fy1 = alpha_bbox(fill)
    ow, oh = ox1 - ox0 + 1, oy1 - oy0 + 1
    fill_crop = fill.crop((fx0, fy0, fx1 + 1, fy1 + 1))
    fill_fit = fill_crop.resize((ow, oh), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", outline.size, (0, 0, 0, 0))
    out.alpha_composite(fill_fit, (ox0, oy0))
    dest = KV / out_name
    out.save(dest, optimize=True)
    print(f"Wrote {dest.name} ({outline.size[0]}×{outline.size[1]})")


def main() -> None:
    reframe_pair("buku.png", "buku-fill.png", "buku-fill.png")
    reframe_pair("globe-outline.png", "globe-fill.png", "globe-fill.png")


if __name__ == "__main__":
    main()
