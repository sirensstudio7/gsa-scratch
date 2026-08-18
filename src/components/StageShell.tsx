"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type StageProps = {
  children: ReactNode;
  showTeamMark?: boolean;
  className?: string;
};

export function StageShell({
  children,
  showTeamMark = true,
  className = "",
}: StageProps) {
  return (
    <div
      className={`relative flex h-dvh max-h-dvh flex-col overflow-hidden ${className}`}
      style={{
        background:
          "linear-gradient(180deg, var(--sky-top) 0%, var(--sky-mid) 48%, var(--sky-bottom) 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] opacity-70"
        style={{
          backgroundImage: "url(/assets/dotputih.png)",
          backgroundSize: "cover",
          backgroundPosition: "center bottom",
          backgroundRepeat: "no-repeat",
          maskImage:
            "linear-gradient(to top, black 40%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to top, black 40%, transparent 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-28 opacity-40 mix-blend-multiply"
        style={{
          backgroundImage: "url(/assets/shading.png)",
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
        }}
      />

      {/* Absolute team logo — bigger visually, does not push layout */}
      {showTeamMark ? (
        <Image
          src="/assets/tg-logo.png"
          alt="#Team Google — Google Student Ambassador Graduation Event"
          width={1024}
          height={611}
          className="pointer-events-none absolute right-1 top-1 z-30 h-16 w-auto object-contain sm:right-4 sm:top-2 sm:h-40 md:h-44"
          priority
        />
      ) : null}

      <header className="relative z-20 flex shrink-0 items-start justify-between px-4 pt-4 sm:px-6 sm:pt-5">
        <Link href="/" className="block" aria-label="Home">
          <Image
            src="/assets/glogo.png"
            alt="Google"
            width={680}
            height={214}
            className="h-7 w-auto object-contain sm:h-9"
            priority
          />
        </Link>
        {/* Spacer keeps header height stable; real logo is absolute */}
        {showTeamMark ? (
          <div className="h-9 w-[7.5rem] sm:h-10 sm:w-40" aria-hidden />
        ) : (
          <span />
        )}
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col">
        {children}
      </main>

      <Image
        src="/assets/love-biru.png"
        alt=""
        width={160}
        height={160}
        className="pointer-events-none absolute bottom-[-4%] left-[-2%] z-0 w-[28vw] max-w-[140px] animate-float sm:max-w-[180px]"
        priority
      />
      <Image
        src="/assets/spark-biru.png"
        alt=""
        width={140}
        height={140}
        className="pointer-events-none absolute bottom-[-2%] right-[-2%] z-0 w-[24vw] max-w-[120px] animate-float sm:max-w-[160px]"
        style={{ animationDelay: "1.2s" }}
        priority
      />
    </div>
  );
}
