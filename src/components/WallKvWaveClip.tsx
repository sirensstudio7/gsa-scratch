"use client";

import { wallKvWaveClipPathD } from "@/lib/wall-kv-fill-clip";
import {
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";

type WallKvWaveClipProps = {
  progress: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

const PHASE_SPEED = 1.05;
const PROGRESS_SMOOTH = 8;

/** Clips children with a bottom-up wavy fill edge (smooth motion). */
export function WallKvWaveClip({
  progress,
  className = "",
  style,
  children,
}: WallKvWaveClipProps) {
  const rawId = useId();
  const clipId = `kv-wave-${rawId.replace(/:/g, "")}`;
  const pathRef = useRef<SVGPathElement>(null);
  const targetRef = useRef(Math.max(0, Math.min(1, progress)));
  const smoothRef = useRef(targetRef.current);
  const phaseRef = useRef(0);
  const rafRef = useRef(0);

  targetRef.current = Math.max(0, Math.min(1, progress));

  useEffect(() => {
    const paint = (now: number, last: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      const target = targetRef.current;
      let smooth = smoothRef.current;
      smooth += (target - smooth) * (1 - Math.exp(-PROGRESS_SMOOTH * dt));
      if (Math.abs(target - smooth) < 0.00008) smooth = target;
      smoothRef.current = smooth;

      const active = smooth > 0.0005 && smooth < 0.9995;
      if (active) phaseRef.current += PHASE_SPEED * dt;

      pathRef.current?.setAttribute(
        "d",
        wallKvWaveClipPathD(smooth, phaseRef.current),
      );
    };

    let last = performance.now();
    const tick = (now: number) => {
      paint(now, last);
      last = now;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const clipStyle: CSSProperties = {
    ...style,
    clipPath: `url(#${clipId})`,
    WebkitClipPath: `url(#${clipId})`,
  };

  const initialD = wallKvWaveClipPathD(
    targetRef.current,
    phaseRef.current,
  );

  return (
    <>
      <svg
        className="wall-kv-wave-clip-def"
        width={0}
        height={0}
        aria-hidden
        focusable="false"
      >
        <defs>
          <clipPath id={clipId} clipPathUnits="objectBoundingBox">
            <path ref={pathRef} d={initialD} />
          </clipPath>
        </defs>
      </svg>
      <div className={className} style={clipStyle}>
        {children}
      </div>
    </>
  );
}
