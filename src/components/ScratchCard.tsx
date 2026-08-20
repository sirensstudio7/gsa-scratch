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
type Point = { x: number; y: number };

const BRUSH_SRC = "/assets/scratch-brush.png";
/** Demo canvas was 300px; brush offset in that demo is 25px. */
const DEMO_SIZE = 300;
const DEMO_OFFSET = 25;

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
  const drawing = useRef(false);
  const lastPoint = useRef<Point | null>(null);
  const sampleTick = useRef(0);
  const completedRef = useRef(completed);
  const baselineOpaque = useRef(0);
  const stampRef = useRef<HTMLImageElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    completedRef.current = completed;
  }, [completed]);

  const setup = useCallback(async () => {
    const container = containerRef.current;
    const colorCanvas = colorRef.current;
    const scratchCanvas = scratchRef.current;
    if (!container || !colorCanvas || !scratchCanvas) return;

    const rect = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));

    for (const canvas of [colorCanvas, scratchCanvas]) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const c = canvas.getContext("2d", { willReadFrequently: true });
      if (c) c.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const colorCtx = colorCanvas.getContext("2d", { willReadFrequently: true });
    const scratchCtx = scratchCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    if (!colorCtx || !scratchCtx) return;

    try {
      const [colorImg, whiteImg, brushImg] = await Promise.all([
        loadImage(colorSrc),
        loadImage(maskSrc),
        loadImage(BRUSH_SRC),
      ]);
      stampRef.current = brushImg;

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

  const eraseAt = (clientX: number, clientY: number) => {
    const canvas = scratchRef.current;
    const brush = stampRef.current;
    if (!canvas || !brush || completedRef.current) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const bounds = canvas.getBoundingClientRect();
    const current: Point = {
      x: clientX - bounds.left,
      y: clientY - bounds.top,
    };
    const scale = bounds.width / DEMO_SIZE;
    const bw = brush.naturalWidth * scale;
    const bh = brush.naturalHeight * scale;
    const ox = DEMO_OFFSET * scale;
    const oy = DEMO_OFFSET * scale;

    ctx.globalCompositeOperation = "destination-out";
    const prev = lastPoint.current;
    if (!prev) {
      ctx.drawImage(brush, current.x - ox, current.y - oy, bw, bh);
      lastPoint.current = current;
      return;
    }

    const dist = Math.hypot(current.x - prev.x, current.y - prev.y);
    const angle = Math.atan2(current.x - prev.x, current.y - prev.y);
    for (let i = 0; i < dist; i += 1) {
      const x = prev.x + Math.sin(angle) * i - ox;
      const y = prev.y + Math.cos(angle) * i - oy;
      ctx.drawImage(brush, x, y, bw, bh);
    }
    lastPoint.current = current;
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
    if (!enabled || !drawing.current) return;
    e.preventDefault();
    eraseAt(e.clientX, e.clientY);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!enabled || !drawing.current) return;
    drawing.current = false;
    lastPoint.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    checkComplete();
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
            cursor: enabled ? "crosshair" : "not-allowed",
            pointerEvents: enabled ? "auto" : "none",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
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
