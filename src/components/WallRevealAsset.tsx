"use client";

import { useCallback, useEffect, useRef } from "react";

type FocusRect = { x: number; y: number; w: number; h: number };

type WallRevealAssetProps = {
  colorSrc: string;
  whiteSrc: string;
  alt: string;
  /** 0 = fully white, 1 = fully color */
  progress: number;
  className?: string;
  /** Keep dark pixels (hero art). Default knocks out black bg from scratch objects. */
  knockOutBlack?: boolean;
  /** Normalized box (0–1 of the fitted image) where the scribble runs. */
  scratchFocus?: FocusRect;
  /** Place the cover image in this box (0–1 of the container). */
  coverPlacement?: FocusRect;
};

type Rect = { x: number; y: number; w: number; h: number };
type Point = { x: number; y: number };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number };
type Job = { points: Point[]; index: number; toProgress: number };

/**
 * Color underneath. White on top.
 * When progress rises, a visible scribble scratch (lottery-ticket style)
 * carves color through, with sparks at the tip.
 */
export function WallRevealAsset({
  colorSrc,
  whiteSrc,
  alt,
  progress,
  className = "",
  knockOutBlack = true,
  scratchFocus,
  coverPlacement,
}: WallRevealAssetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scratchRef = useRef<HTMLCanvasElement | null>(null);
  const coverRef = useRef<HTMLCanvasElement | null>(null);
  const colorLayerRef = useRef<HTMLCanvasElement | null>(null);
  const imgsRef = useRef<{
    color: HTMLImageElement;
    white: HTMLImageElement;
    whiteBox: Rect;
    colorBox: Rect;
  } | null>(null);
  const targetProgressRef = useRef(progress);
  const appliedProgressRef = useRef(0);
  const destRef = useRef<Rect | null>(null);
  const rafRef = useRef(0);
  const seededRef = useRef(false);
  const jobRef = useRef<Job | null>(null);
  const lastTipRef = useRef<Point | null>(null);
  const sparksRef = useRef<Spark[]>([]);
  const lastTsRef = useRef(0);
  const delayUntilRef = useRef(0);
  const staggerMs = hashDelay(alt);
  const scratchingRef = useRef(false);

  targetProgressRef.current = Math.max(0, Math.min(1, progress));

  const ensureScratch = (w: number, h: number) => {
    let scratch = scratchRef.current;
    if (!scratch) {
      scratch = document.createElement("canvas");
      scratchRef.current = scratch;
    }
    if (scratch.width !== w || scratch.height !== h) {
      scratch.width = w;
      scratch.height = h;
      const sctx = scratch.getContext("2d");
      if (sctx) {
        sctx.clearRect(0, 0, w, h);
        sctx.fillStyle = "#fff";
        sctx.fillRect(0, 0, w, h);
        appliedProgressRef.current = 0;
        seededRef.current = false;
        jobRef.current = null;
        lastTipRef.current = null;
      }
    }
    return scratch;
  };

  const carveAlong = (
    sctx: CanvasRenderingContext2D,
    from: Point,
    to: Point,
    brush: number,
  ) => {
    sctx.save();
    sctx.globalCompositeOperation = "destination-out";
    sctx.lineCap = "round";
    sctx.lineJoin = "round";
    sctx.strokeStyle = "rgba(0,0,0,1)";
    sctx.lineWidth = brush;
    sctx.beginPath();
    sctx.moveTo(from.x, from.y);
    sctx.lineTo(to.x, to.y);
    sctx.stroke();
    sctx.restore();
  };

  const seedBand = (
    sctx: CanvasRenderingContext2D,
    dest: Rect,
    fromP: number,
    toP: number,
  ) => {
    const path = makeScribble(dest, fromP, toP, alt);
    if (path.length < 2) return;
    for (let i = 1; i < path.length; i += 1) {
      carveAlong(sctx, path[i - 1]!, path[i]!, dest.w * 0.085);
    }
  };

  const paint = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const loaded = imgsRef.current;
    if (!container || !canvas || !loaded) return;

    const rect = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));

    const pxW = Math.floor(width * dpr);
    const pxH = Math.floor(height * dpr);
    if (canvas.width !== pxW || canvas.height !== pxH) {
      canvas.width = pxW;
      canvas.height = pxH;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, width, height);

    const { white, whiteBox } = loaded;
    const coverDest = coverPlacement
      ? {
          x: width * coverPlacement.x,
          y: height * coverPlacement.y,
          w: width * coverPlacement.w,
          h: height * coverPlacement.h,
        }
      : containFit(whiteBox.w, whiteBox.h, width, height, 1);
    destRef.current = focusDest(coverDest, scratchFocus);

    const scratch = ensureScratch(width, height);
    const sctx = scratch.getContext("2d", { alpha: true });
    if (!sctx) return;

    if (!seededRef.current) {
      const seedTo = targetProgressRef.current;
      if (seedTo > 0.001) seedBand(sctx, destRef.current, 0, seedTo);
      appliedProgressRef.current = seedTo;
      seededRef.current = true;
    }

    if (appliedProgressRef.current < 0.999 || jobRef.current) {
      let cover = coverRef.current;
      if (!cover) {
        cover = document.createElement("canvas");
        coverRef.current = cover;
      }
      if (cover.width !== pxW || cover.height !== pxH) {
        cover.width = pxW;
        cover.height = pxH;
      }
      const cctx = cover.getContext("2d", { alpha: true });
      if (cctx) {
        cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cctx.imageSmoothingEnabled = true;
        cctx.imageSmoothingQuality = "high";
        cctx.clearRect(0, 0, width, height);
        drawMaskLayer(cctx, white, whiteBox, coverDest);
        cctx.globalCompositeOperation = "destination-in";
        cctx.drawImage(scratch, 0, 0, width, height);
        cctx.globalCompositeOperation = "source-over";
        ctx.drawImage(cover, 0, 0, width, height);
      }
    }

    const tip = lastTipRef.current;
    if (tip && scratchingRef.current) {
      const g = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 14);
      g.addColorStop(0, "rgba(255,255,255,0.9)");
      g.addColorStop(0.35, "rgba(255,215,80,0.5)");
      g.addColorStop(1, "rgba(255,191,54,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 14, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const spark of sparksRef.current) {
      const a = Math.max(0, spark.life / spark.max);
      ctx.globalAlpha = a;
      ctx.fillStyle = a > 0.45 ? "#fff8dc" : "#ffbf36";
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, spark.r * a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, [alt, scratchFocus, coverPlacement]);

  useEffect(() => {
    const tick = (now: number) => {
      rafRef.current = requestAnimationFrame(tick);
      const dest = destRef.current;
      const scratch = scratchRef.current;
      if (!dest || !scratch || !seededRef.current) return;
      const sctx = scratch.getContext("2d");
      if (!sctx) return;

      const dt = lastTsRef.current ? Math.min(32, now - lastTsRef.current) : 16;
      lastTsRef.current = now;

      const target = targetProgressRef.current;
      let applied = appliedProgressRef.current;
      let dirty = false;

      if (target < applied - 0.001) {
        sctx.globalCompositeOperation = "source-over";
        sctx.fillStyle = "#fff";
        sctx.fillRect(0, 0, scratch.width, scratch.height);
        applied = 0;
        appliedProgressRef.current = 0;
        jobRef.current = null;
        lastTipRef.current = null;
        sparksRef.current = [];
        colorLayerRef.current = null;
        if (target > 0.001) {
          seedBand(sctx, dest, 0, target);
          appliedProgressRef.current = target;
        }
        dirty = true;
      } else if (!jobRef.current && target > applied + 0.0008) {
        if (delayUntilRef.current === 0) delayUntilRef.current = now + staggerMs;
        if (now >= delayUntilRef.current) {
          jobRef.current = {
            points: makeScribble(dest, applied, target, `${alt}-${applied.toFixed(3)}`),
            index: 1,
            toProgress: target,
          };
          lastTipRef.current = jobRef.current.points[0] ?? null;
          delayUntilRef.current = 0;
        }
      }

      const job = jobRef.current;
      if (job) {
        const steps = Math.max(1, Math.round(dt / 8));
        const brush = dest.w * (0.072 + Math.random() * 0.03);
        for (let s = 0; s < steps && job.index < job.points.length; s += 1) {
          const from = job.points[job.index - 1]!;
          const to = job.points[job.index]!;
          carveAlong(sctx, from, to, brush);
          lastTipRef.current = to;
          spawnSparks(sparksRef.current, to);
          job.index += 1;
        }
        appliedProgressRef.current =
          applied +
          (job.toProgress - applied) *
            Math.min(1, job.index / Math.max(2, job.points.length));
        dirty = true;
        if (job.index >= job.points.length) {
          appliedProgressRef.current = job.toProgress;
          jobRef.current = null;
          lastTipRef.current = null;
        }
      }

      const sparks = sparksRef.current;
      if (sparks.length) {
        for (let i = sparks.length - 1; i >= 0; i -= 1) {
          const sp = sparks[i]!;
          sp.life -= dt;
          sp.x += sp.vx * (dt / 16);
          sp.y += sp.vy * (dt / 16);
          sp.vy += 0.12;
          if (sp.life <= 0) sparks.splice(i, 1);
        }
        dirty = true;
      }

      const active = Boolean(jobRef.current);
      scratchingRef.current = active;

      if (dirty || active || sparks.length) paint();
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [alt, paint, staggerMs]);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      try {
        const [color, white] = await Promise.all([
          loadImage(colorSrc),
          loadImage(whiteSrc),
        ]);
        if (cancelled) return;
        imgsRef.current = {
          color,
          white,
          whiteBox: knockOutBlack
            ? contentBounds(white)
            : {
                x: 0,
                y: 0,
                w: white.naturalWidth || white.width,
                h: white.naturalHeight || white.height,
              },
          colorBox: knockOutBlack
            ? contentBounds(color, { knockOutBlack: true })
            : {
                x: 0,
                y: 0,
                w: color.naturalWidth || color.width,
                h: color.naturalHeight || color.height,
              },
        };
        seededRef.current = false;
        colorLayerRef.current = null;
        paint();
      } catch (err) {
        console.error("WallRevealAsset setup failed", err);
      }
    }

    void setup();
    const onResize = () => {
      seededRef.current = false;
      colorLayerRef.current = null;
      paint();
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
    };
  }, [colorSrc, whiteSrc, knockOutBlack, paint]);

  useEffect(() => {
    paint();
  }, [progress, paint]);

  return (
    <div
      ref={containerRef}
      className={`wall-scratch-item relative ${className}`.trim()}
      aria-label={alt}
    >
      <img
        src={colorSrc}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full object-contain drop-shadow-lg"
        aria-hidden
      />
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full bg-transparent"
        aria-hidden
      />
    </div>
  );
}

function hashDelay(key: string) {
  let n = 0;
  for (let i = 0; i < key.length; i += 1) n = (n + key.charCodeAt(i) * (i + 3)) % 220;
  return n;
}

function makeScribble(dest: Rect, fromP: number, toP: number, seedKey: string) {
  const points: Point[] = [];
  const yBot = dest.y + dest.h * (1 - fromP);
  const yTop = dest.y + dest.h * (1 - toP);
  const band = Math.max(18, yBot - yTop);
  const rows = Math.max(3, Math.round(band / 11));
  let seed = 1;
  for (let i = 0; i < seedKey.length; i += 1) seed = (seed * 31 + seedKey.charCodeAt(i)) >>> 0;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let r = 0; r < rows; r += 1) {
    const t = r / Math.max(1, rows - 1);
    const y = yBot - t * band + (rnd() - 0.5) * 7;
    const pad = dest.w * 0.04;
    const left = dest.x + pad + rnd() * dest.w * 0.08;
    const right = dest.x + dest.w - pad - rnd() * dest.w * 0.08;
    const goRight = r % 2 === 0;
    const start = goRight ? left : right;
    const end = goRight ? right : left;
    const segs = 5 + Math.floor(rnd() * 4);
    for (let s = 0; s <= segs; s += 1) {
      const u = s / segs;
      points.push({
        x: start + (end - start) * u,
        y: y + Math.sin(u * Math.PI * 2.2) * 6 + (rnd() - 0.5) * 5,
      });
    }
  }
  return points;
}

function spawnSparks(list: Spark[], at: Point) {
  const n = 10 + ((Math.random() * 8) | 0);
  for (let i = 0; i < n; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const sp = 0.7 + Math.random() * 3.2;
    const life = 220 + Math.random() * 220;
    list.push({
      x: at.x + (Math.random() - 0.5) * 6,
      y: at.y + (Math.random() - 0.5) * 6,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 1.4,
      life,
      max: life,
      r: 0.8 + Math.random() * 1.6,
    });
  }
  if (list.length > 220) list.splice(0, list.length - 220);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

function contentBounds(
  img: HTMLImageElement,
  opts: { knockOutBlack?: boolean } = {},
): Rect {
  const natW = img.naturalWidth || img.width;
  const natH = img.naturalHeight || img.height;
  const maxSide = 320;
  const scale = Math.min(1, maxSide / Math.max(natW, natH));
  const w = Math.max(1, Math.round(natW * scale));
  const h = Math.max(1, Math.round(natH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { x: 0, y: 0, w: natW, h: natH };
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  let found = false;

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (data[i + 3] <= 20) continue;
      if (opts.knockOutBlack) {
        const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
        if (lum < 28) continue;
      }
      found = true;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (!found) return { x: 0, y: 0, w: natW, h: natH };
  const inv = 1 / scale;
  return {
    x: Math.floor(minX * inv),
    y: Math.floor(minY * inv),
    w: Math.max(1, Math.ceil((maxX - minX + 1) * inv)),
    h: Math.max(1, Math.ceil((maxY - minY + 1) * inv)),
  };
}

function drawMaskLayer(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  src: Rect,
  dest: Rect,
) {
  ctx.drawImage(
    img,
    src.x,
    src.y,
    src.w,
    src.h,
    dest.x,
    dest.y,
    dest.w,
    dest.h,
  );
}

function containFit(
  iw: number,
  ih: number,
  cw: number,
  ch: number,
  scale = 1,
) {
  const s = Math.min(cw / iw, ch / ih) * scale;
  const w = iw * s;
  const h = ih * s;
  return { w, h, x: (cw - w) / 2, y: (ch - h) / 2 };
}

function focusDest(full: Rect, focus?: FocusRect): Rect {
  if (!focus) return full;
  return {
    x: full.x + full.w * focus.x,
    y: full.y + full.h * focus.y,
    w: full.w * focus.w,
    h: full.h * focus.h,
  };
}
