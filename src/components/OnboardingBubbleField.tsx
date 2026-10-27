"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { BubblePopEffect } from "@/components/BubblePopEffect";
import {
  BubblePhysicsBurst,
  type BubblePhysicsBurstHandle,
} from "@/components/BubblePhysicsBurst";
import {
  getOnboardingLayout,
  ONBOARDING_MOBILE_MQ,
  type OnboardingIconLayout,
  type OnboardingLayoutFile,
} from "@/lib/onboarding-layout";
import {
  playRandomBubblePop,
  unlockBubblePopSounds,
  warmBubblePopSounds,
} from "@/lib/bubble-pop-sound";
import { ONBOARDING_POP_STYLE } from "@/lib/onboarding-pop-style";
import { fitMobileBubbleLayout } from "@/lib/onboarding-mobile-responsive";
import { publishBubbleTotal } from "@/lib/wall-bubble-fill";

type Props = {
  onAllPopped?: () => void;
  /** After all bubbles popped, reset field so student can pop again (default on). */
  autoRestart?: boolean;
  /** Pause before bubbles reappear (ms). */
  restartDelayMs?: number;
};

const DEFAULT_RESTART_MS = 220;

function filmPopClass() {
  if (ONBOARDING_POP_STYLE === "physics") return " onboarding-icon-img--film-snap";
  if (ONBOARDING_POP_STYLE === "real") return " onboarding-icon-img--film-pop-real";
  return " onboarding-icon-img--film-pop";
}

const ONBOARDING_ART_VERSION = "11";

function useOnboardingLayout(): OnboardingLayoutFile {
  const subscribe = useCallback((onStoreChange: () => void) => {
    const mq = window.matchMedia(ONBOARDING_MOBILE_MQ);
    mq.addEventListener("change", onStoreChange);
    return () => mq.removeEventListener("change", onStoreChange);
  }, []);
  const getSnapshot = useCallback(
    () => getOnboardingLayout(window.matchMedia(ONBOARDING_MOBILE_MQ).matches),
    [],
  );
  const getServerSnapshot = useCallback(
    () => getOnboardingLayout(false),
    [],
  );
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
const POP_MS =
  ONBOARDING_POP_STYLE === "physics"
    ? 160
    : ONBOARDING_POP_STYLE === "real"
      ? 420
      : 320;

export function OnboardingBubbleField({
  onAllPopped,
  autoRestart = true,
  restartDelayMs = DEFAULT_RESTART_MS,
}: Props) {
  const layout = useOnboardingLayout();
  const isMobileLayout = layout.viewBox[3] > layout.viewBox[2];
  const icons = layout.icons;
  const fieldRef = useRef<HTMLDivElement>(null);
  const burstRef = useRef<BubblePhysicsBurstHandle>(null);
  const [popped, setPopped] = useState<Set<string>>(() => new Set());
  const [popping, setPopping] = useState<Set<string>>(() => new Set());
  const poppedRef = useRef(popped);
  const poppingRef = useRef(popping);
  poppedRef.current = popped;
  poppingRef.current = popping;
  const completionHandled = useRef(false);
  const [revealIn, setRevealIn] = useState(false);
  const [fieldPx, setFieldPx] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    if (!isMobileLayout) {
      setFieldPx({ w: 0, h: 0 });
      return;
    }
    const el = fieldRef.current;
    if (!el) return;

    let timer = 0;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setFieldPx((prev) => {
        if (Math.abs(prev.w - w) < 16 && Math.abs(prev.h - h) < 16) return prev;
        return { w, h };
      });
    };
    measure();
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(measure, 140);
    };

    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    window.addEventListener("orientationchange", schedule);
    window.visualViewport?.addEventListener("resize", schedule);

    return () => {
      window.clearTimeout(timer);
      ro.disconnect();
      window.removeEventListener("orientationchange", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
    };
  }, [isMobileLayout]);

  const total = icons.length;
  const allPopped = total > 0 && popped.size >= total;

  useEffect(() => {
    warmBubblePopSounds();
    const field = fieldRef.current;
    if (!field) return;
    const onFirstPointer = () => {
      unlockBubblePopSounds();
    };
    field.addEventListener("pointerdown", onFirstPointer, {
      once: true,
      capture: true,
    });
    return () => {
      field.removeEventListener("pointerdown", onFirstPointer, { capture: true });
    };
  }, []);

  useEffect(() => {
    if (!allPopped) {
      completionHandled.current = false;
      return;
    }
    if (completionHandled.current) return;
    completionHandled.current = true;
    onAllPopped?.();

    if (!autoRestart) return;

    const restartTimer = window.setTimeout(() => {
      setRevealIn(true);
      setPopped(new Set());
      setPopping(new Set());
      completionHandled.current = false;
    }, restartDelayMs);

    return () => window.clearTimeout(restartTimer);
  }, [allPopped, onAllPopped, autoRestart, restartDelayMs]);

  const popOne = useCallback((id: string, button: HTMLButtonElement) => {
    if (poppedRef.current.has(id) || poppingRef.current.has(id)) return;
    poppingRef.current = new Set(poppingRef.current).add(id);
    playRandomBubblePop();
    void (async () => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const res = await fetch("/api/bubbles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ delta: 1, iconId: id }),
            keepalive: true,
            cache: "no-store",
          });
          if (!res.ok) continue;
          const data = (await res.json()) as {
            total?: number;
            pop?: { id: number; iconId: string; createdAt: string };
          };
          if (typeof data.total === "number") {
            publishBubbleTotal(
              data.total,
              data.pop?.iconId ? data.pop : undefined,
            );
          }
          return;
        } catch {
          /* retry */
        }
      }
    })();
    if (ONBOARDING_POP_STYLE === "physics" && fieldRef.current) {
      const field = fieldRef.current.getBoundingClientRect();
      const box = button.getBoundingClientRect();
      burstRef.current?.burst(
        box.left - field.left + box.width / 2,
        box.top - field.top + box.height / 2,
        box.width * 0.36,
      );
    }
    setPopping((prev) => new Set(prev).add(id));
    window.setTimeout(() => {
      poppedRef.current = new Set(poppedRef.current).add(id);
      const stillPopping = new Set(poppingRef.current);
      stillPopping.delete(id);
      poppingRef.current = stillPopping;
      setPopped(new Set(poppedRef.current));
      setPopping(stillPopping);
    }, POP_MS);
  }, []);

  const sorted = useMemo(
    () => [...icons].sort((a, b) => a.id.localeCompare(b.id)),
    [icons],
  );

  const placedIcons = useMemo(() => {
    if (!isMobileLayout || fieldPx.w <= 0 || fieldPx.h <= 0) {
      return sorted;
    }
    return fitMobileBubbleLayout(sorted, fieldPx.w, fieldPx.h);
  }, [sorted, isMobileLayout, fieldPx.w, fieldPx.h]);

  return (
    <div
      ref={fieldRef}
      className={`onboarding-field${isMobileLayout ? " onboarding-field--mobile" : ""}${revealIn ? " onboarding-field--reveal-in" : ""}`}
      style={
        isMobileLayout
          ? ({ ["--onboarding-aspect" as string]: `${layout.viewBox[2]} / ${layout.viewBox[3]}` } as CSSProperties)
          : undefined
      }
      role="group"
      aria-label="Pop each bubble to start onboarding"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/pop-the-bubble.png"
        alt=""
        className="onboarding-pop-the-bubble-cta"
        draggable={false}
        decoding="async"
      />
      {ONBOARDING_POP_STYLE === "physics" ? (
        <BubblePhysicsBurst ref={burstRef} />
      ) : null}
      {placedIcons.map((icon: OnboardingIconLayout, sortedIndex: number) => {
        const isPopped = popped.has(icon.id);
        const isPopping = popping.has(icon.id);
        const showBubble = !isPopped || isPopping;
        const showUnwrap = isPopped && !isPopping;
        const [x, y] = icon.bubble;
        const bubbleSrc = `/assets/onboarding/sprites/${icon.id}-bubble.png?v=${ONBOARDING_ART_VERSION}`;
        const unwrapSrc = `/assets/onboarding/sprites/${icon.id}-unwrap.png?v=${ONBOARDING_ART_VERSION}`;
        const index = Number(icon.id.replace("icon-", ""));
        const motionVariant = index % 5;

        return (
          <button
            key={icon.id}
            type="button"
            disabled={isPopped}
            className={`onboarding-icon${isPopped ? " onboarding-icon--popped" : ""}${isPopping ? " onboarding-icon--popping" : ""}`}
            style={{
              left: `${x * 100}%`,
              top: `${y * 100}%`,
              width: `${icon.size * 100}%`,
              "--float-d": `${3.6 + (index % 7) * 0.42}s`,
              "--float-delay": `${-(index * 0.38)}s`,
              "--reveal-i": sortedIndex,
            } as CSSProperties}
            aria-label={isPopped ? undefined : `Pop bubble ${icon.id}`}
            onClick={(event) => popOne(icon.id, event.currentTarget)}
          >
            <span
              className={`onboarding-icon-motion onboarding-icon-motion--v${motionVariant}${isPopping ? " onboarding-icon-motion--paused" : ""}`}
            >
            {isPopping && ONBOARDING_POP_STYLE === "physics" ? (
              <span className="onboarding-soap-burst" aria-hidden>
                <span className="onboarding-soap-globe" />
                <span className="onboarding-soap-highlight" />
                <span className="onboarding-soap-ring" />
                <span className="onboarding-soap-ring onboarding-soap-ring--late" />
                {Array.from({ length: 8 }, (_, i) => (
                  <span
                    key={i}
                    className="onboarding-soap-shard"
                    style={{ "--shard": i } as CSSProperties}
                  />
                ))}
              </span>
            ) : null}
            {isPopping && ONBOARDING_POP_STYLE === "real" ? (
              <BubblePopEffect />
            ) : null}
            {isPopping && ONBOARDING_POP_STYLE === "classic" ? (
              <span className="onboarding-bubble-pop onboarding-bubble-pop--classic" aria-hidden>
                <span className="onboarding-bubble-membrane onboarding-bubble-membrane--classic" />
                <span className="onboarding-bubble-mist onboarding-bubble-mist--classic" />
              </span>
            ) : null}
            {showBubble ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={bubbleSrc}
                alt=""
                className={`onboarding-icon-img${isPopping ? filmPopClass() : ""}`}
                draggable={false}
                decoding="async"
              />
            ) : null}
            {showUnwrap ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={unwrapSrc}
                alt=""
                className="onboarding-icon-img onboarding-icon-img--revealed"
                draggable={false}
                decoding="async"
              />
            ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
