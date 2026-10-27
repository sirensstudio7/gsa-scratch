#!/usr/bin/env python3
"""Build judul-g outline + fill as matched 1024×645 SVGs from the PNG pair.

Outline and fill must share the same artboard (your Figma exports). Do not compose
from separate google-1/google-2 vectors — that drifts size vs the fill composite.
"""

from __future__ import annotations

import base64
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KV = ROOT / "public" / "assets" / "wall-kv"
W, H = 1024, 645

PAIRS = (
    ("judul-g-outline.png", "judul-g-outline.svg"),
    ("judul-g-fill.png", "judul-g-fill.svg"),
)


def png_to_svg(png_path: Path, out_path: Path) -> None:
    if not png_path.is_file():
        raise SystemExit(f"Missing {png_path}")
    b64 = base64.b64encode(png_path.read_bytes()).decode("ascii")
    svg = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'xmlns:xlink="http://www.w3.org/1999/xlink" '
        f'viewBox="0 0 {W} {H}" width="{W}" height="{H}" fill="none">\n'
        f'  <image width="{W}" height="{H}" x="0" y="0" '
        f'preserveAspectRatio="none" '
        f'xlink:href="data:image/png;base64,{b64}"/>\n'
        "</svg>\n"
    )
    out_path.write_text(svg, encoding="utf-8")
    kb = out_path.stat().st_size // 1024
    print(f"Wrote {out_path.name} from {png_path.name} ({W}×{H}, {kb} KB)")


def main() -> None:
    KV.mkdir(parents=True, exist_ok=True)
    for png_name, svg_name in PAIRS:
        png_to_svg(KV / png_name, KV / svg_name)


if __name__ == "__main__":
    main()
