import type { CSSProperties } from "react";
import layout from "@/data/wall-kv-layout.json";

/**
 * Mobile /wall — gap between the screen bottom and the red book slot.
 * Smaller = lower on the phone. (CSS `bottom` is not “move down by N px”.)
 */
export const WALL_KV_MOBILE_BUKU_BOTTOM_INSET_PX = 36;

/** Extra nudge toward the bottom of the screen (positive = down). */
export const WALL_KV_MOBILE_BUKU_SHIFT_DOWN_PX = 140;

/** Extra nudge toward the left (positive = left). */
export const WALL_KV_MOBILE_BUKU_SHIFT_LEFT_PX = 72;

/** Shared slot box for red books + globe on phone (keep in sync). */
export const WALL_KV_MOBILE_CORNER_ART_SIZE_VW = 60;
export const WALL_KV_MOBILE_CORNER_ART_SIZE_VH = 38;

export const WALL_KV_MOBILE_GLOBE_BOTTOM_INSET_PX =
  WALL_KV_MOBILE_BUKU_BOTTOM_INSET_PX;

/** Positive = down (same idea as red books). */
export const WALL_KV_MOBILE_GLOBE_SHIFT_DOWN_PX = 40;

/** Positive = toward the right edge. */
export const WALL_KV_MOBILE_GLOBE_SHIFT_RIGHT_PX = 140;

/** Mobile celebration trophy — positive = up (added to CSS `bottom`). */
export const WALL_KV_MOBILE_TROPHY_SHIFT_UP_PX = 56;

function wallKvMobileCornerArtBox(): Pick<
  CSSProperties,
  "width" | "height"
> {
  const size = `min(${WALL_KV_MOBILE_CORNER_ART_SIZE_VW}vw, ${WALL_KV_MOBILE_CORNER_ART_SIZE_VH}vh)`;
  return { width: size, height: size };
}

/** Bump when replacing files in public/assets/wall-kv/ (browser cache). */
export const WALL_KV_ASSET_VERSION = "20251027-celebration-v1";

export function isVectorWallKvSrc(src: string): boolean {
  const path = src.split("?")[0].split("#")[0];
  return path.toLowerCase().endsWith(".svg");
}

export type WallKvColorAlign = {
  outlineFrame?: [number, number];
  rotateDeg?: number;
  colorFit?: "meet" | "cover";
  scale?: number;
  offsetX?: number;
  offsetY?: number;
  transformOrigin?: string;
};

/** Outline + color — bottom-up fill on bubble progress. */
export type WallKvScratchReveal = {
  colorSrc: string;
  whiteSrc: string;
  alt: string;
  align?: WallKvColorAlign;
  colorAlign?: Partial<WallKvColorAlign>;
  knockOutBlack?: boolean;
};

/** Title + books + globe — one bubble progress, one shared fill wipe. */
export const WALL_KV_UNIFIED_FILL_LAYER_IDS = ["judul", "buku", "globe"] as const;

export type WallKvUnifiedFillLayerId =
  (typeof WALL_KV_UNIFIED_FILL_LAYER_IDS)[number];

export const WALL_KV_SCRATCH_REVEAL: Record<string, WallKvScratchReveal> = {
  judul: {
    colorSrc: "/assets/wall-kv/judul-g-fill.png",
    whiteSrc: "/assets/wall-kv/judul-g-outline.png",
    alt: "Google Student Ambassador",
  },
  buku: {
    colorSrc: "/assets/wall-kv/buku-fill.png",
    whiteSrc: "/assets/wall-kv/buku-outline.png",
    alt: "Books",
    align: {
      rotateDeg: -10,
      transformOrigin: "50% 50%",
      offsetY: 0.06,
    },
  },
  globe: {
    colorSrc: "/assets/wall-kv/globe-fill.png",
    whiteSrc: "/assets/wall-kv/globe-outline.png",
    alt: "Globe",
    align: {
      rotateDeg: 35,
      transformOrigin: "50% 50%",
    },
  },
};

export type WallKvLayerFit = "meet" | "cover";

export type WallKvLayer = {
  id: string;
  src: string;
  alt: string;
  box: [number, number, number, number];
  fit?: WallKvLayerFit;
  natural?: [number, number];
};

export function wallKvLayerObjectFit(
  layer: Pick<WallKvLayer, "fit">,
): "contain" | "cover" {
  return layer.fit === "cover" ? "cover" : "contain";
}

export type WallKvLayoutFile = {
  viewBox: [number, number, number, number];
  layers: WallKvLayer[];
};

export function getWallKvLayout() {
  return layout as WallKvLayoutFile;
}

export function wallKvAssetSrc(src: string) {
  const sep = src.includes("?") ? "&" : "?";
  return `${src}${sep}v=${WALL_KV_ASSET_VERSION}`;
}

export const WALL_KV_GLOBE_OFFSET_PX = { x: 100, y: 80 } as const;
export const WALL_KV_JUDUL_OFFSET_PX = { x: 0, y: 100 } as const;

/** Judul / GSA logo — compact top-left when wall is at 100% (viewBox px). */
export const WALL_KV_JUDUL_CELEBRATION_BOX: [number, number, number, number] =
  [8, 6, 168, 110];

export function wallKvJudulCelebrationStyle() {
  return wallKvLayerStyle({ box: WALL_KV_JUDUL_CELEBRATION_BOX });
}

/** Phone portrait — fixed red books (CSS alone was overridden by float animation). */
export function wallKvMobileBukuSlotStyle(): CSSProperties {
  const down = WALL_KV_MOBILE_BUKU_SHIFT_DOWN_PX;
  const left = WALL_KV_MOBILE_BUKU_SHIFT_LEFT_PX;
  const transform =
    down || left ? `translate3d(${-left}px, ${down}px, 0)` : undefined;
  return {
    position: "fixed",
    left: 0,
    top: "auto",
    right: "auto",
    bottom: `calc(${WALL_KV_MOBILE_BUKU_BOTTOM_INSET_PX}px + env(safe-area-inset-bottom, 0px))`,
    ...wallKvMobileCornerArtBox(),
    zIndex: 8,
    ...(transform ? { transform } : {}),
  };
}

/** Phone portrait — fixed globe (bottom-right, shifts match red books). */
export function wallKvMobileGlobeSlotStyle(): CSSProperties {
  const down = WALL_KV_MOBILE_GLOBE_SHIFT_DOWN_PX;
  const right = WALL_KV_MOBILE_GLOBE_SHIFT_RIGHT_PX;
  const transform =
    down || right ? `translate3d(${right}px, ${down}px, 0)` : undefined;
  return {
    position: "fixed",
    left: "auto",
    right: 0,
    top: "auto",
    bottom: `calc(${WALL_KV_MOBILE_GLOBE_BOTTOM_INSET_PX}px + env(safe-area-inset-bottom, 0px))`,
    ...wallKvMobileCornerArtBox(),
    zIndex: 8,
    ...(transform ? { transform } : {}),
  };
}

const WALL_KV_LAYER_OFFSET_PX: Record<string, { x: number; y: number }> = {
  globe: WALL_KV_GLOBE_OFFSET_PX,
  judul: WALL_KV_JUDUL_OFFSET_PX,
};

export function wallKvLayerStyle(layer: Pick<WallKvLayer, "box">) {
  const [, , vw, vh] = getWallKvLayout().viewBox;
  const [x, y, w, h] = layer.box;
  return {
    left: `${(x / vw) * 100}%`,
    top: `${(y / vh) * 100}%`,
    width: `${(w / vw) * 100}%`,
    height: `${(h / vh) * 100}%`,
  };
}

/** Layer slot on the KV scene (includes per-layer px nudges). */
export function wallKvLayerPlacementStyle(
  layer: Pick<WallKvLayer, "id" | "box">,
) {
  const base = wallKvLayerStyle(layer);
  const offset = WALL_KV_LAYER_OFFSET_PX[layer.id];
  if (!offset) return base;
  const { x, y } = offset;
  if (!x && !y) return base;
  return {
    ...base,
    left: x ? `calc(${base.left} + ${wallKvPx(x)})` : base.left,
    top: y ? `calc(${base.top} + ${wallKvPx(y)})` : base.top,
  };
}

/** Desktop nudges stay 1:1. Phones set --wall-kv-px-scale so the same offsets fit the scene. */
function wallKvPx(px: number) {
  return `calc(${px}px * var(--wall-kv-px-scale, 1))`;
}
