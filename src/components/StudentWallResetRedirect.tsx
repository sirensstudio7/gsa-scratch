"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BUBBLE_PROGRESS_CHANNEL,
  BUBBLE_TOTAL_EVENT,
  BUBBLE_TOTAL_STORAGE_KEY,
} from "@/lib/wall-bubble-fill";
import {
  clearStudentWallSession,
  isStudentWallSession,
} from "@/lib/student-wall-session";

type Props = {
  bubbleClicks: number;
  /** Ignore the first 0 until /wall has loaded the real tap total. */
  ready?: boolean;
};

/** Student tabs that came from welcome return to / after staff Reset Event Data. */
export function StudentWallResetRedirect({ bubbleClicks, ready = true }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (!ready || !isStudentWallSession()) return;

    const goWelcomeIfReset = (total: number) => {
      if (total > 0) return;
      clearStudentWallSession();
      router.replace("/");
    };

    goWelcomeIfReset(bubbleClicks);

    const onBubbleEvent = (ev: Event) => {
      const detail = (ev as CustomEvent<{ total?: number }>).detail;
      if (typeof detail?.total === "number") goWelcomeIfReset(detail.total);
    };

    const onStorage = (ev: StorageEvent) => {
      if (ev.key !== BUBBLE_TOTAL_STORAGE_KEY) return;
      if (ev.newValue == null || ev.newValue === "0") goWelcomeIfReset(0);
    };

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(BUBBLE_PROGRESS_CHANNEL);
      channel.onmessage = (ev) => {
        if (typeof ev.data?.total === "number") goWelcomeIfReset(ev.data.total);
      };
    } catch {
      /* ignore */
    }

    window.addEventListener(BUBBLE_TOTAL_EVENT, onBubbleEvent);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener(BUBBLE_TOTAL_EVENT, onBubbleEvent);
      window.removeEventListener("storage", onStorage);
      channel?.close();
    };
  }, [bubbleClicks, ready, router]);

  return null;
}
