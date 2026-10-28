import type { CSSProperties } from "react";
import { BubblePopEffect } from "@/components/BubblePopEffect";
import { ONBOARDING_POP_STYLE } from "@/lib/onboarding-pop-style";

/** Same burst layers as welcome bubble tap (physics / real / classic). */
export function OnboardingBubblePopVisual() {
  if (ONBOARDING_POP_STYLE === "physics") {
    return (
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
    );
  }
  if (ONBOARDING_POP_STYLE === "real") {
    return <BubblePopEffect />;
  }
  return (
    <span
      className="onboarding-bubble-pop onboarding-bubble-pop--classic"
      aria-hidden
    >
      <span className="onboarding-bubble-membrane onboarding-bubble-membrane--classic" />
      <span className="onboarding-bubble-mist onboarding-bubble-mist--classic" />
    </span>
  );
}
