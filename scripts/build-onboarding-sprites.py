#!/usr/bin/env python3
"""Build per-icon sprites + layout.json from bubble.png / unwrap.png.

Bubble positions come only from bubble.png detection. Unwrap sprites are
cropped at the same (x, y) anchor on unwrap.png so icon-XX always pairs
correctly — no greedy cross-matching.
"""

from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public" / "assets"
OUT = ASSETS / "onboarding"
SPRITES = OUT / "sprites"


def detect(path: Path, *, min_a: int, max_a: int, step: int, dist: int):
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    px = im.load()
    mask = [[False] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 80 and (r + g + b) / 3 > 35:
                mask[y][x] = True
    visited = [[False] * w for _ in range(h)]
    comps: list[tuple[int, float, float]] = []
    for sy in range(0, h, step):
        for sx in range(0, w, step):
            if not mask[sy][sx] or visited[sy][sx]:
                continue
            q = deque([(sx, sy)])
            visited[sy][sx] = True
            xs: list[int] = []
            ys: list[int] = []
            while q:
                x, y = q.popleft()
                xs.append(x)
                ys.append(y)
                for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2)):
                    nx, ny = x + dx, y + dy
                    if (
                        0 <= nx < w
                        and 0 <= ny < h
                        and mask[ny][nx]
                        and not visited[ny][nx]
                    ):
                        visited[ny][nx] = True
                        q.append((nx, ny))
            if min_a < len(xs) < max_a:
                comps.append((len(xs), sum(xs) / len(xs), sum(ys) / len(ys)))
    filtered: list[tuple[int, float, float]] = []
    for area, cx, cy in sorted(comps, key=lambda t: -t[0]):
        if any((cx - fx) ** 2 + (cy - fy) ** 2 < dist**2 for _, fx, fy in filtered):
            continue
        filtered.append((area, cx, cy))
    filtered.sort(key=lambda t: (t[2], t[1]))
    return im, filtered


def crop_sprite(im: Image.Image, cx: float, cy: float, crop: int) -> Image.Image:
    iw, ih = im.size
    x0, y0 = int(cx - crop / 2), int(cy - crop / 2)
    pad = Image.new("RGBA", (crop, crop), (0, 0, 0, 0))
    sx, sy = max(0, x0), max(0, y0)
    ex, ey = min(iw, x0 + crop), min(ih, y0 + crop)
    pad.paste(im.crop((sx, sy, ex, ey)), (sx - x0, sy - y0))
    return pad


def write_sprite_svg(
    path: Path,
    *,
    view_w: int,
    view_h: int,
    kind: str,
    icons: list[dict],
    crop: int,
) -> None:
    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {view_w} {view_h}">',
    ]
    for icon in icons:
        iid = icon["id"]
        bx, by = icon["bubble"]
        x = bx * view_w - crop / 2
        y = by * view_h - crop / 2
        href = f"/assets/onboarding/sprites/{iid}-{kind}.png"
        lines.append(f'  <g id="{iid}" data-kind="{kind}">')
        lines.append(
            f'    <image href="{href}" x="{x:.2f}" y="{y:.2f}" '
            f'width="{crop}" height="{crop}" />'
        )
        lines.append("  </g>")
    lines.append("</svg>")
    path.write_text("\n".join(lines) + "\n")


def main() -> None:
    SPRITES.mkdir(parents=True, exist_ok=True)
    bubble_im, bubble = detect(
        ASSETS / "bubble.png", min_a=691, max_a=30000, step=3, dist=55
    )
    unwrap_im, _unwrap = detect(
        ASSETS / "unwrap.png", min_a=125, max_a=8000, step=2, dist=35
    )
    w, h = bubble_im.size
    uw, uh = unwrap_im.size

    bubble_pts = sorted(
        [(cx, cy) for _, cx, cy in bubble],
        key=lambda p: (p[1], p[0]),
    )

    crop = int(w * 0.112)
    icons: list[dict] = []
    for i, (bx, by) in enumerate(bubble_pts):
        iid = f"icon-{i:02d}"
        b_norm = (bx / w, by / h)
        # Same horizontal anchor; scale Y if unwrap comp height differs
        uy = by * uh / h
        crop_sprite(bubble_im, bx, by, crop).save(SPRITES / f"{iid}-bubble.png")
        crop_sprite(unwrap_im, bx, uy, crop).save(SPRITES / f"{iid}-unwrap.png")
        icons.append(
            {
                "id": iid,
                "bubble": list(b_norm),
                "unwrap": list(b_norm),
                "size": crop / w,
            }
        )

    import json

    layout = {"viewBox": [0, 0, w, h], "icons": icons}
    (OUT / "layout.json").write_text(json.dumps(layout, indent=2) + "\n")
    write_sprite_svg(
        OUT / "bubble.svg",
        view_w=w,
        view_h=h,
        kind="bubble",
        icons=icons,
        crop=crop,
    )
    write_sprite_svg(
        OUT / "unwrap.svg",
        view_w=uw,
        view_h=uh,
        kind="unwrap",
        icons=icons,
        crop=crop,
    )
    print(f"Wrote {len(icons)} icons to {OUT}")


if __name__ == "__main__":
    main()
