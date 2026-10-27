"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { StageShell } from "@/components/StageShell";
import {
  WallBubbleMeetFloats,
  type WallBubbleMeetFloatsHandle,
} from "@/components/WallBubbleMeetFloats";
import { StudentWallResetRedirect } from "@/components/StudentWallResetRedirect";
import { WallKvLayout } from "@/components/WallKvLayout";
import type { BubblePopRecord } from "@/lib/bubble-pop-log";
import { resolveBubblePopIconId } from "@/lib/bubble-pop-log";
import { SuccessConfetti } from "@/components/SuccessConfetti";
import { SuccessFireworks } from "@/components/SuccessFireworks";
import { type Participant, type ScratchId } from "@/lib/types";
import { isSupabaseConfigured, getSupabaseBrowser } from "@/lib/supabase";
import {
  autoFillProgress,
  isFillMinutes,
  type AutoFill,
} from "@/lib/scratch-progress";
import { bubblesFetchUrl } from "@/lib/bubble-api";
import {
  BUBBLE_PROGRESS_CHANNEL,
  BUBBLE_TOTAL_EVENT,
  BUBBLE_TOTAL_STORAGE_KEY,
  bubbleWallProgress,
  readStoredBubbleTotal,
} from "@/lib/wall-bubble-fill";

const BUBBLE_CATCHUP_MS = 2800;

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
  const [bubbleClicks, setBubbleClicks] = useState(0);
  const [bubblePops, setBubblePops] = useState<BubblePopRecord[]>([]);
  const bubbleClicksRef = useRef(0);
  const floatsRef = useRef<WallBubbleMeetFloatsHandle>(null);
  const hydratedRef = useRef(false);
  const bootstrapPopsRef = useRef<BubblePopRecord[]>([]);
  const lastPopIdRef = useRef(0);
  const targetRef = useRef(20);
  autoFillRef.current = autoFill;
  bubbleClicksRef.current = bubbleClicks;
  targetRef.current = target;
  const [hydrated, setHydrated] = useState(false);
  hydratedRef.current = hydrated;
  const didHydrateSnap = useRef(false);
  const scratchAudio = useRef<HTMLAudioElement | null>(null);
  const popAudio = useRef<HTMLAudioElement | null>(null);
  const soundEnabledRef = useRef(false);
  const audioUnlockedRef = useRef(false);

  /** KV + #TeamGoogle fill from global bubble taps (staff target = tap count at 100%). */
  const revealProgress = useMemo(() => {
    if (forceComplete) return 1;
    const fromBubbles = bubbleWallProgress(bubbleClicks, target);
    if (autoFill) return Math.max(fromBubbles, autoFillProgress(autoFill));
    return fromBubbles;
  }, [forceComplete, bubbleClicks, target, autoFill]);

  /** Latch at 100% — confetti + caption until staff Reset Event Data. */
  const [celebrationHeld, setCelebrationHeld] = useState(false);

  useEffect(() => {
    if (revealProgress >= 0.999 || forceComplete) {
      setCelebrationHeld(true);
    }
  }, [revealProgress, forceComplete]);

  useEffect(() => {
    if (!celebrationHeld) return;
    const staffReset =
      bubbleClicks <= 0 &&
      !forceComplete &&
      revealProgress < 0.02 &&
      !autoFill;
    if (!staffReset) return;
    setCelebrationHeld(false);
    setBubblePops([]);
    floatsRef.current?.prime([]);
  }, [
    celebrationHeld,
    bubbleClicks,
    forceComplete,
    revealProgress,
    autoFill,
  ]);

  const kvProgress = celebrationHeld ? 1 : revealProgress;
  const teamProgress = celebrationHeld ? 1 : displayProgress;

  useLayoutEffect(() => {
    void fetch(bubblesFetchUrl("total"), { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.total === "number") {
          setBubbleClicks(Math.max(0, Math.floor(data.total)));
        }
      })
      .catch(() => {
        /* ignore */
      });
  }, []);

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
      const submit = bubbleWallProgress(
        bubbleClicksRef.current,
        targetNow,
      );
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
    let alive = true;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let bubblePollTimer: ReturnType<typeof setInterval> | null = null;
    let channel: ReturnType<
      ReturnType<typeof getSupabaseBrowser>["channel"]
    > | null = null;
    let bubblePopChannel: ReturnType<
      ReturnType<typeof getSupabaseBrowser>["channel"]
    > | null = null;
    let scratchSettingsChannel: ReturnType<
      ReturnType<typeof getSupabaseBrowser>["channel"]
    > | null = null;
    let bubbleChannel: BroadcastChannel | null = null;

    const mergeBubblePops = (pops: BubblePopRecord[]) => {
      if (!pops.length) return;
      setBubblePops((prev) => {
        const map = new Map(prev.map((p) => [p.id, p]));
        for (const p of pops) map.set(p.id, p);
        return [...map.values()].sort((a, b) => a.id - b.id);
      });
    };

    const applyBubbleTotal = (total: number) => {
      const n = Math.max(0, Math.floor(total));
      if (n === bubbleClicksRef.current) return;
      setBubbleClicks(n);
      if (n === 0) {
        setBubblePops([]);
        lastPopIdRef.current = 0;
        floatsRef.current?.prime([]);
      }
    };

    const applyBubblePayload = (payload: {
      total?: number;
      pop?: BubblePopRecord;
      pops?: BubblePopRecord[];
    }) => {
      if (typeof payload.total === "number" && payload.total >= 0) {
        applyBubbleTotal(payload.total);
      }
      if (payload.pops?.length) mergeBubblePops(payload.pops);
      if (payload.pop) {
        lastPopIdRef.current = Math.max(lastPopIdRef.current, payload.pop.id);
        mergeBubblePops([payload.pop]);
        if (hydratedRef.current) {
          floatsRef.current?.spawn(payload.pop);
        }
      }
    };

    const onBubbleEvent = (ev: Event) => {
      const detail = (ev as CustomEvent<{ total?: number; pop?: BubblePopRecord }>)
        .detail;
      if (detail) applyBubblePayload(detail);
    };

    const onStorage = (ev: StorageEvent) => {
      if (ev.key !== BUBBLE_TOTAL_STORAGE_KEY || ev.newValue == null) return;
      applyBubblePayload({ total: Number(ev.newValue) });
    };

    window.addEventListener(BUBBLE_TOTAL_EVENT, onBubbleEvent);
    window.addEventListener("storage", onStorage);

    try {
      bubbleChannel = new BroadcastChannel(BUBBLE_PROGRESS_CHANNEL);
      bubbleChannel.onmessage = (ev) => {
        applyBubblePayload({
          total: Number(ev.data?.total),
          pop: ev.data?.pop as BubblePopRecord | undefined,
        });
      };
    } catch {
      /* ignore */
    }

    const stored = readStoredBubbleTotal();
    if (stored != null) applyBubblePayload({ total: stored });

    async function fetchBubbleBootstrap() {
      try {
        const res = await fetch(bubblesFetchUrl("full"), { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const pops = Array.isArray(data.pops)
          ? (data.pops as BubblePopRecord[])
          : undefined;
        if (pops?.length) {
          bootstrapPopsRef.current = pops;
          lastPopIdRef.current = pops.reduce(
            (m, p) => Math.max(m, p.id),
            lastPopIdRef.current,
          );
        }
        applyBubblePayload({
          total: Number(data.total) || 0,
          pops,
        });
      } catch {
        /* ignore */
      }
    }

    async function catchUpBubblePops() {
      try {
        const res = await fetch(
          bubblesFetchUrl("recent", lastPopIdRef.current),
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = await res.json();
        if (typeof data.total === "number") {
          applyBubbleTotal(Number(data.total) || 0);
        }
        const pops = Array.isArray(data.pops)
          ? (data.pops as BubblePopRecord[])
          : [];
        if (!pops.length) return;
        for (const p of pops) {
          lastPopIdRef.current = Math.max(lastPopIdRef.current, p.id);
        }
        applyBubblePayload({ pops });
      } catch {
        /* ignore */
      }
    }

    async function bootstrap() {
      try {
        const [peopleRes, scratchRes] = await Promise.all([
          fetch("/api/participants"),
          fetch("/api/scratch"),
        ]);
        await fetchBubbleBootstrap();

        if (peopleRes.ok) {
          const data = await peopleRes.json();
          const list: Participant[] = data.participants ?? [];
          setParticipants(list);
          for (const p of list) seenIds.current.add(p.id);
        }

        if (scratchRes.ok) {
          const scratch = await scratchRes.json();
          if (typeof scratch.target === "number" && scratch.target > 0) {
            setTarget(scratch.target);
          }
          if (typeof scratch.bubbleClicks === "number") {
            applyBubbleTotal(scratch.bubbleClicks);
          }
          setForceComplete(scratch.complete === true);
          setAssetProgress(readAssetProgress(scratch));
          setAutoFill((prev) => {
            const next = readAutoFill(scratch);
            return sameFill(prev, next) ? prev : next;
          });
        }
      } catch (err) {
        console.error("wall bootstrap", err);
      }
      if (!alive) return;

      setHydrated(true);
      requestAnimationFrame(() => {
        floatsRef.current?.prime(bootstrapPopsRef.current);
      });

      bubblePollTimer = setInterval(() => void catchUpBubblePops(), BUBBLE_CATCHUP_MS);

      if (isSupabaseConfigured()) {
        try {
          const supabase = getSupabaseBrowser();
          bubblePopChannel = supabase
            .channel("wall-bubble-pops")
            .on(
              "postgres_changes",
              {
                event: "INSERT",
                schema: "public",
                table: "bubble_pops",
              },
              (payload) => {
                const row = payload.new as Record<string, unknown>;
                const id = Number(row.id);
                if (!Number.isFinite(id)) return;
                applyBubblePayload({
                  pop: {
                    id,
                    iconId: resolveBubblePopIconId(row.icon_id),
                    createdAt: String(
                      row.created_at ?? new Date().toISOString(),
                    ),
                  },
                });
              },
            )
            .subscribe();

          scratchSettingsChannel = supabase
            .channel("wall-scratch-settings")
            .on(
              "postgres_changes",
              {
                event: "UPDATE",
                schema: "public",
                table: "scratch_settings",
              },
              (payload) => {
                const row = payload.new as Record<string, unknown>;
                const clicks = Number(row.bubble_clicks);
                if (Number.isFinite(clicks) && clicks >= 0) {
                  applyBubbleTotal(clicks);
                }
                const nextTarget = Number(row.target);
                if (Number.isFinite(nextTarget) && nextTarget > 0) {
                  setTarget(Math.floor(nextTarget));
                }
                if (row.complete === true) setForceComplete(true);
              },
            )
            .subscribe();
        } catch (err) {
          console.error("wall bubble_pops realtime", err);
        }
      }

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
          if (typeof dScratch.bubbleClicks === "number") {
            applyBubbleTotal(dScratch.bubbleClicks);
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
      }, 2000);

      if (isSupabaseConfigured()) {
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
      alive = false;
      window.removeEventListener(BUBBLE_TOTAL_EVENT, onBubbleEvent);
      window.removeEventListener("storage", onStorage);
      bubbleChannel?.close();
      if (pollTimer) clearInterval(pollTimer);
      if (bubblePollTimer) clearInterval(bubblePollTimer);
      timers.current.forEach((list) => list.forEach(clearTimeout));
      timers.current.clear();
      if (isSupabaseConfigured()) {
        try {
          const supabase = getSupabaseBrowser();
          if (channel) void supabase.removeChannel(channel);
          if (bubblePopChannel) void supabase.removeChannel(bubblePopChannel);
          if (scratchSettingsChannel) {
            void supabase.removeChannel(scratchSettingsChannel);
          }
        } catch {
          /* ignore */
        }
      }
    };
  }, [mergeParticipant, pushToast]);

  return (
    <StageShell showTeamMark={false} showHeader={false}>
      <StudentWallResetRedirect bubbleClicks={bubbleClicks} ready={hydrated} />
      <div className="wall-scratch-stage relative z-0 min-h-0 flex-1">
        <WallKvLayout
          kvFillProgress={kvProgress}
          teamGoogleProgress={teamProgress}
          showGraduationCaption={celebrationHeld}
          showCelebrationRewards={celebrationHeld}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 z-[15]">
        <WallBubbleMeetFloats
          ref={floatsRef}
          pops={bubblePops}
          live={hydrated}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 z-20">
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

      {celebrationHeld ? (
        <div
          className="pointer-events-none absolute inset-0 z-[35]"
          aria-hidden
        >
          <SuccessFireworks key="wall-celebration-fireworks" />
          <SuccessConfetti key="wall-celebration-confetti" />
        </div>
      ) : null}
    </StageShell>
  );
}
