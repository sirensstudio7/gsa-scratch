"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { StageShell } from "@/components/StageShell";
import { WallHeroProgress } from "@/components/WallHeroProgress";
import { WallFloatDecor } from "@/components/WallFloatDecor";
import { WallSuccessOverlay } from "@/components/WallSuccessOverlay";
import { type Participant, type ScratchId } from "@/lib/types";
import { isSupabaseConfigured, getSupabaseBrowser } from "@/lib/supabase";
import {
  autoFillProgress,
  isFillMinutes,
  type AutoFill,
} from "@/lib/scratch-progress";

const WALL_NAME_ACCENTS = ["#4285f4", "#ea4335", "#fbbc05", "#34a853"] as const;
const TOAST_VISIBLE_MS = 5000;
const TOAST_EXIT_MS = 480;
const FILL_DURATION_MS = 1400;
const SCRATCH_SOUND_SRC = "/sounds/paper-scratch.mp3";
const POP_SOUND_SRC = "/sounds/name-pop.mp3";
const SOUND_FLAG_KEY = "gsa_wall_scratch_sound";

type WallToast = Participant & {
  accent: string;
  leaving?: boolean;
};

function hashTilt(id: string) {
  let n = 0;
  for (let i = 0; i < id.length; i += 1)
    n = (n + id.charCodeAt(i) * (i + 1)) % 97;
  return n;
}

function genderAvatarSrc(gender: string) {
  if (gender === "Pria" || gender === "Male") return "/assets/avatar-pria.png";
  if (gender === "Wanita" || gender === "Female") return "/assets/avatar-wanita.png";
  return null;
}

function sameFill(a: AutoFill | null, b: AutoFill | null) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.startedAt === b.startedAt && a.minutes === b.minutes;
}

function readAutoFill(scratch: {
  complete?: boolean;
  fill?: { startedAt?: string; minutes?: number } | null;
}): AutoFill | null {
  if (scratch.complete === true) return null;
  const fill = scratch.fill;
  if (!fill?.startedAt || !isFillMinutes(fill.minutes)) return null;
  return { startedAt: fill.startedAt, minutes: fill.minutes };
}

function readAssetProgress(scratch: {
  complete?: boolean;
  progress?: Partial<Record<ScratchId, number>>;
}): Record<ScratchId, number> {
  if (scratch.complete === true) {
    return { hat: 1, pencil: 1, ribbon: 1 };
  }
  const next = { hat: 0, pencil: 0, ribbon: 0 };
  for (const id of ["hat", "pencil", "ribbon"] as const) {
    const n = Number(scratch.progress?.[id]);
    next[id] = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
  }
  return next;
}

export default function WallPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [toasts, setToasts] = useState<WallToast[]>([]);
  const [target, setTarget] = useState(20);
  const [forceComplete, setForceComplete] = useState(false);
  const [assetProgress, setAssetProgress] = useState<Record<ScratchId, number>>({
    hat: 0,
    pencil: 0,
    ribbon: 0,
  });
  const [autoFill, setAutoFill] = useState<AutoFill | null>(null);
  const [displayProgress, setDisplayProgress] = useState(0);
  const seenIds = useRef(new Set<string>());
  const accentTick = useRef(0);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>[]>());
  const displayProgressRef = useRef(0);
  const prevAssetProgress = useRef(assetProgress);
  const animRaf = useRef(0);
  const autoFillRaf = useRef(0);
  const autoFillRef = useRef<AutoFill | null>(null);
  const submitCountRef = useRef(0);
  const targetRef = useRef(20);
  autoFillRef.current = autoFill;
  submitCountRef.current = participants.length;
  targetRef.current = target;
  const [hydrated, setHydrated] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const didHydrateSnap = useRef(false);
  const scratchAudio = useRef<HTMLAudioElement | null>(null);
  const popAudio = useRef<HTMLAudioElement | null>(null);
  const soundEnabledRef = useRef(false);
  const audioUnlockedRef = useRef(false);

  /** #Team Google + Gemini scratch when a student hits Submit, or timed staff fill. */
  const revealProgress = useMemo(() => {
    if (forceComplete) return 1;
    const submit =
      target <= 0 ? 0 : Math.min(1, participants.length / target);
    return Math.max(submit, autoFillProgress(autoFill));
  }, [forceComplete, participants.length, target, autoFill]);

  /** Hat / pencil / ribbon / books: green-check counts, or the timed staff fill. */
  const floatProgress = useMemo(() => {
    if (forceComplete) return { hat: 1, pencil: 1, ribbon: 1 };
    if (!autoFill) return assetProgress;
    return {
      hat: Math.max(assetProgress.hat, displayProgress),
      pencil: Math.max(assetProgress.pencil, displayProgress),
      ribbon: Math.max(assetProgress.ribbon, displayProgress),
    };
  }, [forceComplete, autoFill, assetProgress, displayProgress]);

  useEffect(() => {
    const audio = new Audio(SCRATCH_SOUND_SRC);
    audio.preload = "auto";
    audio.volume = 1;
    scratchAudio.current = audio;
    audio.load();

    const pop = new Audio(POP_SOUND_SRC);
    pop.preload = "auto";
    pop.volume = 0.9;
    popAudio.current = pop;
    pop.load();

    const readFlag = () => {
      try {
        soundEnabledRef.current = localStorage.getItem(SOUND_FLAG_KEY) === "1";
      } catch {
        soundEnabledRef.current = false;
      }
    };
    readFlag();

    const onStorage = (e: StorageEvent) => {
      if (e.key === SOUND_FLAG_KEY) readFlag();
    };
    window.addEventListener("storage", onStorage);

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("gsa-scratch-sound");
      channel.onmessage = (ev) => {
        soundEnabledRef.current = !!ev.data?.enabled;
      };
    } catch {
      /* ignore */
    }

    const unlock = () => {
      if (audioUnlockedRef.current) return;
      const unlockOne = (a: HTMLAudioElement | null) => {
        if (!a) return Promise.resolve();
        const prev = a.volume;
        a.volume = 0;
        return a
          .play()
          .then(() => {
            a.pause();
            a.currentTime = 0;
            a.volume = prev;
          })
          .catch(() => {
            a.volume = prev;
          });
      };
      void Promise.all([
        unlockOne(scratchAudio.current),
        unlockOne(popAudio.current),
      ]).then(() => {
        audioUnlockedRef.current = true;
      });
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);

    return () => {
      audio.pause();
      pop.pause();
      scratchAudio.current = null;
      popAudio.current = null;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      channel?.close();
    };
  }, []);

  const playPopSound = useCallback(() => {
    const play = (el: HTMLAudioElement) => {
      try {
        el.pause();
        el.currentTime = 0;
      } catch {
        /* ignore */
      }
      void el.play().catch(() => {
        audioUnlockedRef.current = false;
      });
    };
    const existing = popAudio.current;
    if (existing && !existing.paused && existing.currentTime > 0) {
      const clone = existing.cloneNode(true) as HTMLAudioElement;
      clone.volume = 0.9;
      void clone.play().catch(() => {
        /* ignore */
      });
      return;
    }
    if (existing) {
      play(existing);
      return;
    }
    const fresh = new Audio(POP_SOUND_SRC);
    fresh.volume = 0.9;
    popAudio.current = fresh;
    play(fresh);
  }, []);

  const playScratchSound = useCallback(() => {
    if (!soundEnabledRef.current) return;
    const audio = scratchAudio.current;
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      /* ignore */
    }
    void audio.play().catch(() => {
      audioUnlockedRef.current = false;
    });
  }, []);

  /** Animate wipe whenever fill increases (after initial load). */
  useEffect(() => {
    if (!hydrated) return;
    if (autoFill) return;

    const from = displayProgressRef.current;
    const to = revealProgress;

    if (!didHydrateSnap.current) {
      didHydrateSnap.current = true;
      displayProgressRef.current = to;
      setDisplayProgress(to);
      return;
    }

    if (Math.abs(to - from) < 0.0005) {
      displayProgressRef.current = to;
      setDisplayProgress(to);
      return;
    }

    // Shrinking (e.g. target raised) — snap
    if (to < from) {
      cancelAnimationFrame(animRaf.current);
      displayProgressRef.current = to;
      setDisplayProgress(to);
      return;
    }

    playScratchSound();
    cancelAnimationFrame(animRaf.current);
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / FILL_DURATION_MS);
      const eased = 1 - (1 - t) * (1 - t);
      const next = from + (to - from) * eased;
      displayProgressRef.current = next;
      setDisplayProgress(next);
      if (t < 1) {
        animRaf.current = requestAnimationFrame(tick);
      } else {
        displayProgressRef.current = to;
        setDisplayProgress(to);
      }
    };

    animRaf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRaf.current);
  }, [revealProgress, hydrated, playScratchSound, autoFill]);

  useEffect(() => {
    if (!hydrated || !autoFill) return;
    cancelAnimationFrame(animRaf.current);
    cancelAnimationFrame(autoFillRaf.current);
    let lastBand = Math.floor(displayProgressRef.current / 0.04);
    const tick = () => {
      const targetNow = targetRef.current;
      const submit =
        targetNow <= 0
          ? 0
          : Math.min(1, submitCountRef.current / targetNow);
      const next = Math.max(submit, autoFillProgress(autoFillRef.current));
      displayProgressRef.current = next;
      setDisplayProgress(next);
      const band = Math.floor(next / 0.04);
      if (band > lastBand) {
        lastBand = band;
        playScratchSound();
      }
      if (next < 1 && autoFillRef.current) {
        autoFillRaf.current = requestAnimationFrame(tick);
      }
    };
    autoFillRaf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(autoFillRaf.current);
  }, [autoFill, hydrated, playScratchSound]);

  useEffect(() => {
    if (!hydrated) {
      prevAssetProgress.current = assetProgress;
      return;
    }
    const prev = prevAssetProgress.current;
    const rose =
      assetProgress.hat > prev.hat + 0.0005 ||
      assetProgress.pencil > prev.pencil + 0.0005 ||
      assetProgress.ribbon > prev.ribbon + 0.0005;
    prevAssetProgress.current = assetProgress;
    if (rose) playScratchSound();
  }, [assetProgress, hydrated, playScratchSound]);

  /** After the wipe finishes at 100%, show the wall success finale. */
  useEffect(() => {
    if (displayProgress < 0.999) {
      setShowSuccess(false);
      return;
    }
    const t = setTimeout(() => setShowSuccess(true), 550);
    return () => clearTimeout(t);
  }, [displayProgress]);

  const pushToast = useCallback((p: Participant) => {
    if (seenIds.current.has(p.id)) return;
    seenIds.current.add(p.id);

    const accent =
      WALL_NAME_ACCENTS[accentTick.current % WALL_NAME_ACCENTS.length];
    accentTick.current += 1;

    setToasts((prev) => [...prev, { ...p, accent }]);
    playPopSound();

    const leaveTimer = setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === p.id ? { ...t, leaving: true } : t)),
      );
    }, TOAST_VISIBLE_MS - TOAST_EXIT_MS);

    const removeTimer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== p.id));
      timers.current.delete(p.id);
    }, TOAST_VISIBLE_MS);

    timers.current.set(p.id, [leaveTimer, removeTimer]);
  }, [playPopSound]);

  const mergeParticipant = useCallback(
    (p: Participant) => {
      setParticipants((prev) => {
        if (prev.some((x) => x.id === p.id)) return prev;
        return [...prev, p];
      });
      pushToast(p);
    },
    [pushToast],
  );

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let channel: ReturnType<
      ReturnType<typeof getSupabaseBrowser>["channel"]
    > | null = null;

    async function bootstrap() {
      const [peopleRes, scratchRes] = await Promise.all([
        fetch("/api/participants"),
        fetch("/api/scratch"),
      ]);
      const data = await peopleRes.json();
      const scratch = await scratchRes.json();
      if (cancelled) return;

      const list: Participant[] = data.participants ?? [];
      setParticipants(list);
      for (const p of list) seenIds.current.add(p.id);
      if (typeof scratch.target === "number" && scratch.target > 0) {
        setTarget(scratch.target);
      }
      setForceComplete(scratch.complete === true);
      setAssetProgress(readAssetProgress(scratch));
      setAutoFill((prev) => {
        const next = readAutoFill(scratch);
        return sameFill(prev, next) ? prev : next;
      });
      setHydrated(true);

      pollTimer = setInterval(async () => {
        try {
          const [rPeople, rScratch] = await Promise.all([
            fetch("/api/participants"),
            fetch("/api/scratch"),
          ]);
          const dPeople = await rPeople.json();
          const dScratch = await rScratch.json();
          const next: Participant[] = dPeople.participants ?? [];
          setParticipants(next);
          for (const p of next) {
            if (!seenIds.current.has(p.id)) pushToast(p);
          }
          if (typeof dScratch.target === "number" && dScratch.target > 0) {
            setTarget(dScratch.target);
          }
          setForceComplete(dScratch.complete === true);
          setAssetProgress(readAssetProgress(dScratch));
          setAutoFill((prev) => {
            const nextFill = readAutoFill(dScratch);
            return sameFill(prev, nextFill) ? prev : nextFill;
          });
        } catch {
          /* ignore */
        }
      }, 700);

      if (data.mode !== "memory" && isSupabaseConfigured()) {
        try {
          const supabase = getSupabaseBrowser();
          channel = supabase
            .channel("wall-participants")
            .on(
              "postgres_changes",
              { event: "INSERT", schema: "public", table: "participants" },
              (payload) => {
                mergeParticipant(payload.new as Participant);
              },
            )
            .subscribe();
        } catch (err) {
          console.error(err);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      timers.current.forEach((list) => list.forEach(clearTimeout));
      timers.current.clear();
      if (channel && isSupabaseConfigured()) {
        try {
          void getSupabaseBrowser().removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
    };
  }, [mergeParticipant, pushToast]);

  return (
    <StageShell showTeamMark={false}>
      <div className="relative z-0 flex min-h-0 flex-1 items-center justify-center px-10 pb-8 pt-4">
        <div
          className={`wall-scratch-stage relative flex w-full max-w-7xl items-center justify-center transition-opacity duration-700 ${
            showSuccess ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          <div className="relative">
            <WallHeroProgress progress={displayProgress} />
            <WallFloatDecor progress={floatProgress} />
          </div>
        </div>
      </div>

      <div
        className={`pointer-events-none absolute inset-0 z-20 transition-opacity duration-500 ${
          showSuccess ? "opacity-0" : "opacity-100"
        }`}
      >
        {toasts.map((t) => {
          const tilt = ((hashTilt(t.id) % 11) - 5) * 1.4;
          const avatarSrc = genderAvatarSrc(t.gender);
          return (
            <div
              key={t.id}
              className={`wall-name pointer-events-auto${
                t.leaving ? " is-leaving" : " is-enter"
              }`}
              style={
                {
                  left: `${t.pos_x}%`,
                  top: `${t.pos_y}%`,
                  "--accent": t.accent,
                  "--tilt": `${tilt}deg`,
                } as CSSProperties
              }
            >
              {avatarSrc ? (
                <span className="wall-name-avatar">
                  <img src={avatarSrc} alt="" />
                </span>
              ) : (
                <span className="wall-name-dot" aria-hidden />
              )}
              <span className="wall-name-text">{t.name}</span>
            </div>
          );
        })}
      </div>

      {showSuccess ? (
        <WallSuccessOverlay />
      ) : null}
    </StageShell>
  );
}
