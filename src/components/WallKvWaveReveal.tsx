"use client";

import { useCallback, useEffect, useId, useRef, type CSSProperties } from "react";

type WallKvWaveRevealProps = {
  colorSrc: string;
  /** When omitted, color reveals over a separate outline layer (transparent where unfilled). */
  coverSrc?: string;
  alt: string;
  progress: number;
  className?: string;
  style?: CSSProperties;
};

type Rect = { x: number; y: number; w: number; h: number };

/** Bottom-up fill inside the art bounds (works with PNG/SVG; no CSS mask). */
export function WallKvWaveReveal({
  colorSrc,
  coverSrc,
  alt,
  progress,
  className = "",
  style,
}: WallKvWaveRevealProps) {
  const p = Math.max(0, Math.min(1, progress));
  const overlayOnOutline = !coverSrc;
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgsRef = useRef<{
    color: HTMLImageElement;
    cover: HTMLImageElement | null;
  } | null>(null);
  const labelId = useId();

  const paint = useCallback(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const loaded = imgsRef.current;
    if (!root || !canvas || !loaded) return;

    const rect = root.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || root.clientWidth));
    const height = Math.max(1, Math.round(rect.height || root.clientHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
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
    ctx.clearRect(0, 0, width, height);

    const fromDom = Number(root.dataset.progress);
    const progressNow = Math.max(
      0,
      Math.min(1, Number.isFinite(fromDom) ? fromDom : progress),
    );
    const { color, cover } = loaded;
    const dest = containFit(
      color.naturalWidth || color.width,
      color.naturalHeight || color.height,
      width,
      height,
    );

    const coverH = dest.h * (1 - progressNow);
    const drawFull = (img: HTMLImageElement, d: Rect) => {
      ctx.drawImage(
        img,
        0,
        0,
        img.naturalWidth || img.width,
        img.naturalHeight || img.height,
        d.x,
        d.y,
        d.w,
        d.h,
      );
    };

    if (overlayOnOutline) {
      if (progressNow <= 0.0005) return;
      drawFull(color, dest);
      if (progressNow >= 0.9995) return;
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "#000";
      ctx.fillRect(dest.x, dest.y, dest.w, coverH);
      ctx.restore();
      return;
    }

    if (!cover) return;

    if (progressNow <= 0.0005) {
      drawFull(cover, dest);
      return;
    }
    if (progressNow >= 0.9995) {
      drawFull(color, dest);
      return;
    }

    drawFull(color, dest);
    if (coverH > 0.5) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(dest.x, dest.y, dest.w, coverH);
      ctx.clip();
      drawFull(cover, dest);
      ctx.restore();
    }
  }, [progress, overlayOnOutline]);

  const paintRef = useRef(paint);
  paintRef.current = paint;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const color = await loadImage(colorSrc);
        const cover = coverSrc ? await loadImage(coverSrc) : null;
        if (cancelled) return;
        imgsRef.current = { color, cover };
        requestAnimationFrame(() => paintRef.current());
      } catch (err) {
        console.error("WallKvWaveReveal load failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [colorSrc, coverSrc]);

  useEffect(() => {
    paintRef.current();
  }, [progress, paint]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ro = new ResizeObserver(() => paintRef.current());
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={rootRef}
      data-progress={p}
      className={`wall-kv-wave-root ${className}`.trim()}
      style={style}
      role="img"
      aria-labelledby={labelId}
    >
      <span id={labelId} className="sr-only">
        {alt}
      </span>
      <canvas
        ref={canvasRef}
        className="wall-kv-wave-canvas"
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

function containFit(iw: number, ih: number, cw: number, ch: number): Rect {
  const s = Math.min(cw / iw, ch / ih);
  const w = iw * s;
  const h = ih * s;
  return { w, h, x: (cw - w) / 2, y: (ch - h) / 2 };
}
