"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { BubblePopRecord } from "@/lib/bubble-pop-log";
import { resolveBubblePopIconId } from "@/lib/bubble-pop-log";

const SPRITE_VERSION = "11";
const MAX_FLOATERS = 28;
/** Space out floats when the wall catches up several pops in one sync (not same tap). */
const FLOAT_STAGGER_MS = 240;
const FLOAT_STAGGER_BUSY_MS = 90;
const FLOAT_BUSY_QUEUE = 5;

type Floater = {
  key: string;
  iconId: string;
  xPct: number;
  driftPx: number;
  durationS: number;
  wobbleS: number;
  side: "left" | "right";
};

export type WallBubbleMeetFloatsHandle = {
  /** Queue one float (live pop — shows now if nothing else is queued). */
  spawn: (pop: BubblePopRecord) => void;
  /** Mark existing pops as history (no animation). */
  prime: (pops: BubblePopRecord[]) => void;
};

function unwrapSrc(iconId: string) {
  const id = resolveBubblePopIconId(iconId);
  return `/assets/onboarding/sprites/${id}-unwrap.png?v=${SPRITE_VERSION}`;
}

function floaterFromPop(pop: BubblePopRecord): Floater {
  const iconId = resolveBubblePopIconId(pop.iconId);
  let n = (pop.id * 92821) ^ iconId.length;
  n = (n ^ (n >>> 16)) >>> 0;
  const side: "left" | "right" = pop.id % 2 === 0 ? "left" : "right";
  const laneSpread = (n % 140) / 10;
  const xPct = side === "left" ? 5 + laneSpread : 88 - laneSpread;
  const driftPx = ((n % 31) - 15) * 1.2;
  const durationS = 4.4 + (n % 9) * 0.14;
  const wobbleS = 1.35 + (n % 7) * 0.09;
  return {
    key: `float-${pop.id}`,
    iconId,
    xPct,
    driftPx,
    durationS,
    wobbleS,
    side,
  };
}

type WallBubbleMeetFloatsProps = {
  pops: BubblePopRecord[];
  /** After wall hydrate — poll fallback for pops without spawn(). */
  live: boolean;
};

function FloatIcon({ iconId }: { iconId: string }) {
  const fallback = resolveBubblePopIconId(null);
  const [src, setSrc] = useState(() => unwrapSrc(iconId));

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt=""
      className="wall-meet-balloon-img"
      draggable={false}
      decoding="async"
      onError={() => {
        const fix = unwrapSrc(fallback);
        if (src !== fix) setSrc(fix);
      }}
    />
  );
}

/** Meet-style balloons on left/right — rise, drift, fade (not stacked rails). */
export const WallBubbleMeetFloats = forwardRef<
  WallBubbleMeetFloatsHandle,
  WallBubbleMeetFloatsProps
>(function WallBubbleMeetFloats({ pops, live }, ref) {
  const [floaters, setFloaters] = useState<Floater[]>([]);
  /** Already shown or waiting in queue. */
  const handledIds = useRef(new Set<number>());
  const queueRef = useRef<BubblePopRecord[]>([]);
  const drainScheduled = useRef(false);
  const staggerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const revealPop = useCallback((pop: BubblePopRecord) => {
    const floater = floaterFromPop(pop);
    setFloaters((prev) => [...prev, floater].slice(-MAX_FLOATERS));
  }, []);

  const scheduleDrain = useCallback(() => {
    if (drainScheduled.current) return;
    const step = () => {
      const next = queueRef.current.shift();
      if (!next) {
        drainScheduled.current = false;
        return;
      }
      revealPop(next);
      if (queueRef.current.length === 0) {
        drainScheduled.current = false;
        return;
      }
      const delay =
        queueRef.current.length > FLOAT_BUSY_QUEUE
          ? FLOAT_STAGGER_BUSY_MS
          : FLOAT_STAGGER_MS;
      staggerTimer.current = setTimeout(step, delay);
    };
    drainScheduled.current = true;
    step();
  }, [revealPop]);

  const enqueue = useCallback(
    (pop: BubblePopRecord) => {
      if (handledIds.current.has(pop.id)) return;
      handledIds.current.add(pop.id);
      queueRef.current.push({
        ...pop,
        iconId: resolveBubblePopIconId(pop.iconId),
      });
      scheduleDrain();
    },
    [scheduleDrain],
  );

  const spawn = useCallback(
    (pop: BubblePopRecord) => {
      enqueue(pop);
    },
    [enqueue],
  );

  const prime = useCallback((list: BubblePopRecord[]) => {
    for (const p of list) handledIds.current.add(p.id);
    queueRef.current = queueRef.current.filter(
      (p) => !list.some((x) => x.id === p.id),
    );
  }, []);

  useImperativeHandle(ref, () => ({ spawn, prime }), [spawn, prime]);

  useEffect(() => {
    if (!live) return;
    const newcomers = pops
      .filter((p) => !handledIds.current.has(p.id))
      .sort((a, b) => a.id - b.id);
    for (const pop of newcomers) enqueue(pop);
  }, [pops, live, enqueue]);

  useEffect(() => {
    return () => {
      if (staggerTimer.current) clearTimeout(staggerTimer.current);
    };
  }, []);

  const removeFloater = (key: string) => {
    setFloaters((prev) => prev.filter((f) => f.key !== key));
  };

  return (
    <div className="wall-meet-float-layer" aria-hidden>
      {floaters.map((f) => (
        <div
          key={f.key}
          className={`wall-meet-balloon wall-meet-balloon--${f.side}`}
          style={
            {
              left: `${f.xPct}%`,
              ["--balloon-drift" as string]: `${f.driftPx}px`,
              ["--balloon-dur" as string]: `${f.durationS}s`,
              ["--balloon-wobble-dur" as string]: `${f.wobbleS}s`,
            } as CSSProperties
          }
          onAnimationEnd={(e) => {
            if (
              e.animationName !== "wall-meet-balloon-travel" &&
              e.animationName !== "wall-meet-balloon-travel-right"
            ) {
              return;
            }
            removeFloater(f.key);
          }}
        >
          <span className="wall-meet-balloon-body">
            <span className="wall-meet-balloon-wobble">
              <span className="wall-meet-balloon-bubble">
                <span className="wall-meet-balloon-bubble-spec" aria-hidden />
                <FloatIcon iconId={f.iconId} />
              </span>
            </span>
          </span>
        </div>
      ))}
    </div>
  );
});
