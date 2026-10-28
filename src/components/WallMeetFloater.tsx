"use client";

import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { OnboardingBubblePopVisual } from "@/components/OnboardingBubblePopVisual";
import {
  ONBOARDING_BUBBLE_POP_MS,
  ONBOARDING_POP_STYLE,
  onboardingBubbleFilmPopClass,
} from "@/lib/onboarding-pop-style";
import type { BubblePhysicsBurstHandle } from "@/components/BubblePhysicsBurst";

const SPRITE_VERSION = "11";

type Floater = {
  key: string;
  iconId: string;
  xPct: number;
  driftPx: number;
  durationS: number;
  wobbleS: number;
  popHeightVh: number;
  side: "left" | "right";
};

function unwrapSrc(iconId: string) {
  return `/assets/onboarding/sprites/${iconId}-unwrap.png?v=${SPRITE_VERSION}`;
}

function bubbleSrc(iconId: string) {
  return `/assets/onboarding/sprites/${iconId}-bubble.png?v=${SPRITE_VERSION}`;
}

function FloatIcon({ iconId }: { iconId: string }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={unwrapSrc(iconId)}
      alt=""
      className="wall-meet-balloon-img"
      draggable={false}
      decoding="async"
    />
  );
}

type Props = {
  floater: Floater;
  layerEl: () => HTMLElement | null;
  burstRef: RefObject<BubblePhysicsBurstHandle | null>;
  onDone: (key: string) => void;
};

export function WallMeetFloater({
  floater: f,
  layerEl,
  burstRef,
  onDone,
}: Props) {
  const [isPopping, setIsPopping] = useState(false);
  const bubbleCenterRef = useRef<HTMLSpanElement>(null);
  const popStarted = useRef(false);

  const startPop = useCallback(() => {
    if (popStarted.current) return;
    popStarted.current = true;
    if (ONBOARDING_POP_STYLE === "physics") {
      const layer = layerEl();
      const bubble = bubbleCenterRef.current;
      if (layer && bubble && burstRef.current) {
        const field = layer.getBoundingClientRect();
        const box = bubble.getBoundingClientRect();
        burstRef.current.burst(
          box.left - field.left + box.width / 2,
          box.top - field.top + box.height / 2,
          box.width * 0.36,
        );
      }
    }
    setIsPopping(true);
    window.setTimeout(() => onDone(f.key), ONBOARDING_BUBBLE_POP_MS);
  }, [burstRef, f.key, layerEl, onDone]);

  const onTravelEnd = (e: React.AnimationEvent<HTMLDivElement>) => {
    if (
      e.animationName !== "wall-meet-balloon-travel" &&
      e.animationName !== "wall-meet-balloon-travel-right"
    ) {
      return;
    }
    startPop();
  };

  return (
    <div
      className={`wall-meet-balloon wall-meet-balloon--${f.side}`}
      style={
        {
          left: `${f.xPct}%`,
          ["--balloon-drift" as string]: `${f.driftPx}px`,
          ["--balloon-dur" as string]: `${f.durationS}s`,
          ["--balloon-wobble-dur" as string]: `${f.wobbleS}s`,
          ["--balloon-pop-vh" as string]: `${f.popHeightVh}`,
        } as CSSProperties
      }
      onAnimationEnd={onTravelEnd}
    >
      <span className="wall-meet-balloon-body">
        <span
          className={`wall-meet-balloon-wobble${isPopping ? " wall-meet-balloon-wobble--paused" : ""}`}
        >
          {isPopping ? (
            <span ref={bubbleCenterRef} className="wall-meet-balloon-pop-host">
              <OnboardingBubblePopVisual />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bubbleSrc(f.iconId)}
                alt=""
                className={`wall-meet-balloon-pop-bubble onboarding-icon-img${onboardingBubbleFilmPopClass()}`}
                draggable={false}
                decoding="async"
              />
            </span>
          ) : (
            <span ref={bubbleCenterRef} className="wall-meet-balloon-bubble">
              <span className="wall-meet-balloon-bubble-spec" aria-hidden />
              <FloatIcon iconId={f.iconId} />
            </span>
          )}
        </span>
      </span>
    </div>
  );
}
