"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { StageShell } from "@/components/StageShell";
import { SuccessConfetti } from "@/components/SuccessConfetti";
import { SuccessFireworks } from "@/components/SuccessFireworks";
import { SESSION_KEYS } from "@/lib/types";
import { resetPlayStation } from "@/lib/play-session";

export default function SuccessPage() {
  const [name, setName] = useState("");

  useEffect(() => {
    try {
      setName(sessionStorage.getItem(SESSION_KEYS.name) || "");
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <StageShell showTeamMark={false}>
      <div className="relative flex flex-1 flex-col items-center justify-center px-4 pb-20 text-center sm:px-6 sm:pb-24">
        <SuccessFireworks />
        <SuccessConfetti />

        <div className="font-google-sans relative z-30 flex w-full max-w-6xl flex-col items-center">
          <div className="success-logo-wrap mb-2 sm:mb-3">
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
          {name ? (
            <p
              className="success-fade mb-2 text-base font-semibold text-black sm:mb-3 sm:text-lg"
              style={{ animationDelay: "0.12s" }}
            >
              Hai, {name}!
            </p>
          ) : null}
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
                Google Student Ambasador
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
          <p
            className="success-fade mt-4 max-w-[36rem] text-sm text-black sm:mt-5 sm:text-base"
            style={{ animationDelay: "0.85s" }}
          >
            Terima kasih sudah bergabung. Namamu sudah tampil di celebration wall!
          </p>
          <Link
            href="/"
            onClick={() => resetPlayStation()}
            className="success-fade mt-8 inline-flex rounded-full border-2 border-black px-6 py-2.5 text-sm font-bold text-black"
            style={{ animationDelay: "1.05s" }}
          >
            Kembali
          </Link>
        </div>
      </div>
    </StageShell>
  );
}
