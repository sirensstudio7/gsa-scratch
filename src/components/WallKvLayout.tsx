"use client";

import { useCallback, useSyncExternalStore, type CSSProperties } from "react";
import { ONBOARDING_MOBILE_MQ } from "@/lib/onboarding-layout";
import { WallHeroProgress } from "@/components/WallHeroProgress";
import { WallKvTwinkleStars } from "@/components/WallKvTwinkleStars";
import { WallKvBookGlobeFill } from "@/components/WallKvBookGlobeFill";
import { WallKvCelebrationRewards } from "@/components/WallKvCelebrationRewards";
import {
  getWallKvLayout,
  WALL_KV_SCRATCH_REVEAL,
  WALL_KV_UNIFIED_FILL_LAYER_IDS,
  wallKvAssetSrc,
  wallKvJudulCelebrationStyle,
  wallKvLayerPlacementStyle,
  wallKvLayerStyle,
  wallKvMobileBukuSlotStyle,
  wallKvMobileGlobeSlotStyle,
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

type WallKvLayoutProps = {
  /** One progress for judul + buku + globe (shared scene wipe). */
  kvFillProgress: number;
  /** #TeamGoogle scratch (defaults to kvFillProgress). */
  teamGoogleProgress?: number;
  /** Show graduation line above the judul when wall fill is complete. */
  showGraduationCaption?: boolean;
  /** Book / laptop / trophy overlays when wall fill is complete. */
  showCelebrationRewards?: boolean;
};

const GRADUATION_CAPTION_LINES = [
  { text: "Selamat!", lead: true },
  { text: "Kamu Sudah Menjadi", lead: false },
  { text: "Google Student Ambassador 2026", lead: false },
  { text: "Batch 2", lead: false },
] as const;

/** KV scene — judul / books / globe share one clip; #TeamGoogle scratches separately. */
export function WallKvLayout({
  kvFillProgress,
  teamGoogleProgress,
  showGraduationCaption = false,
  showCelebrationRewards = false,
}: WallKvLayoutProps) {
  const isMobile = useWallKvMobile();
  const fillP = Math.max(0, Math.min(1, kvFillProgress));
  const teamP = teamGoogleProgress ?? fillP;
  const { layers } = getWallKvLayout();
  const scratchLayer = layers.find((l) => l.id === "teamgoogle");
  const fillLayers = WALL_KV_UNIFIED_FILL_LAYER_IDS.map((id) =>
    layers.find((l) => l.id === id),
  ).filter((l): l is NonNullable<typeof l> => !!l);

  const bookGlobeSlotClass = (layerId: string) => {
    if (layerId === "judul") return " wall-kv-slot--judul";
    if (layerId === "buku") return " wall-kv-book-globe-slot--buku";
    if (layerId === "globe") return " wall-kv-book-globe-slot--globe";
    return "";
  };

  const fillSlotStyle = (layer: (typeof fillLayers)[number]) => {
    if (isMobile && layer.id === "buku") {
      return wallKvMobileBukuSlotStyle();
    }
    if (isMobile && layer.id === "globe") {
      return wallKvMobileGlobeSlotStyle();
    }
    const judulCompact =
      layer.id === "judul" &&
      (showCelebrationRewards || showGraduationCaption || fillP >= 0.999);
    if (judulCompact && !isMobile) {
      return wallKvJudulCelebrationStyle();
    }
    if (judulCompact && isMobile) {
      return {};
    }
    return wallKvLayerPlacementStyle(layer);
  };

  return (
    <div
      className={`wall-kv-scene${showCelebrationRewards ? " wall-kv-scene--float wall-kv-scene--celebration" : ""}`}
    >
      {showGraduationCaption ? (
        <p className="wall-kv-graduation-caption">
          {(() => {
            let wordIndex = 0;
            return GRADUATION_CAPTION_LINES.map((line) => (
              <span
                key={line.text}
                className={`wall-kv-graduation-caption-line${line.lead ? " wall-kv-graduation-caption-line--lead" : ""}`}
              >
                {line.text.split(" ").map((word, wi, words) => {
                  const i = wordIndex;
                  wordIndex += 1;
                  return (
                    <span
                      key={`${line.text}-${wi}`}
                      className="wall-kv-graduation-caption-word"
                      style={
                        { ["--word-i" as string]: i } as CSSProperties
                      }
                    >
                      {word}
                      {wi < words.length - 1 ? "\u00a0" : null}
                    </span>
                  );
                })}
              </span>
            ));
          })()}
        </p>
      ) : null}
      <div
        className="wall-kv-unified-fill"
        data-kv-unified-fill={fillP.toFixed(4)}
        aria-hidden
      >
        {fillLayers.map((layer) => {
          const reveal = WALL_KV_SCRATCH_REVEAL[layer.id];
          if (!reveal) return null;
          return (
            <div
              key={`${layer.id}-outline`}
              className={`wall-kv-slot wall-kv-book-globe-slot wall-kv-unified-fill-outline${bookGlobeSlotClass(layer.id)}`}
              style={fillSlotStyle(layer)}
            >
              <WallKvBookGlobeFill
                colorSrc={wallKvAssetSrc(reveal.colorSrc)}
                outlineSrc={wallKvAssetSrc(reveal.whiteSrc)}
                alt={reveal.alt}
                align={reveal.align}
                progress={fillP}
                part="outline"
              />
            </div>
          );
        })}
        {fillLayers.map((layer) => {
          const reveal = WALL_KV_SCRATCH_REVEAL[layer.id];
          if (!reveal) return null;
          return (
            <div
              key={`${layer.id}-color`}
              className={`wall-kv-slot wall-kv-book-globe-slot wall-kv-unified-fill-color${bookGlobeSlotClass(layer.id)}`}
              style={fillSlotStyle(layer)}
            >
              <WallKvBookGlobeFill
                colorSrc={wallKvAssetSrc(reveal.colorSrc)}
                outlineSrc={wallKvAssetSrc(reveal.whiteSrc)}
                alt=""
                align={reveal.align}
                progress={fillP}
                part="color"
              />
            </div>
          );
        })}
      </div>
      <WallKvTwinkleStars />
      <WallKvCelebrationRewards visible={showCelebrationRewards} />
      {scratchLayer ? (
        <WallHeroProgress
          progress={teamP}
          className="wall-kv-hero"
          placementStyle={wallKvLayerStyle(scratchLayer)}
        />
      ) : null}
    </div>
  );
}
