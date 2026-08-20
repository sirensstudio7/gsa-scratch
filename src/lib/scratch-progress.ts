import type { ScratchId } from "@/lib/types";

export const SCRATCH_IDS: ScratchId[] = ["hat", "pencil", "ribbon"];
export const FILL_MINUTES = [3, 5, 7] as const;
export type FillMinutes = (typeof FILL_MINUTES)[number];

export type ScratchCounts = Record<ScratchId, number>;

export type AutoFill = {
  startedAt: string;
  minutes: FillMinutes;
};

export type ScratchProgress = {
  counts: ScratchCounts;
  target: number;
  progress: Record<ScratchId, number>;
  fullyRevealed: boolean;
  complete: boolean;
  fill: AutoFill | null;
};

type GlobalScratch = {
  __gsaScratchCounts?: ScratchCounts;
  __gsaScratchClaims?: Set<string>;
  __gsaRevealTarget?: number;
  __gsaForceComplete?: boolean;
  __gsaAutoFill?: AutoFill | null;
};

function scratchStore() {
  const g = globalThis as typeof globalThis & GlobalScratch;
  if (!g.__gsaScratchCounts) {
    g.__gsaScratchCounts = { hat: 0, pencil: 0, ribbon: 0 };
  }
  if (!g.__gsaScratchClaims) {
    g.__gsaScratchClaims = new Set();
  }
  return {
    counts: g.__gsaScratchCounts,
    claims: g.__gsaScratchClaims,
  };
}

export function isFillMinutes(value: unknown): value is FillMinutes {
  return value === 3 || value === 5 || value === 7;
}

export function getAutoFill(): AutoFill | null {
  return (globalThis as typeof globalThis & GlobalScratch).__gsaAutoFill ?? null;
}

export function setAutoFill(value: AutoFill | null) {
  const g = globalThis as typeof globalThis & GlobalScratch;
  g.__gsaAutoFill = value;
  return g.__gsaAutoFill ?? null;
}

export function startAutoFill(minutes: FillMinutes): AutoFill {
  const next: AutoFill = {
    startedAt: new Date().toISOString(),
    minutes,
  };
  setForceComplete(false);
  return setAutoFill(next) as AutoFill;
}

export function autoFillProgress(
  fill: AutoFill | null,
  now = Date.now(),
): number {
  if (!fill) return 0;
  const start = Date.parse(fill.startedAt);
  if (!Number.isFinite(start)) return 0;
  const duration = fill.minutes * 60_000;
  if (duration <= 0) return 1;
  return Math.max(0, Math.min(1, (now - start) / duration));
}

export function autoFillRemainingMs(
  fill: AutoFill | null,
  now = Date.now(),
): number {
  if (!fill) return 0;
  const start = Date.parse(fill.startedAt);
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, fill.minutes * 60_000 - (now - start));
}

export function getRevealTarget() {
  const g = globalThis as typeof globalThis & GlobalScratch;
  if (typeof g.__gsaRevealTarget === "number" && g.__gsaRevealTarget > 0) {
    return g.__gsaRevealTarget;
  }
  const raw = Number(process.env.WALL_REVEAL_TARGET || "20");
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 20;
}

export function setRevealTarget(n: number) {
  const g = globalThis as typeof globalThis & GlobalScratch;
  const next = Math.max(1, Math.min(5000, Math.floor(n)));
  g.__gsaRevealTarget = next;
  return next;
}

export function getForceComplete() {
  return Boolean(
    (globalThis as typeof globalThis & GlobalScratch).__gsaForceComplete,
  );
}

export function setForceComplete(value: boolean) {
  const g = globalThis as typeof globalThis & GlobalScratch;
  g.__gsaForceComplete = value;
  if (value) g.__gsaAutoFill = null;
  return g.__gsaForceComplete;
}

export function emptyCounts(): ScratchCounts {
  return { hat: 0, pencil: 0, ribbon: 0 };
}

function settleExpiredFill() {
  const fill = getAutoFill();
  if (fill && autoFillProgress(fill) >= 1) {
    setForceComplete(true);
    setAutoFill(null);
  }
}

export function toProgressPayload(counts: ScratchCounts): ScratchProgress {
  settleExpiredFill();
  const target = getRevealTarget();
  const complete = getForceComplete();
  const fill = complete ? null : getAutoFill();
  const timed = autoFillProgress(fill);
  const progress = {
    hat: complete ? 1 : Math.min(1, Math.max(counts.hat / target, timed)),
    pencil: complete ? 1 : Math.min(1, Math.max(counts.pencil / target, timed)),
    ribbon: complete ? 1 : Math.min(1, Math.max(counts.ribbon / target, timed)),
  };
  return {
    counts,
    target,
    progress,
    fullyRevealed:
      complete ||
      (progress.hat >= 1 && progress.pencil >= 1 && progress.ribbon >= 1),
    complete,
    fill,
  };
}

export function getMemoryScratchProgress(): ScratchProgress {
  return toProgressPayload({ ...scratchStore().counts });
}

/** Returns updated progress. Duplicate client+asset is ignored. */
export function claimMemoryScratch(
  asset: ScratchId,
  clientId: string,
): ScratchProgress & { accepted: boolean } {
  const { counts, claims } = scratchStore();
  const key = `${clientId}:${asset}`;
  if (claims.has(key)) {
    return { ...toProgressPayload({ ...counts }), accepted: false };
  }
  claims.add(key);
  counts[asset] += 1;
  return { ...toProgressPayload({ ...counts }), accepted: true };
}

export function clearMemoryScratchProgress() {
  const g = globalThis as typeof globalThis & GlobalScratch;
  g.__gsaScratchCounts = { hat: 0, pencil: 0, ribbon: 0 };
  g.__gsaScratchClaims = new Set();
  g.__gsaForceComplete = false;
  g.__gsaAutoFill = null;
}

export function isScratchId(value: unknown): value is ScratchId {
  return value === "hat" || value === "pencil" || value === "ribbon";
}
