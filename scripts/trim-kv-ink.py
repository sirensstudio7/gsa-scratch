#!/usr/bin/env python3
"""Trim KV layer PNGs to tight ink bounds (+pad) for meet-fit in layout slots."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
KV = ROOT / "public" / "assets" / "wall-kv"
PAD = 2

TRIMS: list[tuple[str, str, str]] = [
    ("buku.png", "buku-fill.png", "buku"),
    ("globe-outline.png", "globe-fill.png", "globe"),
]


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


def trim_pair(outline: str, fill: str, stem: str) -> None:
    o = Image.open(KV / outline).convert("RGBA")
    f = Image.open(KV / fill).convert("RGBA")
    if o.size != f.size:
        raise SystemExit(f"{outline} and {fill} size mismatch")
    x0, y0, x1, y1 = alpha_bbox(o)
    x0 = max(0, x0 - PAD)
    y0 = max(0, y0 - PAD)
    x1 = min(o.size[0] - 1, x1 + PAD)
    y1 = min(o.size[1] - 1, y1 + PAD)
    box = (x0, y0, x1 + 1, y1 + 1)
    o_t = o.crop(box)
    f_t = f.crop(box)
    o_t.save(KV / f"{stem}.png", optimize=True)
    f_t.save(KV / f"{stem}-fill.png", optimize=True)
    print(f"{stem}: trimmed {box[2]-box[0]}×{box[3]-box[1]} → {stem}.png + {stem}-fill.png")


def main() -> None:
    for outline, fill, stem in TRIMS:
        trim_pair(outline, fill, stem)


if __name__ == "__main__":
    main()
