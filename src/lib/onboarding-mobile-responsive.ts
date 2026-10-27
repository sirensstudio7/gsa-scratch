import type { OnboardingIconLayout } from "@/lib/onboarding-layout";

/** Clear pixels between bubble edges. */
const CLEAR_GAP_PX = 6;
const CTA_PAD_PX = 8;
const EDGE_PAD_PX = 2;
const TARGET_BUBBLE_PX = 92;
const MIN_BUBBLE_PX = 48;

/** Matches the mobile CTA width in CSS: min(56% of the field, 220px), art is 1024×576. */
const CTA_WIDTH_RATIO = 0.56;
const CTA_MAX_PX = 220;
const CTA_ASPECT = 576 / 1024;

type Rng = () => number;
type Box = { x0: number; y0: number; x1: number; y1: number };

function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bump this to reshuffle the mobile scatter without touching desktop. */
const SCATTER_SALT = 0x6e3a91c5;

function layoutSeed(icons: OnboardingIconLayout[], fieldW: number, fieldH: number) {
  let hash = (SCATTER_SALT ^ (Math.round(fieldW / 48) * 1000 + Math.round(fieldH / 48))) >>> 0;
  for (const icon of icons) {
    for (let i = 0; i < icon.id.length; i += 1) {
      hash = Math.imul(hash ^ icon.id.charCodeAt(i), 16777619);
    }
  }
  return hash >>> 0;
}

function ctaBox(fieldW: number, fieldH: number): Box {
  const ctaW = Math.min(fieldW * CTA_WIDTH_RATIO, CTA_MAX_PX);
  const ctaH = ctaW * CTA_ASPECT;
  return {
    x0: (fieldW - ctaW) / 2 - CTA_PAD_PX,
    y0: fieldH / 2 - ctaH / 2 - CTA_PAD_PX,
    x1: (fieldW + ctaW) / 2 + CTA_PAD_PX,
    y1: fieldH / 2 + ctaH / 2 + CTA_PAD_PX,
  };
}

function hitsCta(x: number, y: number, radius: number, cta: Box) {
  const nearestX = Math.min(cta.x1, Math.max(cta.x0, x));
  const nearestY = Math.min(cta.y1, Math.max(cta.y0, y));
  const dx = x - nearestX;
  const dy = y - nearestY;
  return dx * dx + dy * dy < radius * radius;
}

function inField(x: number, y: number, radius: number, fieldW: number, fieldH: number) {
  return (
    x - radius >= EDGE_PAD_PX &&
    y - radius >= EDGE_PAD_PX &&
    x + radius <= fieldW - EDGE_PAD_PX &&
    y + radius <= fieldH - EDGE_PAD_PX
  );
}

function pushOutOfCta(
  x: number,
  y: number,
  radius: number,
  cta: Box,
  fieldW: number,
  fieldH: number,
) {
  if (!hitsCta(x, y, radius, cta)) return [x, y] as [number, number];
  const exits: [number, number][] = [
    [x, cta.y0 - radius],
    [x, cta.y1 + radius],
    [cta.x0 - radius, y],
    [cta.x1 + radius, y],
  ];
  let best = exits[0]!;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const exit of exits) {
    if (!inField(exit[0], exit[1], radius, fieldW, fieldH)) continue;
    if (hitsCta(exit[0], exit[1], radius, cta)) continue;
    const dx = exit[0] - x;
    const dy = exit[1] - y;
    const score = dx * dx + dy * dy;
    if (score < bestScore) {
      best = exit;
      bestScore = score;
    }
  }
  if (bestScore < Number.POSITIVE_INFINITY) return best;
  const above = y < (cta.y0 + cta.y1) / 2;
  return [x, above ? cta.y0 - radius : cta.y1 + radius] as [number, number];
}

function clampPoint(
  x: number,
  y: number,
  radius: number,
  cta: Box,
  fieldW: number,
  fieldH: number,
) {
  let nx = Math.min(fieldW - EDGE_PAD_PX - radius, Math.max(EDGE_PAD_PX + radius, x));
  let ny = Math.min(fieldH - EDGE_PAD_PX - radius, Math.max(EDGE_PAD_PX + radius, y));
  [nx, ny] = pushOutOfCta(nx, ny, radius, cta, fieldW, fieldH);
  nx = Math.min(fieldW - EDGE_PAD_PX - radius, Math.max(EDGE_PAD_PX + radius, nx));
  ny = Math.min(fieldH - EDGE_PAD_PX - radius, Math.max(EDGE_PAD_PX + radius, ny));
  if (hitsCta(nx, ny, radius, cta)) {
    [nx, ny] = pushOutOfCta(nx, ny, radius, cta, fieldW, fieldH);
  }
  return [nx, ny] as [number, number];
}

function worstEdge(pts: [number, number][], size: number) {
  let worst = Number.POSITIVE_INFINITY;
  const need = size + CLEAR_GAP_PX;
  for (let i = 0; i < pts.length; i += 1) {
    for (let j = i + 1; j < pts.length; j += 1) {
      const dx = pts[i]![0] - pts[j]![0];
      const dy = pts[i]![1] - pts[j]![1];
      worst = Math.min(worst, Math.hypot(dx, dy) - need);
    }
  }
  return worst;
}

function tooClose(x: number, y: number, pts: [number, number][], need: number) {
  for (let i = 0; i < pts.length; i += 1) {
    const dx = x - pts[i]![0];
    const dy = y - pts[i]![1];
    if (dx * dx + dy * dy < need * need) return true;
  }
  return false;
}

/** Drop bubbles on random spots. Only separate pairs that actually overlap. */
function scatter(
  count: number,
  size: number,
  fieldW: number,
  fieldH: number,
  rand: Rng,
) {
  const cta = ctaBox(fieldW, fieldH);
  const radius = size / 2;
  const need = size + CLEAR_GAP_PX;
  const pts: [number, number][] = [];
  const spanX = Math.max(8, fieldW - (EDGE_PAD_PX + radius) * 2);
  const spanY = Math.max(8, fieldH - (EDGE_PAD_PX + radius) * 2);

  for (let i = 0; i < count; i += 1) {
    let chosen: [number, number] | null = null;
    for (let attempt = 0; attempt < 160; attempt += 1) {
      const x = EDGE_PAD_PX + radius + rand() * spanX;
      const y = EDGE_PAD_PX + radius + rand() * spanY;
      if (hitsCta(x, y, radius + 2, cta)) continue;
      if (tooClose(x, y, pts, need)) continue;
      chosen = [x, y];
      break;
    }
    pts.push(
      chosen ??
        clampPoint(
          EDGE_PAD_PX + radius + rand() * spanX,
          EDGE_PAD_PX + radius + rand() * spanY,
          radius,
          cta,
          fieldW,
          fieldH,
        ),
    );
  }

  for (let pass = 0; pass < 12; pass += 1) {
    for (let i = 0; i < pts.length; i += 1) {
      for (let j = i + 1; j < pts.length; j += 1) {
        const dx = pts[i]![0] - pts[j]![0];
        const dy = pts[i]![1] - pts[j]![1];
        const dist = Math.hypot(dx, dy) || 0.01;
        if (dist >= need) continue;
        const push = ((need - dist) / dist) * 0.45;
        pts[i]![0] += dx * push;
        pts[i]![1] += dy * push;
        pts[j]![0] -= dx * push;
        pts[j]![1] -= dy * push;
      }
    }
    for (let i = 0; i < pts.length; i += 1) {
      pts[i] = clampPoint(pts[i]![0], pts[i]![1], radius, cta, fieldW, fieldH);
    }
  }

  return pts;
}

/** Mobile-only: larger bubbles in a stable random scatter, with a clear gap. */
export function fitMobileBubbleLayout(
  icons: OnboardingIconLayout[],
  fieldW: number,
  fieldH: number,
): OnboardingIconLayout[] {
  if (fieldW <= 0 || fieldH <= 0 || icons.length === 0) return icons;

  const seed = layoutSeed(icons, fieldW, fieldH);
  let size = TARGET_BUBBLE_PX;
  let pts = scatter(icons.length, size, fieldW, fieldH, mulberry32(seed));
  let edge = worstEdge(pts, size);

  for (let attempt = 0; attempt < 16 && edge < -0.5; attempt += 1) {
    size = Math.max(MIN_BUBBLE_PX, size * 0.94);
    pts = scatter(icons.length, size, fieldW, fieldH, mulberry32(seed + attempt + 1));
    edge = worstEdge(pts, size);
    if (size <= MIN_BUBBLE_PX) break;
  }

  const frac = size / fieldW;
  return icons.map((icon, index) => {
    const [x, y] = pts[index] ?? [
      icon.bubble[0] * fieldW,
      icon.bubble[1] * fieldH,
    ];
    return {
      ...icon,
      size: Math.round(frac * 10000) / 10000,
      bubble: [
        Math.round((x / fieldW) * 10000) / 10000,
        Math.round((y / fieldH) * 10000) / 10000,
      ],
      unwrap: [
        Math.round((x / fieldW) * 10000) / 10000,
        Math.round((y / fieldH) * 10000) / 10000,
      ],
    };
  });
}
