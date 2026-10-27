import type { CSSProperties } from "react";

/** Outward spray droplets (angle deg, size 0–1, reach multiplier). */
const SPRAY = [
  [8, 0.85, 1.05],
  [38, 1, 0.95],
  [72, 0.7, 1.1],
  [108, 0.95, 1],
  [142, 0.75, 0.92],
  [178, 1, 1.08],
  [214, 0.8, 0.98],
  [248, 0.9, 1.05],
  [284, 0.65, 0.88],
  [318, 0.95, 1],
  [352, 0.72, 0.94],
  [24, 0.55, 0.82],
] as const;

/** Worthington-jet style crown (angle from vertical, size). */
const CROWN = [
  [-18, 0.55],
  [-8, 0.7],
  [0, 0.95],
  [8, 0.7],
  [18, 0.55],
] as const;

export function BubblePopEffect() {
  return (
    <span className="onboarding-bubble-pop onboarding-bubble-pop--real" aria-hidden>
      <span className="onboarding-bubble-shimmer" />
      <span className="onboarding-bubble-membrane onboarding-bubble-membrane--real" />
      <span className="onboarding-bubble-specular" />
      <span className="onboarding-bubble-ripple" />
      <span className="onboarding-bubble-ripple onboarding-bubble-ripple--delay" />
      <span className="onboarding-bubble-mist onboarding-bubble-mist--real" />
      {SPRAY.map(([deg, size, reach], i) => (
        <span
          key={`s-${deg}`}
          className="onboarding-bubble-drop onboarding-bubble-drop--spray"
          style={
            {
              "--pop-a": `${deg}deg`,
              "--pop-i": i,
              "--pop-s": size,
              "--pop-r": reach,
            } as CSSProperties
          }
        />
      ))}
      {CROWN.map(([deg, size], i) => (
        <span
          key={`c-${deg}`}
          className="onboarding-bubble-drop onboarding-bubble-drop--crown"
          style={
            {
              "--pop-a": `${deg}deg`,
              "--pop-i": i,
              "--pop-s": size,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}
