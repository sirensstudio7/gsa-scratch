import layoutDesktop from "@/data/onboarding-layout.json";
import layoutMobile from "@/data/onboarding-layout-mobile.json";

export type OnboardingIconLayout = {
  id: string;
  bubble: [number, number];
  unwrap: [number, number];
  size: number;
};

export type OnboardingLayoutFile = {
  viewBox: [number, number, number, number];
  icons: OnboardingIconLayout[];
};

const DESKTOP = layoutDesktop as OnboardingLayoutFile;
const MOBILE = layoutMobile as OnboardingLayoutFile;

export const ONBOARDING_MOBILE_MQ = "(max-width: 639px)";

export function getOnboardingLayout(mobile = false) {
  return mobile ? MOBILE : DESKTOP;
}

export function onboardingLayoutAspect(layout: OnboardingLayoutFile) {
  const [, , w, h] = layout.viewBox;
  return w / h;
}
