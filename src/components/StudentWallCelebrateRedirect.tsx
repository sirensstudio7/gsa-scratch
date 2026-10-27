"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  BUBBLE_PROGRESS_CHANNEL,
  BUBBLE_TOTAL_EVENT,
  BUBBLE_TOTAL_STORAGE_KEY,
  bubbleWallProgress,
  readStoredBubbleTotal,
} from "@/lib/wall-bubble-fill";
import { markStudentWallSession } from "@/lib/student-wall-session";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase";

export type WelcomeWallProgressState = {
  /** First /api scratch + bubbles sync finished. */
  ready: boolean;
  /** Global tap count ≥ staff target — hide welcome bubbles. */
  goalReached: boolean;
};

type Props = {
  onWelcomeProgress?: (state: WelcomeWallProgressState) => void;
};

/** When global bubble taps hit 100%, send this tab to /wall (student phones). */
export function StudentWallCelebrateRedirect({ onWelcomeProgress }: Props) {
  const router = useRouter();
  const redirected = useRef(false);
  const targetRef = useRef(20);
  const goalReachedRef = useRef(false);
  const readyRef = useRef(false);

  useEffect(() => {
    let alive = true;

    const report = (reached: boolean, markReady = false) => {
      if (markReady) readyRef.current = true;
      const goalChanged = goalReachedRef.current !== reached;
      if (goalChanged) goalReachedRef.current = reached;
      if (!readyRef.current && !markReady) return;
      if (goalChanged || markReady) {
        onWelcomeProgress?.({
          ready: readyRef.current,
          goalReached: goalReachedRef.current,
        });
      }
    };

    const maybeRedirect = (
      total: number,
      markReady = false,
      complete = false,
    ) => {
      if (!alive) return;
      const reached =
        complete || bubbleWallProgress(total, targetRef.current) >= 1;
      report(reached, markReady);
      if (redirected.current) return;
      if (reached) {
        redirected.current = true;
        markStudentWallSession();
        router.replace("/wall");
      }
    };

    async function syncTotals() {
      try {
        const res = await fetch("/api/scratch", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as {
            target?: number;
            bubbleClicks?: number;
            complete?: boolean;
          };
          if (typeof data.target === "number" && data.target > 0) {
            targetRef.current = data.target;
          }
          if (typeof data.bubbleClicks === "number") {
            maybeRedirect(data.bubbleClicks, true, data.complete === true);
            return;
          }
        }
      } catch {
        /* ignore */
      }
      const stored = readStoredBubbleTotal();
      if (stored != null) {
        maybeRedirect(stored, true);
      } else {
        report(goalReachedRef.current, true);
      }
    }

    void syncTotals();

    const onBubbleEvent = (ev: Event) => {
      const detail = (ev as CustomEvent<{ total?: number }>).detail;
      if (typeof detail?.total === "number") maybeRedirect(detail.total);
    };

    const onStorage = (ev: StorageEvent) => {
      if (ev.key !== BUBBLE_TOTAL_STORAGE_KEY) return;
      if (ev.newValue == null) {
        redirected.current = false;
        maybeRedirect(0);
        return;
      }
      maybeRedirect(Number(ev.newValue) || 0);
    };

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(BUBBLE_PROGRESS_CHANNEL);
      channel.onmessage = (ev) => {
        if (typeof ev.data?.total === "number") maybeRedirect(ev.data.total);
      };
    } catch {
      /* ignore */
    }

    window.addEventListener(BUBBLE_TOTAL_EVENT, onBubbleEvent);
    window.addEventListener("storage", onStorage);

    let settingsChannel: ReturnType<
      ReturnType<typeof getSupabaseBrowser>["channel"]
    > | null = null;
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseBrowser();
        settingsChannel = supabase
          .channel("welcome-scratch-settings")
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "scratch_settings",
            },
            (payload) => {
              const row = payload.new as Record<string, unknown>;
              const nextTarget = Number(row.target);
              if (Number.isFinite(nextTarget) && nextTarget > 0) {
                targetRef.current = Math.floor(nextTarget);
              }
              const clicks = Number(row.bubble_clicks);
              maybeRedirect(
                Number.isFinite(clicks) ? clicks : 0,
                false,
                row.complete === true,
              );
            },
          )
          .subscribe();
      } catch {
        /* poll still covers the goal */
      }
    }

    const poll = window.setInterval(() => {
      if (document.hidden) return;
      void syncTotals();
    }, 8000);

    return () => {
      alive = false;
      window.removeEventListener(BUBBLE_TOTAL_EVENT, onBubbleEvent);
      window.removeEventListener("storage", onStorage);
      channel?.close();
      window.clearInterval(poll);
      if (settingsChannel && isSupabaseConfigured()) {
        try {
          void getSupabaseBrowser().removeChannel(settingsChannel);
        } catch {
          /* ignore */
        }
      }
    };
  }, [router, onWelcomeProgress]);

  return null;
}
