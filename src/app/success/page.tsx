"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StageShell } from "@/components/StageShell";
import { SuccessConfetti } from "@/components/SuccessConfetti";
import { SuccessFireworks } from "@/components/SuccessFireworks";
import { SESSION_KEYS } from "@/lib/types";

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
    <StageShell>
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
        <SuccessFireworks />
        <SuccessConfetti />

        <div className="font-google-sans relative z-30 w-full max-w-6xl px-2">
          {name ? (
            <p
              className="success-fade mb-3 text-lg font-semibold text-black"
              style={{ animationDelay: "0.05s" }}
            >
              Hai, {name}!
            </p>
          ) : null}
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
                Google Student Ambasador
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
          <p
            className="success-fade mt-5 text-base text-black"
            style={{ animationDelay: "0.85s" }}
          >
            Terima kasih sudah bergabung. Namamu sudah tampil di celebration wall!
          </p>
          <Link
            href="/"
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
