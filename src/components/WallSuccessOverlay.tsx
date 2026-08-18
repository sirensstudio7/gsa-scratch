"use client";

import { SuccessConfetti } from "@/components/SuccessConfetti";
import { SuccessFireworks } from "@/components/SuccessFireworks";

type WallSuccessOverlayProps = {
  participantCount: number;
};

/** Crowd-facing finale when the wall reveal reaches 100%. */
export function WallSuccessOverlay({
  participantCount,
}: WallSuccessOverlayProps) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center px-6 text-center">
      <SuccessFireworks />
      <SuccessConfetti />

      <div className="relative z-30 w-full max-w-6xl px-2">
        <p
          className="success-fade mb-3 text-lg font-semibold text-black"
          style={{ animationDelay: "0.05s" }}
        >
          {participantCount} Google Student Ambasador
        </p>
        <h1 className="text-[clamp(2rem,6.8vw,4.25rem)] leading-[1.12] text-black">
          <span className="success-line whitespace-nowrap font-medium">
            <span
              className="success-line-inner"
              style={{ animationDelay: "0.15s" }}
            >
              Selamat Atas Kelulusan
            </span>
          </span>
          <span className="success-line whitespace-nowrap font-black">
            <span
              className="success-line-inner"
              style={{ animationDelay: "0.38s" }}
            >
              <span className="success-brand-line">
                Google Student Ambasador
                <span className="success-brand-shine" aria-hidden>
                  Google Student Ambasador
                </span>
              </span>
            </span>
          </span>
          <span className="success-line whitespace-nowrap font-medium">
            <span
              className="success-line-inner"
              style={{ animationDelay: "0.6s" }}
            >
              Tahun 2026
            </span>
          </span>
        </h1>
      </div>
    </div>
  );
}
