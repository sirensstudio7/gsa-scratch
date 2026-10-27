"use client";

import { useCallback, useState } from "react";
import { OnboardingBubbleField } from "@/components/OnboardingBubbleField";
import { StageShell } from "@/components/StageShell";
import {
  StudentWallCelebrateRedirect,
  type WelcomeWallProgressState,
} from "@/components/StudentWallCelebrateRedirect";

export default function WelcomePage() {
  const [progress, setProgress] = useState<WelcomeWallProgressState>({
    ready: false,
    goalReached: false,
  });

  const onWelcomeProgress = useCallback((state: WelcomeWallProgressState) => {
    setProgress(state);
  }, []);

  const showBubbleField = progress.ready && !progress.goalReached;

  return (
    <StageShell showTeamMark={false}>
      <StudentWallCelebrateRedirect onWelcomeProgress={onWelcomeProgress} />
      <div className="onboarding-welcome-stage relative flex min-h-0 flex-1 flex-col items-center justify-start overflow-hidden px-2 pb-4 pt-1 sm:-mt-20 sm:justify-center sm:overflow-visible sm:pb-10 sm:pt-0 sm:px-3 md:-mt-[4.75rem]">
        {showBubbleField ? (
          <div className="onboarding-field-mobile-shell w-full max-w-[480px] sm:max-w-none sm:w-auto">
            <OnboardingBubbleField autoRestart />
          </div>
        ) : null}
      </div>
    </StageShell>
  );
}
