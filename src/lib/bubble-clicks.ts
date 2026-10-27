type GlobalBubble = {
  __gsaBubbleClicks?: number;
};

function store() {
  const g = globalThis as typeof globalThis & GlobalBubble;
  if (typeof g.__gsaBubbleClicks !== "number") {
    g.__gsaBubbleClicks = 0;
  }
  return g;
}

export function getBubbleClickTotal(): number {
  return store().__gsaBubbleClicks ?? 0;
}

export function setBubbleClickTotal(n: number) {
  const next = Math.max(0, Math.floor(n));
  store().__gsaBubbleClicks = next;
  return next;
}

export function incrementBubbleClicks(delta = 1): number {
  const g = store();
  const next = Math.max(0, (g.__gsaBubbleClicks ?? 0) + Math.floor(delta));
  g.__gsaBubbleClicks = next;
  return next;
}

export function clearBubbleClicks() {
  store().__gsaBubbleClicks = 0;
}
