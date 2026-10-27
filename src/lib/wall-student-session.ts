import { getOnboardingLayout } from "@/lib/onboarding-layout";

export function getBubblesPerStudent(): number {
  const n = getOnboardingLayout().icons.length;
  return n > 0 ? n : 25;
}

export function welcomeBubblesPerStudent(iconCount?: number): number {
  const n = iconCount ?? getBubblesPerStudent();
  return Math.max(1, n);
}

/** Siswa selesai welcome = 1 langkah progress (bukan 1 tap). */
export function completedStudentCount(
  bubbleClicks: number,
  bubblesPerStudent?: number,
): number {
  const per = welcomeBubblesPerStudent(bubblesPerStudent);
  return Math.max(0, Math.floor(bubbleClicks / per));
}
