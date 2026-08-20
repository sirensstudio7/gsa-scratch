"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

type ScratchCardProps = {
  /** Bottom layer — e.g. /assets/pencil-color.png */
  colorSrc: string;
  /** Top scratch layer — e.g. /assets/pencil-white.png */
  maskSrc: string;
  label: string;
  completed: boolean;
  onComplete: () => void;
  threshold?: number;
  className?: string;
  /** When false, student cannot scratch (form not filled yet) */
  enabled?: boolean;
};

type Rect = { x: number; y: number; w: number; h: number };
type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
};

/**
 * Layer stack (same on-screen size):
 * 1. colorSrc (bottom) — color art, black bg knocked out
 * 2. maskSrc / *-white.png (top, scratchable) — already has transparent bg + black outline
 */
export function ScratchCard({
  colorSrc,
  maskSrc,
  label,
  completed,
  onComplete,
  threshold = 0.7,
  className = "",
  enabled = true,
}: ScratchCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const colorRef = useRef<HTMLCanvasElement>(null);
  const scratchRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const sampleTick = useRef(0);
  const completedRef = useRef(completed);
  const baselineOpaque = useRef(0);
  const sparksRef = useRef<Spark[]>([]);
  const fxRaf = useRef(0);
  const brushElRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    completedRef.current = completed;
  }, [completed]);

  const setup = useCallback(async () => {
    const container = containerRef.current;
    const colorCanvas = colorRef.current;
    const scratchCanvas = scratchRef.current;
    const fxCanvas = fxRef.current;
    if (!container || !colorCanvas || !scratchCanvas) return;

    const rect = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));

    for (const canvas of [colorCanvas, scratchCanvas, fxCanvas]) {
      if (!canvas) continue;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const readOften = canvas !== fxCanvas;
      const c = canvas.getContext("2d", {
        willReadFrequently: readOften,
      });
      if (c) c.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const colorCtx = colorCanvas.getContext("2d", { willReadFrequently: true });
    const scratchCtx = scratchCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    if (!colorCtx || !scratchCtx) return;

    try {
      const [colorImg, whiteImg] = await Promise.all([
        loadImage(colorSrc),
        loadImage(maskSrc),
      ]);

      // White mask is the master frame — both layers share this centered dest
      const whiteBox = contentBounds(whiteImg);
      const colorBox = contentBounds(colorImg, { knockOutBlack: true });
      const sharedDest = containFit(whiteBox.w, whiteBox.h, width, height, 1);

      colorCtx.clearRect(0, 0, width, height);
      // Stretch color into the white frame, then clip so nothing peeks past outline
      drawColorLayer(colorCtx, colorImg, colorBox, sharedDest);
      colorCtx.globalCompositeOperation = "destination-in";
      drawMaskLayer(colorCtx, whiteImg, whiteBox, sharedDest);
      colorCtx.globalCompositeOperation = "source-over";

      scratchCtx.clearRect(0, 0, width, height);
      scratchCtx.globalCompositeOperation = "source-over";

      if (completedRef.current) {
        baselineOpaque.current = 0;
        setReady(true);
        return;
      }

      // White assets already have transparent bg + black outline — draw as-is
      drawMaskLayer(scratchCtx, whiteImg, whiteBox, sharedDest);
      baselineOpaque.current = sampleOpaque(scratchCanvas);
      setReady(true);
    } catch (err) {
      console.error("ScratchCard setup failed", err);
      setReady(false);
    }
  }, [colorSrc, maskSrc]);

  useEffect(() => {
    void setup();
    const onResize = () => void setup();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [setup, completed]);

  useEffect(() => {
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(48, now - last);
      last = now;
      const canvas = fxRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        const bounds = canvas.getBoundingClientRect();
        ctx.clearRect(0, 0, bounds.width, bounds.height);
        const sparks = sparksRef.current;
        for (let i = sparks.length - 1; i >= 0; i -= 1) {
          const s = sparks[i]!;
          s.life -= dt;
          s.x += s.vx * (dt / 1000);
          s.y += s.vy * (dt / 1000);
          s.vy += 180 * (dt / 1000);
          if (s.life <= 0) {
            sparks.splice(i, 1);
            continue;
          }
          const a = Math.max(0, s.life / s.max);
          ctx.globalAlpha = a;
          ctx.fillStyle = a > 0.5 ? "#fff8dc" : "#ffbf36";
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * (0.6 + a * 0.6), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      fxRaf.current = requestAnimationFrame(tick);
    };
    fxRaf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(fxRaf.current);
  }, []);

  const stampBrush = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    angle: number,
  ) => {
    ctx.beginPath();
    ctx.ellipse(x, y, radius * 1.12, radius * 0.62, angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.7, 0, Math.PI * 2);
    ctx.fill();

    const px = Math.cos(angle + Math.PI / 2);
    const py = Math.sin(angle + Math.PI / 2);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    for (let i = 0; i < 9; i += 1) {
      const across = (i / 8 - 0.5) * radius * 2.15;
      const along = ((i % 3) - 1) * radius * 0.32;
      const r = radius * (0.16 + (i % 5) * 0.055);
      ctx.beginPath();
      ctx.arc(
        x + px * across + dx * along,
        y + py * across + dy * along,
        r,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  };

  const moveBrush = (x: number, y: number, cardWidth: number) => {
    const el = brushElRef.current;
    if (!el) return;
    const size = Math.max(28, cardWidth * 0.096);
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    el.style.opacity = "1";
  };

  const hideBrush = () => {
    const el = brushElRef.current;
    if (!el) return;
    el.style.opacity = "0";
  };

  const spawnSparks = (x: number, y: number, radius: number) => {
    const list = sparksRef.current;
    for (let i = 0; i < 5; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 90;
      list.push({
        x: x + (Math.random() - 0.5) * radius,
        y: y + (Math.random() - 0.5) * radius,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 30,
        life: 180 + Math.random() * 160,
        max: 280,
        r: 1.2 + Math.random() * 2.2,
      });
    }
    if (list.length > 80) list.splice(0, list.length - 80);
  };

  const eraseAt = (clientX: number, clientY: number) => {
    const canvas = scratchRef.current;
    if (!canvas || completedRef.current) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const bounds = canvas.getBoundingClientRect();
    const x = clientX - bounds.left;
    const y = clientY - bounds.top;
    const radius = Math.max(14, bounds.width * 0.048);
    moveBrush(x, y, bounds.width);

    const steps: { x: number; y: number }[] = [];
    const prev = lastPoint.current;
    if (prev) {
      const dist = Math.hypot(x - prev.x, y - prev.y);
      const n = Math.max(1, Math.ceil(dist / (radius * 0.45)));
      for (let i = 1; i <= n; i += 1) {
        const t = i / n;
        steps.push({
          x: prev.x + (x - prev.x) * t,
          y: prev.y + (y - prev.y) * t,
        });
      }
    } else {
      steps.push({ x, y });
    }

    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(0,0,0,1)";
    ctx.fillStyle = "rgba(0,0,0,1)";
    if (prev) {
      ctx.lineWidth = radius * 1.15;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    for (const p of steps) {
      const angle = prev
        ? Math.atan2(p.y - prev.y, p.x - prev.x)
        : 0;
      stampBrush(ctx, p.x, p.y, radius, angle);
    }
    ctx.restore();

    spawnSparks(x, y, radius);
    lastPoint.current = { x, y };
    sampleTick.current += 1;
    if (sampleTick.current % 4 === 0) checkComplete();
  };

  const checkComplete = () => {
    const canvas = scratchRef.current;
    if (!canvas || completedRef.current || baselineOpaque.current <= 0) return;

    const remaining = sampleOpaque(canvas);
    const progress = 1 - remaining / baselineOpaque.current;

    if (progress >= threshold) {
      completedRef.current = true;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }
      sparksRef.current = [];
      hideBrush();
      onComplete();
    }
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!enabled) return;
    e.preventDefault();
    drawing.current = true;
    lastPoint.current = null;
    e.currentTarget.setPointerCapture(e.pointerId);
    eraseAt(e.clientX, e.clientY);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!enabled) return;
    e.preventDefault();
    const bounds = e.currentTarget.getBoundingClientRect();
    moveBrush(e.clientX - bounds.left, e.clientY - bounds.top, bounds.width);
    if (drawing.current) eraseAt(e.clientX, e.clientY);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!enabled) return;
    if (drawing.current) {
      drawing.current = false;
      lastPoint.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      checkComplete();
    }
  };

  const onPointerLeave = () => {
    if (!drawing.current) hideBrush();
  };

  return (
    <div
      ref={containerRef}
      className={`relative aspect-square w-full select-none ${className}${
        !enabled && !completed ? " scratch-locked" : ""
      }`}
      aria-label={
        enabled
          ? `${label} — scratch white layer to reveal color`
          : `${label} — isi nama dan gender dulu`
      }
    >
      <canvas
        ref={colorRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden
      />
      {!completed && (
        <canvas
          ref={scratchRef}
          className={`absolute inset-0 h-full w-full touch-none ${
            ready ? "opacity-100" : "opacity-0"
          }`}
          style={{
            touchAction: "none",
            cursor: enabled ? "none" : "not-allowed",
            pointerEvents: enabled ? "auto" : "none",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerLeave}
        />
      )}
      <canvas
        ref={fxRef}
        className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
        aria-hidden
      />
      {enabled && !completed && (
        <div ref={brushElRef} className="scratch-brush" aria-hidden />
      )}
      {!enabled && !completed && (
        <div className="scratch-lock-overlay" aria-hidden>
          <span className="scratch-lock-icon">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect
                x="3"
                y="7"
                width="10"
                height="7"
                rx="1.5"
                fill="#5f6368"
              />
              <path
                d="M5 7V5.2a3 3 0 0 1 6 0V7"
                stroke="#5f6368"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </div>
      )}
      {completed && (
        <div className="pointer-events-none absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#34a853] text-xs font-bold text-white shadow">
          ✓
        </div>
      )}
    </div>
  );
}

function sampleOpaque(canvas: HTMLCanvasElement) {
  const w = 96;
  const h = 96;
  const tmp = document.createElement("canvas");
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext("2d");
  if (!tctx) return 0;
  tctx.drawImage(canvas, 0, 0, w, h);
  const data = tctx.getImageData(0, 0, w, h).data;
  let opaque = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] <= 40) continue;
    const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
    if (lum > 40) opaque += 1;
  }
  return opaque;
}

/** Bounding box of opaque pixels (optionally ignoring solid black bg). */
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

/** Color layer: knock out solid black background only. */
function drawColorLayer(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  src: Rect,
  dest: Rect,
) {
  const off = document.createElement("canvas");
  off.width = Math.max(1, Math.floor(dest.w));
  off.height = Math.max(1, Math.floor(dest.h));
  const octx = off.getContext("2d");
  if (!octx) return;

  octx.drawImage(
    img,
    src.x,
    src.y,
    src.w,
    src.h,
    0,
    0,
    off.width,
    off.height,
  );

  const imageData = octx.getImageData(0, 0, off.width, off.height);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
    if (lum < 28) d[i + 3] = 0;
  }
  octx.putImageData(imageData, 0, 0);
  ctx.drawImage(off, dest.x, dest.y);
}

/** White mask layer: keep transparency + black outline from source PNG. */
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

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
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
