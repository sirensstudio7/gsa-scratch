"use client";

import { useCallback, useEffect, useRef } from "react";

type WallRevealAssetProps = {
  colorSrc: string;
  whiteSrc: string;
  alt: string;
  /** 0 = fully white, 1 = fully color (wiped from bottom) */
  progress: number;
};

type Rect = { x: number; y: number; w: number; h: number };

/**
 * Color underneath. White on top.
 * Bottom wipe reveals color as submits / staff target rises.
 */
export function WallRevealAsset({
  colorSrc,
  whiteSrc,
  alt,
  progress,
}: WallRevealAssetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgsRef = useRef<{
    color: HTMLImageElement;
    white: HTMLImageElement;
    whiteBox: Rect;
    colorBox: Rect;
  } | null>(null);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const paint = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const loaded = imgsRef.current;
    if (!container || !canvas || !loaded) return;

    const rect = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const { color, white, whiteBox, colorBox } = loaded;
    const sharedDest = containFit(whiteBox.w, whiteBox.h, width, height, 1);
    const p = Math.max(0, Math.min(1, progressRef.current));

    // Stretch color into the exact white frame, then lock silhouette
    drawColorLayer(ctx, color, colorBox, sharedDest);
    ctx.globalCompositeOperation = "destination-in";
    drawMaskLayer(ctx, white, whiteBox, sharedDest);
    ctx.globalCompositeOperation = "source-over";

    // White covers remaining top of the asset frame (wipe up from bottom)
    if (p < 0.999) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(
        sharedDest.x,
        sharedDest.y,
        sharedDest.w,
        sharedDest.h * (1 - p),
      );
      ctx.clip();
      drawMaskLayer(ctx, white, whiteBox, sharedDest);
      ctx.restore();
    }
  }, []);

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
          whiteBox: contentBounds(white),
          colorBox: contentBounds(color, { knockOutBlack: true }),
        };
        paint();
      } catch (err) {
        console.error("WallRevealAsset setup failed", err);
      }
    }

    void setup();
    const onResize = () => paint();
    window.addEventListener("resize", onResize);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
    };
  }, [colorSrc, whiteSrc, paint]);

  useEffect(() => {
    paint();
  }, [progress, paint]);

  return (
    <div
      ref={containerRef}
      className="wall-scratch-item relative"
      aria-label={alt}
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full drop-shadow-lg"
        aria-hidden
      />
    </div>
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
  octx.drawImage(img, src.x, src.y, src.w, src.h, 0, 0, off.width, off.height);
  const imageData = octx.getImageData(0, 0, off.width, off.height);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
    if (lum < 28) d[i + 3] = 0;
  }
  octx.putImageData(imageData, 0, 0);
  ctx.drawImage(off, dest.x, dest.y);
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
