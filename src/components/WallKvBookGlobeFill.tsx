"use client";

import type { WallKvScratchReveal } from "@/lib/wall-kv-layout";
import { isVectorWallKvSrc } from "@/lib/wall-kv-layout";
import {
  wallKvFrameTransformStyle,
  wallKvProgressClip,
} from "@/lib/wall-kv-fill-clip";

type WallKvBookGlobeFillProps = {
  colorSrc: string;
  outlineSrc: string;
  alt: string;
  align?: WallKvScratchReveal["align"];
  /** 0 = outline only, 1 = full color on top */
  progress: number;
  /** Render only outline or color (unified scene uses two passes). */
  part?: "both" | "outline" | "color";
  /** When true, skip per-slot clip (parent applies one scene clip). */
  unifiedColorClip?: boolean;
};

/** White outline + color PNG; optional per-layer or unified bottom-up fill. */
export function WallKvBookGlobeFill({
  colorSrc,
  outlineSrc,
  alt,
  align,
  progress,
  part = "both",
  unifiedColorClip = false,
}: WallKvBookGlobeFillProps) {
  const p = Math.max(0, Math.min(1, progress));
  const showOutline = part === "both" || part === "outline";
  const showColor = part === "both" || part === "color";
  const clip =
    showColor && !unifiedColorClip ? wallKvProgressClip(p) : undefined;
  const outlineIsVector = isVectorWallKvSrc(outlineSrc);
  const colorIsVector = isVectorWallKvSrc(colorSrc);
  const frameStyle = wallKvFrameTransformStyle(align);

  return (
    <div
      className="wall-kv-book-globe-fill"
      role={part === "outline" ? "img" : undefined}
      aria-label={part === "outline" ? alt : undefined}
      data-kv-fill={p.toFixed(4)}
    >
      <div
        className="wall-kv-book-globe-frame wall-kv-book-globe-frame--slot"
        style={frameStyle}
      >
        {showOutline ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={outlineSrc}
            alt=""
            className={`wall-kv-book-globe-outline${outlineIsVector ? " wall-kv-book-globe-outline--vector" : " wall-kv-book-globe-outline--raster"}`}
            draggable={false}
            aria-hidden
            onError={(e) => {
              fallbackRasterSrc(e.currentTarget, outlineSrc);
            }}
          />
        ) : null}
        {showColor ? (
          <div
            className="wall-kv-book-globe-color-wrap"
            style={
              clip
                ? {
                    clipPath: clip,
                    WebkitClipPath: clip,
                  }
                : undefined
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={colorSrc}
              alt=""
              className={`wall-kv-book-globe-color-img${colorIsVector ? " wall-kv-book-globe-color-img--vector" : " wall-kv-book-globe-color-img--raster"}`}
              draggable={false}
              aria-hidden
              onError={(e) => {
                fallbackRasterSrc(e.currentTarget, colorSrc);
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function fallbackRasterSrc(img: HTMLImageElement, src: string) {
  const path = src.split("?")[0].split("#")[0];
  if (!path.toLowerCase().endsWith(".svg")) return;
  if (img.dataset.fallbackTried === "1") return;
  img.dataset.fallbackTried = "1";
  img.src = path.replace(/\.svg$/i, ".png");
  img.classList.remove(
    "wall-kv-book-globe-outline--vector",
    "wall-kv-book-globe-color-img--vector",
  );
  img.classList.add(
    "wall-kv-book-globe-outline--raster",
    "wall-kv-book-globe-color-img--raster",
  );
}
