"use client";

import Image from "next/image";
import { SuccessConfetti } from "@/components/SuccessConfetti";
import { SuccessFireworks } from "@/components/SuccessFireworks";

/** Crowd-facing finale when the wall reveal reaches 100%. */
export function WallSuccessOverlay() {
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center px-6 text-center">
      <SuccessFireworks />
      <SuccessConfetti />

      <div className="font-google-sans relative z-30 flex w-full max-w-6xl flex-col items-center px-2">
        <div className="absolute bottom-full left-1/2 mb-5 -translate-x-1/2 sm:mb-6">
          <div className="success-logo-wrap">
            <div className="success-logo-bob">
              <Image
                src="/assets/tg-logo-hero-v2.png"
                alt="#Team Google — Google Student Ambassador Graduation Event"
                width={1024}
                height={605}
                className="success-logo-main h-auto w-full bg-transparent object-contain"
                priority
              />
              <span className="success-logo-shine" aria-hidden>
                <span className="hero-shine-beam" />
              </span>
            </div>
          </div>
        </div>
        <h1 className="success-headline">
          <span className="success-line font-medium">
            <span
              className="success-line-inner"
              style={{ animationDelay: "0.15s" }}
            >
              Selamat Atas Kelulusan
            </span>
          </span>
          <span className="success-line font-black">
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
          <span className="success-line font-medium">
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
