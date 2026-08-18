"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StageShell } from "@/components/StageShell";
import { ScratchCard } from "@/components/ScratchCard";
import { GenderDropdown } from "@/components/GenderDropdown";
import {
  SCRATCH_OBJECTS,
  SESSION_KEYS,
  type Gender,
  type ScratchId,
} from "@/lib/types";

type ScratchState = Record<ScratchId, boolean>;

const emptyScratches: ScratchState = {
  hat: false,
  pencil: false,
  ribbon: false,
};

export default function PlayPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [scratches, setScratches] = useState<ScratchState>(emptyScratches);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    try {
      if (!sessionStorage.getItem(SESSION_KEYS.clientId)) {
        sessionStorage.setItem(SESSION_KEYS.clientId, crypto.randomUUID());
      }
      const savedName = sessionStorage.getItem(SESSION_KEYS.name);
      const savedGender = sessionStorage.getItem(SESSION_KEYS.gender);
      const savedScratch = sessionStorage.getItem(SESSION_KEYS.scratches);
      if (savedName) setName(savedName);
      if (
        savedGender === "Pria" ||
        savedGender === "Wanita" ||
        savedGender === "Lainnya" ||
        savedGender === "Male" ||
        savedGender === "Female" ||
        savedGender === "Other"
      ) {
        const mapped =
          savedGender === "Male"
            ? "Pria"
            : savedGender === "Female"
              ? "Wanita"
              : savedGender === "Other"
                ? "Lainnya"
                : savedGender;
        setGender(mapped);
      }
      if (savedScratch) {
        const parsed = {
          ...emptyScratches,
          ...JSON.parse(savedScratch),
        } as ScratchState;
        setScratches(parsed);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEYS.name, name);
      sessionStorage.setItem(SESSION_KEYS.gender, gender);
      sessionStorage.setItem(SESSION_KEYS.scratches, JSON.stringify(scratches));
    } catch {
      /* ignore */
    }
  }, [name, gender, scratches]);

  const allDone = useMemo(
    () => Object.values(scratches).every(Boolean),
    [scratches],
  );
  const canSubmit =
    name.trim().length >= 2 && Boolean(gender) && allDone && !pending;
  const formReady = name.trim().length >= 2 && Boolean(gender);

  const markDone = (id: ScratchId) => {
    setScratches((prev) => ({ ...prev, [id]: true }));
  };

  const onSubmit = () => {
    if (!canSubmit || !gender) return;
    setError(null);
    startTransition(async () => {
      try {
        let clientId = "";
        try {
          clientId = sessionStorage.getItem(SESSION_KEYS.clientId) || "";
          if (!clientId) {
            clientId = crypto.randomUUID();
            sessionStorage.setItem(SESSION_KEYS.clientId, clientId);
          }
        } catch {
          clientId = crypto.randomUUID();
        }
        const res = await fetch("/api/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), gender, clientId }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data.error || "Gagal mengirim. Coba lagi.");
          return;
        }
        sessionStorage.setItem(SESSION_KEYS.submitted, "1");
        router.push("/success");
      } catch {
        setError("Koneksi gagal. Coba lagi.");
      }
    });
  };

  const renderForm = (className = "") => (
    <div className={`play-form flex w-full flex-col gap-3 ${className}`}>
      <label className="field-shell">
        <span className="field-label">Nama</span>
        <div className="name-input-wrap">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            className={`field-control${name.trim().length >= 2 ? " has-check" : ""}`}
            autoComplete="name"
          />
          {name.trim().length >= 2 ? (
            <span className="name-check" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="9" fill="#34a853" />
                <path
                  d="M5 9.2l2.4 2.4L13 6.2"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          ) : null}
        </div>
      </label>

      <GenderDropdown value={gender} onChange={setGender} />

      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );

  const renderTitle = () => (
    <h1 className="play-title leading-none">
      <span className="magic-title block">Magic Scratch</span>
      <span className="coloring-title mt-1 block">Coloring</span>
    </h1>
  );

  return (
    <StageShell>
      {/* Mobile: stacked column */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-28 pt-1 md:hidden">
        <div className="mx-auto flex w-full max-w-md flex-col gap-5">
          {renderTitle()}
          {renderForm()}
          {!formReady ? (
            <p className="scratch-hint text-center text-sm font-semibold text-[#1a73e8]">
              Isi nama dan gender dulu untuk mulai scratch
            </p>
          ) : (
            <p className="scratch-hint text-center text-sm font-medium text-[#5f6368]">
              Scratch ketiga objek hingga berwarna
            </p>
          )}
          <div className="flex flex-col items-center gap-5 py-1">
            {SCRATCH_OBJECTS.map((obj) => (
              <ScratchCard
                key={`m-${obj.id}`}
                colorSrc={obj.colorSrc}
                maskSrc={obj.maskSrc}
                label={obj.label}
                completed={scratches[obj.id]}
                onComplete={() => markDone(obj.id)}
                enabled={formReady}
                className="scratch-item scratch-item-mobile"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Desktop: title above hat, form above pencil */}
      <div className="hidden min-h-0 flex-1 flex-col px-10 pb-28 pt-2 md:flex">
        <div className="scratch-stage mx-auto grid w-full max-w-7xl flex-1 grid-cols-3 items-end gap-6">
          <div className="hat-col flex flex-col items-center justify-end gap-3 pb-2">
            {renderTitle()}
            <ScratchCard
              colorSrc={SCRATCH_OBJECTS[0].colorSrc}
              maskSrc={SCRATCH_OBJECTS[0].maskSrc}
              label={SCRATCH_OBJECTS[0].label}
              completed={scratches.hat}
              onComplete={() => markDone("hat")}
              enabled={formReady}
              className="scratch-item"
            />
          </div>

          <div className="pencil-col flex flex-col items-center justify-end gap-4">
            {renderForm("max-w-[260px]")}
            <ScratchCard
              colorSrc={SCRATCH_OBJECTS[1].colorSrc}
              maskSrc={SCRATCH_OBJECTS[1].maskSrc}
              label={SCRATCH_OBJECTS[1].label}
              completed={scratches.pencil}
              onComplete={() => markDone("pencil")}
              enabled={formReady}
              className="scratch-item"
            />
          </div>

          <div className="flex items-end justify-center pb-2">
            <ScratchCard
              colorSrc={SCRATCH_OBJECTS[2].colorSrc}
              maskSrc={SCRATCH_OBJECTS[2].maskSrc}
              label={SCRATCH_OBJECTS[2].label}
              completed={scratches.ribbon}
              onComplete={() => markDone("ribbon")}
              enabled={formReady}
              className="scratch-item"
            />
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-5 z-30 flex justify-center px-4">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={onSubmit}
          className="submit-btn w-full max-w-sm px-12 py-3.5 text-base font-bold tracking-wide text-white transition disabled:cursor-not-allowed disabled:opacity-40 md:w-auto"
        >
          {pending ? "SENDING..." : "SUBMIT >"}
        </button>
      </div>
    </StageShell>
  );
}
