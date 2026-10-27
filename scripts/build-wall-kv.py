#!/usr/bin/env python3
"""
Build wall KV art at 2× supersample → sharp 1024×576 composite (+ optional self-contained SVG).

True Figma vectors: add google.svg, judul.svg, … (with <path>, no PNG href) and rebuild.
"""

from __future__ import annotations

import base64
import re
import subprocess
from pathlib import Path
from xml.etree import ElementTree as ET

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
KV = ROOT / "public" / "assets" / "wall-kv"
W, H = 1024, 576
SUPER = 2  # render comp at 2× then downsample to W×H for crisp lines

# Measured from KV_Outline reference (1024×576 white-stroke bounds).
BOXES: dict[str, tuple[int, int, int, int]] = {
    "google": (448, 84, 128, 39),
    "judul": (251, 90, 526, 220),
    "shape-sub-judul": (339, 332, 352, 33),
    "buku": (0, 321, 432, 315),
    "globe": (648, 272, 315, 304),
}

# Always contain-fit — cover cropped full-comp PNGs and duplicated the title.
LAYER_FIT: dict[str, str] = {k: "meet" for k in BOXES}

# Layer PNGs that must not be replaced by SVG (framing matches Figma export).
PNG_LAYERS = frozenset({"judul", "shape-sub-judul"})


def trim_png(path: Path, pad: int = 1) -> None:
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    px = im.load()
    xs, ys = [], []
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 40 and r + g + b > 90:
                xs.append(x)
                ys.append(y)
    if not xs:
        return
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(w - 1, x1 + pad)
    y1 = min(h - 1, y1 + pad)
    im.crop((x0, y0, x1 + 1, y1 + 1)).save(path, compress_level=3)


def fit_scale(sw: int, sh: int, tw: int, th: int, mode: str) -> float:
    if mode == "cover":
        return max(tw / sw, th / sh)
    return min(tw / sw, th / sh)


def fit_into(src: Image.Image, tw: int, th: int, mode: str = "meet") -> Image.Image:
    s = fit_scale(src.size[0], src.size[1], tw, th, mode)
    nw = max(1, int(round(src.size[0] * s)))
    nh = max(1, int(round(src.size[1] * s)))
    return src.resize((nw, nh), Image.Resampling.LANCZOS)


def write_composite_png() -> None:
    big_w, big_h = W * SUPER, H * SUPER
    comp = Image.new("RGBA", (big_w, big_h), (0, 0, 0, 0))
    for stem, (x, y, bw, bh) in BOXES.items():
        png = KV / f"{stem}.png"
        if not png.is_file():
            raise SystemExit(f"Missing {png}")
        art = Image.open(png).convert("RGBA")
        bx, by, bbw, bbh = x * SUPER, y * SUPER, bw * SUPER, bh * SUPER
        mode = LAYER_FIT.get(stem, "meet")
        placed = fit_into(art, bbw, bbh, mode)
        ox = bx + (bbw - placed.size[0]) // 2
        oy = by + (bbh - placed.size[1]) // 2
        comp.alpha_composite(placed, (ox, oy))
    sharp = comp.resize((W, H), Image.Resampling.LANCZOS)
    out = KV / "kv-outline-composite.png"
    sharp.save(out, compress_level=3)
    print(f"Wrote {out} ({W}×{H}, supersampled {SUPER}×)")


def normalize_wall_fill(markup: str) -> str:
    """Figma exports use #F0F4FA; wall art is white on transparent."""
    markup = re.sub(r'fill="#F0F4FA"', 'fill="white"', markup, flags=re.I)
    markup = re.sub(r'fill="#f0f4fa"', 'fill="white"', markup)
    markup = re.sub(r'stroke="#F0F4FA"', 'stroke="white"', markup, flags=re.I)
    return markup


def is_vector_svg(text: str) -> bool:
    if re.search(r'href\s*=\s*["\'][^"\']+\.png', text, re.I):
        return False
    return bool(re.search(r"<(?:path|polyline|polygon|line|circle|rect)\b", text, re.I))


def parse_view_box(svg_text: str) -> tuple[float, float, float, float]:
    m = re.search(r'viewBox\s*=\s*["\']([^"\']+)["\']', svg_text)
    if not m:
        return 0, 0, 1, 1
    parts = [float(p) for p in m.group(1).split()]
    return tuple(parts[:4])  # type: ignore


def svg_inner_markup(svg_text: str) -> str:
    try:
        root = ET.fromstring(svg_text)
    except ET.ParseError:
        inner = re.sub(r"^[\s\S]*?<svg[^>]*>", "", svg_text, count=1, flags=re.I)
        return re.sub(r"</svg>\s*$", "", inner, flags=re.I)
    return "".join(ET.tostring(c, encoding="unicode") for c in root if root.tag.split("}")[-1] == "svg")


def layer_vector_fragment(
    stem: str, x: int, y: int, bw: int, bh: int, mode: str = "meet"
) -> str | None:
    svg_path = KV / f"{stem}.svg"
    if not svg_path.is_file():
        return None
    text = svg_path.read_text(encoding="utf-8")
    if not is_vector_svg(text):
        return None
    vx, vy, vw, vh = parse_view_box(text)
    inner = normalize_wall_fill(svg_inner_markup(text))
    s = fit_scale(vw, vh, bw, bh, mode) if vw and vh else 1
    dw, dh = vw * s, vh * s
    ox, oy = x + (bw - dw) / 2, y + (bh - dh) / 2
    return (
        f'  <g transform="translate({ox:.3f} {oy:.3f}) scale({s:.6f}) '
        f'translate({-vx:.3f} {-vy:.3f})">{inner.strip()}</g>'
    )


def write_outline_svg() -> None:
    """Scene SVG: vectors where possible; PNG only for judul + pill."""
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">',
    ]
    vector_n = 0
    for stem, (x, y, bw, bh) in BOXES.items():
        mode = LAYER_FIT.get(stem, "meet")
        if stem in PNG_LAYERS:
            lines.append(layer_embedded_image(stem, x, y, bw, bh, mode))
            print(f"  {stem}: PNG ({mode})")
            continue
        frag = layer_vector_fragment(stem, x, y, bw, bh, mode)
        if frag:
            lines.append(frag)
            vector_n += 1
            print(f"  {stem}: vector SVG ({mode})")
        elif (KV / f"{stem}.png").is_file():
            lines.append(layer_embedded_image(stem, x, y, bw, bh, mode))
            print(f"  {stem}: PNG fallback ({mode})")
        else:
            raise SystemExit(f"Missing {stem}.png or vector {stem}.svg")
    lines.append("</svg>")
    out = KV / "kv-outline.svg"
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    kb = out.stat().st_size // 1024
    print(f"Wrote {out} ({kb} KB, {vector_n}/{len(BOXES)} vector layers)")


def layer_embedded_image(
    stem: str, x: int, y: int, bw: int, bh: int, mode: str = "meet"
) -> str:
    png = KV / f"{stem}.png"
    if not png.is_file():
        raise SystemExit(f"Missing {stem}.svg or {stem}.png")
    b64 = base64.b64encode(png.read_bytes()).decode("ascii")
    href = f"data:image/png;base64,{b64}"
    par = "xMidYMid slice" if mode == "cover" else "xMidYMid meet"
    return (
        f'  <image href="{href}" x="{x}" y="{y}" width="{bw}" height="{bh}" '
        f'preserveAspectRatio="{par}" />'
    )


TEAMGOOGLE_RASTER_WIDTHS: tuple[tuple[str, int], ...] = (
    ("", 757),
    ("@2x", 1514),
    ("@4x", 3028),
)


def rasterize_teamgoogle_pngs() -> None:
    """Sharp scratch PNGs from teamgoogle.svg (google-4 export), not upscaled bitmaps."""
    svg = KV / "teamgoogle.svg"
    if not svg.is_file():
        return
    write_teamgoogle_cover_svg()
    for suffix, width in TEAMGOOGLE_RASTER_WIDTHS:
        for stem in ("teamgoogle", "teamgoogle-cover"):
            src = KV / f"{stem}.svg"
            if not src.is_file():
                continue
            out = KV / f"{stem}{suffix}.png"
            subprocess.run(
                [
                    "npx",
                    "@resvg/resvg-js-cli",
                    "--fit-width",
                    str(width),
                    "--shape-rendering",
                    "2",
                    str(src),
                    str(out),
                ],
                cwd=ROOT,
                check=True,
            )
            print(f"Wrote {out.name} ({width}px wide, from SVG)")


def write_teamgoogle_cover_svg() -> None:
    src = KV / "teamgoogle.svg"
    if not src.is_file():
        return
    text = src.read_text(encoding="utf-8")
    if not is_vector_svg(text):
        return
    inner = normalize_wall_fill(svg_inner_markup(text))
    vx, vy, vw, vh = parse_view_box(text)
    cover = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vx} {vy} {vw} {vh}">\n'
        f"{inner.strip()}\n</svg>\n"
    )
    (KV / "teamgoogle-cover.svg").write_text(cover, encoding="utf-8")
    print("Wrote teamgoogle-cover.svg (vector white mask)")


def main() -> None:
    KV.mkdir(parents=True, exist_ok=True)
    for stem in BOXES:
        p = KV / f"{stem}.png"
        if p.is_file():
            trim_png(p)
    try:
        write_composite_png()
    except SystemExit as e:
        print(f"Skipping composite PNG ({e})")
    write_outline_svg()
    rasterize_teamgoogle_pngs()


if __name__ == "__main__":
    main()
