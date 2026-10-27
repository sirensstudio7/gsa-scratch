import type { WallKvScratchReveal } from "@/lib/wall-kv-layout";
import type { CSSProperties } from "react";

/**
 * One shared wave for judul + books + globe: bottom-weighted art reads ~40% fuller
 * than tap % at mid progress. Exponent > 1 lowers the wave so 5/10 taps ≈ half full.
 */
export const WALL_KV_UNIFIED_WAVE_TAP_EXPONENT = 1.65;

/** Map staff tap ratio → unified wave height (still 0 at 0 taps, 1 at 100%). */
export function wallKvUnifiedWaveFromTapProgress(tapProgress: number): number {
  const p = Math.max(0, Math.min(1, tapProgress));
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  return Math.pow(p, WALL_KV_UNIFIED_WAVE_TAP_EXPONENT);
}

/** Shared bottom-up clip for the whole KV scene (one progress line). */
export function wallKvProgressClip(progress: number): string {
  const p = Math.max(0, Math.min(1, progress));
  if (p <= 0.0005) return "inset(100% 0 0 0)";
  if (p >= 0.9995) return "none";
  return `inset(${(1 - p) * 100}% 0 0 0)`;
}

/** SVG path (objectBoundingBox 0–1) — filled region below a smooth wavy top edge. */
export function wallKvWaveClipPathD(
  progress: number,
  phaseRad: number,
  segments = 80,
): string {
  const p = Math.max(0, Math.min(1, progress));
  if (p <= 0.0005) return "M 0 1 L 1 1 L 1 1 L 0 1 Z";
  if (p >= 0.9995) return "M 0 0 L 1 0 L 1 1 L 0 1 Z";

  const baseY = 1 - p;
  const amp = 0.013;

  const yAt = (x: number) => {
    const t = x * Math.PI * 2;
    const ripple =
      0.62 * Math.sin(t * 2.25 + phaseRad) +
      0.38 * Math.sin(t * 3.65 - phaseRad * 0.75);
    return Math.max(0, Math.min(1, baseY + amp * ripple));
  };

  let d = `M 0 1 L 1 1 L 1 ${yAt(1).toFixed(6)}`;
  for (let i = segments - 1; i >= 0; i -= 1) {
    const x = i / segments;
    d += ` L ${x.toFixed(6)} ${yAt(x).toFixed(6)}`;
  }
  d += " Z";
  return d;
}

export function wallKvFrameTransformStyle(
  align?: WallKvScratchReveal["align"],
): CSSProperties | undefined {
  if (!align) return undefined;
  const {
    rotateDeg = 0,
    scale = 1,
    offsetX = 0,
    offsetY = 0,
    transformOrigin = "50% 50%",
  } = align;
  const parts: string[] = [];
  if (offsetX || offsetY) {
    parts.push(`translate(${offsetX * 100}%, ${offsetY * 100}%)`);
  }
  if (rotateDeg) parts.push(`rotate(${rotateDeg}deg)`);
  if (scale !== 1) parts.push(`scale(${scale})`);
  if (!parts.length) return undefined;
  return { transform: parts.join(" "), transformOrigin };
}
