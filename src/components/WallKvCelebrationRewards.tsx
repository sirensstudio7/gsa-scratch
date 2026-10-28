"use client";

import { useCallback, useSyncExternalStore, type CSSProperties } from "react";
import { ONBOARDING_MOBILE_MQ } from "@/lib/onboarding-layout";
import {
  WALL_KV_CELEBRATION_ASSETS,
  WALL_KV_CELEBRATION_PLACEMENT,
  wallKvCelebrationStyle,
} from "@/lib/wall-kv-celebration";
import { wallKvFrameTransformStyle } from "@/lib/wall-kv-fill-clip";
import {
  getWallKvLayout,
  WALL_KV_SCRATCH_REVEAL,
  wallKvAssetSrc,
  wallKvLayerStyle,
  wallKvMobileBukuSlotStyle,
} from "@/lib/wall-kv-layout";

function useWallKvMobile() {
  const subscribe = useCallback((onStoreChange: () => void) => {
    const mq = window.matchMedia(ONBOARDING_MOBILE_MQ);
    mq.addEventListener("change", onStoreChange);
    return () => mq.removeEventListener("change", onStoreChange);
  }, []);
  const getSnapshot = useCallback(
    () => window.matchMedia(ONBOARDING_MOBILE_MQ).matches,
    [],
  );
  const getServerSnapshot = useCallback(() => false, []);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

type WallKvCelebrationRewardsProps = {
  visible: boolean;
};

const ENTRANCE_DELAY: Record<keyof typeof WALL_KV_CELEBRATION_ASSETS, string> =
  {
    bookOpen: "0s",
    laptop: "0.12s",
    trophy: "0.22s",
  };

/** Phone portrait — keep scene uncluttered; red books + globe stay in KV fill. */
const MOBILE_HIDDEN_REWARDS: ReadonlySet<
  keyof typeof WALL_KV_CELEBRATION_ASSETS
> = new Set(["bookOpen", "laptop", "trophy"]);

function frameLocalStyle(
  relBox: [number, number, number, number],
  offsetPx?: { x?: number; y?: number },
): CSSProperties {
  const [left, top, width, height] = relBox;
  const ox = offsetPx?.x ?? 0;
  const oy = offsetPx?.y ?? 0;
  return {
    left: `${left * 100}%`,
    top: `${top * 100}%`,
    width: `${width * 100}%`,
    height: `${height * 100}%`,
    ...(ox || oy
      ? {
          transform: `translate(calc(${ox}px * var(--wall-kv-px-scale, 1)), calc(${oy}px * var(--wall-kv-px-scale, 1)))`,
        }
      : {}),
  };
}

/** 3D reward props at 100% — book on red stack, laptop on globe, trophy left of globe. */
export function WallKvCelebrationRewards({
  visible,
}: WallKvCelebrationRewardsProps) {
  const isMobile = useWallKvMobile();
  if (!visible) return null;

  return (
    <div className="wall-kv-celebration-rewards" aria-hidden>
      {(Object.keys(WALL_KV_CELEBRATION_ASSETS) as Array<
        keyof typeof WALL_KV_CELEBRATION_ASSETS
      >).map((key) => {
        if (isMobile && MOBILE_HIDDEN_REWARDS.has(key)) return null;
        const placement = WALL_KV_CELEBRATION_PLACEMENT[key];
        const src = wallKvAssetSrc(WALL_KV_CELEBRATION_ASSETS[key]);

        if (key === "bookOpen" && placement.frameAlignLayerId) {
          const layer = getWallKvLayout().layers.find(
            (l) => l.id === placement.layerId,
          );
          const align =
            WALL_KV_SCRATCH_REVEAL[placement.frameAlignLayerId]?.align;
          if (!layer) return null;
          return (
            <div
              key={key}
              className="wall-kv-celebration-reward-book-slot"
              style={{
                ...(isMobile ? wallKvMobileBukuSlotStyle() : wallKvLayerStyle(layer)),
                zIndex: placement.zIndex ?? 14,
                animationDelay: ENTRANCE_DELAY[key],
              }}
            >
              <div
                className="wall-kv-celebration-reward-book-frame"
                style={wallKvFrameTransformStyle(align)}
              >
                <div
                  className={`wall-kv-celebration-reward wall-kv-celebration-reward--${key}`}
                  style={frameLocalStyle(placement.relBox, placement.offsetPx)}
                >
                  <img
                    src={src}
                    alt=""
                    className="wall-kv-celebration-reward-img"
                    draggable={false}
                  />
                </div>
              </div>
            </div>
          );
        }

        const style = wallKvCelebrationStyle(placement);
        if (!style) return null;
        return (
          <div
            key={key}
            className={`wall-kv-celebration-reward wall-kv-celebration-reward--${key}`}
            style={{
              ...style,
              zIndex: placement.zIndex ?? 14,
              animationDelay: ENTRANCE_DELAY[key],
            }}
          >
            <img
              src={src}
              alt=""
              className="wall-kv-celebration-reward-img"
              draggable={false}
            />
          </div>
        );
      })}
    </div>
  );
}
