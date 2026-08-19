import type { ScratchId } from "@/lib/types";

export const SCRATCH_IDS: ScratchId[] = ["hat", "pencil", "ribbon"];

export type ScratchCounts = Record<ScratchId, number>;

export type ScratchProgress = {
  counts: ScratchCounts;
  target: number;
  progress: Record<ScratchId, number>;
  fullyRevealed: boolean;
  complete: boolean;
};

type GlobalScratch = {
  __gsaScratchCounts?: ScratchCounts;
  __gsaScratchClaims?: Set<string>;
  __gsaRevealTarget?: number;
  __gsaForceComplete?: boolean;
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
  return g.__gsaForceComplete;
}

export function emptyCounts(): ScratchCounts {
  return { hat: 0, pencil: 0, ribbon: 0 };
}

export function toProgressPayload(counts: ScratchCounts): ScratchProgress {
  const target = getRevealTarget();
  const progress = {
    hat: Math.min(1, counts.hat / target),
    pencil: Math.min(1, counts.pencil / target),
    ribbon: Math.min(1, counts.ribbon / target),
  };
  return {
    counts,
    target,
    progress,
    fullyRevealed:
      getForceComplete() ||
      (progress.hat >= 1 && progress.pencil >= 1 && progress.ribbon >= 1),
    complete: getForceComplete(),
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
}

export function isScratchId(value: unknown): value is ScratchId {
  return value === "hat" || value === "pencil" || value === "ribbon";
}
