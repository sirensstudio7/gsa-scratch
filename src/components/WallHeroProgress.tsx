"use client";

import { WallRevealAsset } from "@/components/WallRevealAsset";

type WallHeroProgressProps = {
  progress: number;
  className?: string;
};

/**
 * Cover logo placed to match after-scratch.svg:
 * # landmark + Gemini star centers mapped onto the 1024×619 scene.
 */
const LOGO_PLACEMENT = {
  x: 199.96 / 1024,
  y: 47.64 / 619,
  w: 549.36 / 1024,
  h: 247.59 / 619,
};

/**
 * Same lottery-ticket scratch as hat / pencil / ribbon.
 * Scene = after-scratch (rainbow Gemini).
 * Cover = isolated #Team Google + white star, aligned to that scene.
 */
export function WallHeroProgress({
  progress,
  className = "",
}: WallHeroProgressProps) {
  return (
    <WallRevealAsset
      colorSrc="/assets/wall-hero-after.png?v=1"
      whiteSrc="/assets/wall-logo-cover.png?v=2"
      alt="#Team Google — Google Student Ambassador Graduation Event"
      progress={progress}
      className={`wall-scratch-item--hero ${className}`.trim()}
      knockOutBlack={false}
      coverPlacement={LOGO_PLACEMENT}
    />
  );
}
