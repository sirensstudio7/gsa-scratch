"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type StageProps = {
  children: ReactNode;
  showTeamMark?: boolean;
  /** Hide top Google header (KV wall includes logo in art). */
  showHeader?: boolean;
  /** Wall KV uses its own full-bleed comp — no shared stage photo. */
  bareBackground?: boolean;
  className?: string;
};

export function StageShell({
  children,
  showTeamMark = true,
  showHeader = true,
  bareBackground = false,
  className = "",
}: StageProps) {
  return (
    <div
      className={`relative flex h-dvh max-h-dvh flex-col overflow-hidden ${className}`}
      style={
        bareBackground
          ? { backgroundColor: "#000" }
          : {
              backgroundColor: "#000",
              backgroundImage: "url(/assets/background.jpg)",
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }
      }
    >

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

      {showHeader ? (
        <header className="relative z-20 flex shrink-0 items-start justify-between px-4 pt-4 sm:px-6 sm:pt-5">
          <Link href="/" className="block" aria-label="Home">
            <Image
              src="/assets/logo-acara.png"
              alt="Google Student Ambassador — Inauguration Event 2026"
              width={1024}
              height={645}
              className="h-28 w-auto max-w-[min(94vw,520px)] object-contain sm:h-32 sm:max-w-[600px] md:h-36 md:max-w-[680px]"
              priority
            />
          </Link>
          {showTeamMark ? (
            <div className="h-9 w-[7.5rem] sm:h-10 sm:w-40" aria-hidden />
          ) : (
            <span />
          )}
        </header>
      ) : null}

      <main className="relative z-10 flex min-h-0 flex-1 flex-col">
        {children}
      </main>
    </div>
  );
}
