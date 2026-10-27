#!/usr/bin/env python3
"""Print book/globe layout boxes from KV_Outline (1024×576)."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
REF = (
    ROOT.parent.parent / ".cursor/projects/Users-rio-Documents-gsa-scratch/assets"
)
# Fallback: repo copy
CANDIDATES = [
    REF / "KV_Outline-4edb605f-9109-4414-80e6-1a467d81a110.jpg",
    ROOT / "public/assets/wall-kv/kv-reference.jpg",
]


def white(p: tuple[int, ...]) -> bool:
    r, g, b, a = p
    return a > 160 and r > 170 and g > 170 and b > 170


def bbox(im: Image.Image, x0: int, y0: int, x1: int, y1: int) -> tuple[int, int, int, int] | None:
    crop = im.crop((x0, y0, x1, y1))
    px = crop.load()
    cw, ch = crop.size
    xs, ys = [], []
    for y in range(ch):
        for x in range(cw):
            if white(px[x, y]):
                xs.append(x + x0)
                ys.append(y + y0)
    if not xs:
        return None
    return min(xs), min(ys), max(xs), max(ys)


def main() -> None:
    path = next((p for p in CANDIDATES if p.is_file()), None)
    if not path:
        raise SystemExit("KV_Outline reference JPG not found")
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    book = bbox(im, 40, 380, 280, h)
    globe = bbox(im, 760, 340, w, h)
    print(f"# from {path.name} ({w}×{h})")
    for name, b in [("buku", book), ("globe", globe)]:
        if not b:
            continue
        x0, y0, x1, y1 = b
        print(f"{name}: box [{x0}, {y0}, {x1 - x0}, {y1 - y0}]")


if __name__ == "__main__":
    main()
