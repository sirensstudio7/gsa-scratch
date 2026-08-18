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
import { WallRevealAsset } from "@/components/WallRevealAsset";
import { WallSuccessOverlay } from "@/components/WallSuccessOverlay";
import { SCRATCH_OBJECTS, type Participant, type ScratchId } from "@/lib/types";
import { isSupabaseConfigured, getSupabaseBrowser } from "@/lib/supabase";

const WALL_ASSETS = SCRATCH_OBJECTS.map((obj) => ({
  id: obj.id as ScratchId,
  colorSrc: obj.colorSrc,
  whiteSrc: obj.maskSrc.replace("-white.png", "-white-clear.png"),
  alt: obj.label,
}));

const WALL_NAME_ACCENTS = ["#4285f4", "#ea4335", "#fbbc05", "#34a853"] as const;
const TOAST_VISIBLE_MS = 5000;
const TOAST_EXIT_MS = 480;
const FILL_DURATION_MS = 700;
const SCRATCH_SOUND_SRC = "/sounds/paper-scratch.mp3";
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

export default function WallPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [toasts, setToasts] = useState<WallToast[]>([]);
  const [target, setTarget] = useState(20);
  const [displayProgress, setDisplayProgress] = useState(0);
  const seenIds = useRef(new Set<string>());
  const accentTick = useRef(0);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>[]>());
  const displayProgressRef = useRef(0);
  const animRaf = useRef(0);
  const [hydrated, setHydrated] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const didHydrateSnap = useRef(false);
  const scratchAudio = useRef<HTMLAudioElement | null>(null);
  const soundEnabledRef = useRef(false);
  const audioUnlockedRef = useRef(false);

  /** Wall reveal = submitted students / staff target */
  const revealProgress = useMemo(() => {
    if (target <= 0) return 0;
    return Math.min(1, participants.length / target);
  }, [participants.length, target]);

  useEffect(() => {
    const audio = new Audio(SCRATCH_SOUND_SRC);
    audio.preload = "auto";
    audio.volume = 1;
    scratchAudio.current = audio;
    audio.load();

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
      const a = scratchAudio.current;
      if (!a) return;
      const prev = a.volume;
      a.volume = 0;
      void a
        .play()
        .then(() => {
          a.pause();
          a.currentTime = 0;
          a.volume = prev;
          audioUnlockedRef.current = true;
        })
        .catch(() => {
          a.volume = prev;
        });
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);

    return () => {
      audio.pause();
      scratchAudio.current = null;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      channel?.close();
    };
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
  }, [revealProgress, hydrated, playScratchSound]);

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
  }, []);

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
        } catch {
          /* ignore */
        }
      }, 1500);

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
    <StageShell>
      {!showSuccess ? (
        <div className="absolute left-4 top-2 z-30 rounded-2xl bg-white/80 px-5 py-3 shadow-lg backdrop-blur sm:left-6 sm:top-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#5f6368]">
            Google Student Ambasador 2026
          </p>
          <p className="text-3xl font-black text-[#1a73e8]">
            {participants.length}
            <span className="ml-2 text-base font-semibold text-[#3c4043]">
              / {target} participants
            </span>
          </p>
        </div>
      ) : null}

      <div className="relative z-0 flex min-h-0 flex-1 items-center justify-center px-10 pb-8 pt-4">
        <div
          className={`wall-scratch-stage grid w-full max-w-7xl grid-cols-3 items-center justify-items-center gap-6 transition-opacity duration-700 ${
            showSuccess ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          {WALL_ASSETS.map((asset) => (
            <WallRevealAsset
              key={asset.id}
              colorSrc={asset.colorSrc}
              whiteSrc={asset.whiteSrc}
              alt={asset.alt}
              progress={displayProgress}
            />
          ))}
        </div>
      </div>

      <div
        className={`pointer-events-none absolute inset-0 z-20 transition-opacity duration-500 ${
          showSuccess ? "opacity-0" : "opacity-100"
        }`}
      >
        {toasts.map((t) => {
          const tilt = ((hashTilt(t.id) % 11) - 5) * 1.4;
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
              <span className="wall-name-dot" aria-hidden />
              <span className="wall-name-text">{t.name}</span>
            </div>
          );
        })}
      </div>

      {showSuccess ? (
        <WallSuccessOverlay participantCount={participants.length} />
      ) : null}
    </StageShell>
  );
}
