"use client";

import type { CSSProperties } from "react";
import { WallRevealAsset } from "@/components/WallRevealAsset";
import { wallKvAssetSrc } from "@/lib/wall-kv-layout";

const TEAMGOOGLE_COLOR = "/assets/wall-kv/teamgoogle.png";
const TEAMGOOGLE_COVER = "/assets/wall-kv/google-4.svg";

type WallHeroProgressProps = {
  progress: number;
  className?: string;
  placementStyle?: CSSProperties;
};

/** #TeamGoogle — same coin-brush scratch as legacy wall hero. */
export function WallHeroProgress({
  progress,
  className = "",
  placementStyle,
}: WallHeroProgressProps) {
  return (
    <div
      className={`wall-kv-slot wall-kv-scratch-slot wall-kv-teamgoogle ${className}`.trim()}
      style={placementStyle}
    >
      <WallRevealAsset
        colorSrc={wallKvAssetSrc(TEAMGOOGLE_COLOR)}
        whiteSrc={wallKvAssetSrc(TEAMGOOGLE_COVER)}
        alt="#Team Google"
        progress={progress}
        boxed={false}
        knockOutBlack={false}
        className="wall-kv-scratch-fill"
      />
    </div>
  );
}
