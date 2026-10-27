import type { BubblePopRecord } from "@/lib/bubble-pop-log";
import { getBubblesPerStudent } from "@/lib/wall-student-session";

/** @deprecated use getBubblesPerStudent() */
export const WELCOME_BUBBLES_PER_STUDENT = getBubblesPerStudent();

export const BUBBLE_TOTAL_STORAGE_KEY = "gsa_bubble_total";
export const BUBBLE_PROGRESS_CHANNEL = "gsa-bubble-progress";
export const BUBBLE_TOTAL_EVENT = "gsa-bubble-total";

let progressChannel: BroadcastChannel | null = null;

function bubbleProgressChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (progressChannel) return progressChannel;
  try {
    progressChannel = new BroadcastChannel(BUBBLE_PROGRESS_CHANNEL);
    return progressChannel;
  } catch {
    return null;
  }
}

/** Target = total bubble tap untuk wall 100% (bukan jumlah siswa). */
export function getWallBubbleTarget(storedTarget: number): number {
  return Math.max(1, Math.floor(storedTarget));
}

export function bubbleWallProgress(
  bubbleClicks: number,
  storedTarget: number,
): number {
  const goal = getWallBubbleTarget(storedTarget);
  return Math.max(0, Math.min(1, bubbleClicks / goal));
}

/** Same-origin tabs: instant wall update when welcome records a pop. */
export function publishBubbleTotal(total: number, pop?: BubblePopRecord) {
  const n = Math.max(0, Math.floor(total));
  try {
    localStorage.setItem(BUBBLE_TOTAL_STORAGE_KEY, String(n));
  } catch {
    /* ignore */
  }
  bubbleProgressChannel()?.postMessage({ total: n, pop });
  try {
    window.dispatchEvent(
      new CustomEvent(BUBBLE_TOTAL_EVENT, { detail: { total: n, pop } }),
    );
  } catch {
    /* ignore */
  }
}

export function readStoredBubbleTotal(): number | null {
  try {
    const raw = localStorage.getItem(BUBBLE_TOTAL_STORAGE_KEY);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  } catch {
    return null;
  }
}
