#!/usr/bin/env python3
"""Bake public/assets/wall-kv/kv-outline-composite.png from layer PNGs."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
KV = ROOT / "public" / "assets" / "wall-kv"
W, H = 1024, 576

BOXES: dict[str, tuple[int, int, int, int]] = {
    "google.png": (446, 82, 132, 42),
    "judul.png": (249, 129, 530, 190),
    "shape-sub-judul.png": (341, 330, 348, 50),
    "buku.png": (54, 400, 192, 184),
    "globe.png": (813, 377, 152, 160),
}


def fit_into(src: Image.Image, tw: int, th: int) -> Image.Image:
    s = min(tw / src.size[0], th / src.size[1])
    nw = max(1, int(round(src.size[0] * s)))
    nh = max(1, int(round(src.size[1] * s)))
    return src.resize((nw, nh), Image.Resampling.LANCZOS)


def main() -> None:
    comp = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for fn, (x, y, bw, bh) in BOXES.items():
        path = KV / fn
        if not path.is_file():
            raise SystemExit(f"Missing {path}")
        art = Image.open(path).convert("RGBA")
        placed = fit_into(art, bw, bh)
        ox = x + (bw - placed.size[0]) // 2
        oy = y + (bh - placed.size[1]) // 2
        comp.alpha_composite(placed, (ox, oy))
    out = KV / "kv-outline-composite.png"
    comp.save(out, optimize=True)
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
