import {
  getWallKvLayout,
  WALL_KV_GLOBE_OFFSET_PX,
  wallKvLayerStyle,
  type WallKvLayer,
} from "@/lib/wall-kv-layout";

export const WALL_KV_CELEBRATION_ASSETS = {
  bookOpen: "/assets/wall-kv/celebration-book-open.png",
  laptop: "/assets/wall-kv/celebration-laptop.png",
  trophy: "/assets/wall-kv/celebration-trophy.png",
} as const;

/** Fraction of anchor layer box: left, top, width, height (may extend outside 0–1). */
export type WallKvCelebrationAnchor = {
  layerId: string;
  /** Scene box, or frame-local box when `frameAlignLayerId` is set. */
  relBox: [number, number, number, number];
  zIndex?: number;
  /** Match WallKvBookGlobeFill transform (e.g. buku −10°) before applying relBox. */
  frameAlignLayerId?: string;
  /** Extra nudge after relBox (px). */
  offsetPx?: { x?: number; y?: number };
};

export const WALL_KV_CELEBRATION_PLACEMENT: Record<
  keyof typeof WALL_KV_CELEBRATION_ASSETS,
  WallKvCelebrationAnchor
> = {
  bookOpen: {
    layerId: "buku",
    frameAlignLayerId: "buku",
    zIndex: 14,
    /* Top-left of red cover in buku-fill.png (frame-local %). */
    relBox: [0.05, 0.14, 0.26, 0.32],
    offsetPx: { y: -80 },
  },
  laptop: {
    layerId: "globe",
    relBox: [0.27, -0.1, 0.42, 0.38],
    offsetPx: { x: 40 },
    zIndex: 15,
  },
  trophy: {
    layerId: "globe",
    relBox: [-0.4, 0.3, 0.28, 0.34],
    offsetPx: { x: 140 },
    zIndex: 16,
  },
};

function wallKvPx(px: number) {
  return `calc(${px}px * var(--wall-kv-px-scale, 1))`;
}

function findLayer(layerId: string): WallKvLayer | undefined {
  return getWallKvLayout().layers.find((l) => l.id === layerId);
}

/** Scene % box from a placement anchored to a KV layer. */
export function wallKvCelebrationStyle(anchor: WallKvCelebrationAnchor) {
  const layer = findLayer(anchor.layerId);
  if (!layer) return undefined;
  const [lx, ly, lw, lh] = layer.box;
  const [rl, rt, rw, rh] = anchor.relBox;
  const box: [number, number, number, number] = [
    lx + lw * rl,
    ly + lh * rt,
    lw * rw,
    lh * rh,
  ];
  let style = wallKvLayerStyle({ box });
  if (anchor.layerId === "globe") {
    const { x, y } = WALL_KV_GLOBE_OFFSET_PX;
    if (x || y) {
      style = {
        ...style,
        left: x ? `calc(${style.left} + ${wallKvPx(x)})` : style.left,
        top: y ? `calc(${style.top} + ${wallKvPx(y)})` : style.top,
      };
    }
  }
  const ox = anchor.offsetPx?.x ?? 0;
  const oy = anchor.offsetPx?.y ?? 0;
  if (ox || oy) {
    return {
      ...style,
      left: ox ? `calc(${style.left} + ${wallKvPx(ox)})` : style.left,
      top: oy ? `calc(${style.top} + ${wallKvPx(oy)})` : style.top,
    };
  }
  return style;
}
