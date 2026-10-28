/** `physics` = canvas droplets with gravity. `real` = CSS crown. `classic` = simple film. */
export type OnboardingPopStyle = "physics" | "real" | "classic";

export const ONBOARDING_POP_STYLE: OnboardingPopStyle = "physics";

export const ONBOARDING_BUBBLE_POP_MS =
  ONBOARDING_POP_STYLE === "physics"
    ? 160
    : ONBOARDING_POP_STYLE === "real"
      ? 420
      : 320;

export function onboardingBubbleFilmPopClass(): string {
  if (ONBOARDING_POP_STYLE === "physics") {
    return " onboarding-icon-img--film-snap";
  }
  if (ONBOARDING_POP_STYLE === "real") {
    return " onboarding-icon-img--film-pop-real";
  }
  return " onboarding-icon-img--film-pop";
}
