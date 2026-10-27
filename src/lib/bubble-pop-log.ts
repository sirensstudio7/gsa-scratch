import { getOnboardingLayout } from "@/lib/onboarding-layout";

export type BubblePopRecord = {
  id: number;
  iconId: string;
  createdAt: string;
};

const MAX_POPS = 600;

type GlobalBubblePop = {
  __gsaBubblePops?: BubblePopRecord[];
  __gsaBubblePopNextId?: number;
};

function store() {
  return globalThis as typeof globalThis & GlobalBubblePop;
}

const VALID_ICON_IDS = new Set(
  getOnboardingLayout().icons.map((icon) => icon.id),
);

export function isValidOnboardingIconId(iconId: unknown): iconId is string {
  return typeof iconId === "string" && VALID_ICON_IDS.has(iconId);
}

/** For /wall floats — never use raw DB values that 404 sprite paths. */
export function resolveBubblePopIconId(iconId: unknown): string {
  if (isValidOnboardingIconId(iconId)) return iconId;
  if (typeof iconId === "string") {
    const trimmed = iconId.trim();
    if (isValidOnboardingIconId(trimmed)) return trimmed;
  }
  const first = getOnboardingLayout().icons[0]?.id;
  return first && VALID_ICON_IDS.has(first) ? first : "icon-00";
}

export function listBubblePops(): BubblePopRecord[] {
  return [...(store().__gsaBubblePops ?? [])];
}

export function setBubblePopsFromDb(rows: BubblePopRecord[]) {
  const g = store();
  g.__gsaBubblePops = rows.slice(-MAX_POPS);
  const maxId = g.__gsaBubblePops.reduce((m, r) => Math.max(m, r.id), 0);
  g.__gsaBubblePopNextId = maxId + 1;
}

export function appendBubblePop(iconId: string): BubblePopRecord {
  const g = store();
  if (!g.__gsaBubblePops) g.__gsaBubblePops = [];
  if (typeof g.__gsaBubblePopNextId !== "number") {
    g.__gsaBubblePopNextId =
      g.__gsaBubblePops.reduce((m, r) => Math.max(m, r.id), 0) + 1;
  }
  const record: BubblePopRecord = {
    id: g.__gsaBubblePopNextId++,
    iconId,
    createdAt: new Date().toISOString(),
  };
  g.__gsaBubblePops.push(record);
  if (g.__gsaBubblePops.length > MAX_POPS) {
    g.__gsaBubblePops.splice(0, g.__gsaBubblePops.length - MAX_POPS);
  }
  return record;
}

export function clearBubblePopLog() {
  const g = store();
  g.__gsaBubblePops = [];
  g.__gsaBubblePopNextId = 1;
}
