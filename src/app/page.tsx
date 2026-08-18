"use client";

import Image from "next/image";
import Link from "next/link";
import { StageShell } from "@/components/StageShell";

export default function WelcomePage() {
  return (
    <StageShell showTeamMark={false}>
      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-24 pt-6">
        <Link
          href="/play"
          className="group relative flex max-w-4xl flex-col items-center outline-none"
          aria-label="Start Magic Scratch"
        >
          <div className="hero-stage relative mx-auto w-[min(96vw,720px)]">
            <div className="hero-logo-wrap relative z-10 mx-auto">
              <Image
                src="/assets/tg-logo-hero.png"
                alt="#Team Google — Google Student Ambassador Graduation Event"
                width={585}
                height={349}
                className="hero-logo-main h-auto w-full object-contain drop-shadow-lg"
                priority
              />
              <span className="hero-shine" aria-hidden>
                <span className="hero-shine-beam" />
              </span>
            </div>
          </div>

          <span className="cta-pill mt-8 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white transition group-hover:scale-105">
            Start Onboarding
            <span aria-hidden>-&gt;</span>
          </span>
        </Link>
      </div>
    </StageShell>
  );
}
