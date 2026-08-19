"use client";

import { WallRevealAsset } from "@/components/WallRevealAsset";

type WallHeroProgressProps = {
  progress: number;
  className?: string;
};

/**
 * Cover logo placed on the fitted 2048×1238 scene.
 * Box is the #Team Google plaques + Gemini star in that frame.
 */
const LOGO_PLACEMENT = {
  x: 408 / 2048,
  y: 103 / 1238,
  w: 1086 / 2048,
  h: 492 / 1238,
};

/**
 * Same lottery-ticket scratch as hat / pencil / ribbon.
 * Scene = after (rainbow Gemini).
 * Cover = isolated #Team Google + white star, aligned to that scene.
 */
export function WallHeroProgress({
  progress,
  className = "",
}: WallHeroProgressProps) {
  return (
    <WallRevealAsset
      colorSrc="/assets/wall-hero-after.png?v=16"
      whiteSrc="/assets/wall-logo-cover.png?v=16"
      alt="#Team Google — Google Student Ambassador Graduation Event"
      progress={progress}
      className={`wall-scratch-item--hero ${className}`.trim()}
      knockOutBlack={false}
      coverPlacement={LOGO_PLACEMENT}
    />
  );
}
