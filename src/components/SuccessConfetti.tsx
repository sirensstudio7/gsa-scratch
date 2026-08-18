"use client";

import { useEffect, useRef } from "react";

const NUM_CONFETTI = 350;
const COLORS: [number, number, number][] = [
  [85, 71, 106],
  [174, 61, 99],
  [219, 56, 83],
  [244, 92, 68],
  [248, 182, 70],
];
const PI_2 = Math.PI * 2;

function range(a: number, b: number) {
  return (b - a) * Math.random() + a;
}

type Particle = {
  style: [number, number, number];
  rgb: string;
  r: number;
  r2: number;
  opacity: number;
  dop: number;
  x: number;
  y: number;
  xmax: number;
  ymax: number;
  vx: number;
  vy: number;
};

/**
 * Full-viewport canvas confetti — particles spawn from the header/top and fall down.
 */
export function SuccessConfetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let w = 0;
    let h = 0;
    let xpos = 0.5;
    let raf = 0;
    let alive = true;

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };

    const drawCircle = (x: number, y: number, r: number, style: string) => {
      context.beginPath();
      context.arc(x, y, r, 0, PI_2, false);
      context.fillStyle = style;
      context.fill();
    };

    /** Always re-enter from the top (header area). */
    const replace = (p: Particle, initial = false) => {
      p.opacity = 0;
      p.dop = 0.03 * range(1, 4);
      p.x = range(-p.r2, w - p.r2);
      // First paint: stagger down a bit so the screen isn't empty.
      // After that: always fall from above the header.
      p.y = initial ? range(-80, h * 0.35) : range(-90, -10);
      p.xmax = w - p.r;
      p.ymax = h - p.r;
      p.vx = range(0, 2) + 8 * xpos - 5;
      p.vy = 0.9 * p.r + range(0.4, 2.2);
    };

    const makeParticle = (): Particle => {
      const style = COLORS[Math.floor(range(0, 5))]!;
      const r = Math.floor(range(2, 6));
      const p: Particle = {
        style,
        rgb: `rgba(${style[0]},${style[1]},${style[2]}`,
        r,
        r2: 2 * r,
        opacity: 0,
        dop: 0,
        x: 0,
        y: 0,
        xmax: 0,
        ymax: 0,
        vx: 0,
        vy: 0,
      };
      replace(p, true);
      return p;
    };

    const confetti = Array.from({ length: NUM_CONFETTI }, makeParticle);

    const drawParticle = (p: Particle) => {
      p.x += p.vx;
      p.y += p.vy;

      // Fade in, then stay visible until bottom
      if (p.opacity < 1) {
        p.opacity = Math.min(1, p.opacity + Math.abs(p.dop));
      }

      // Only recycle after reaching the bottom
      if (p.y > p.ymax) {
        replace(p, false);
      }

      if (!(p.x > 0 && p.x < p.xmax)) {
        p.x = ((p.x % p.xmax) + p.xmax) % p.xmax;
      }
      drawCircle(
        Math.floor(p.x),
        Math.floor(p.y),
        p.r,
        `${p.rgb},${p.opacity})`,
      );
    };

    const step = () => {
      if (!alive) return;
      raf = requestAnimationFrame(step);
      context.clearRect(0, 0, w, h);
      for (const c of confetti) drawParticle(c);
    };

    const onMove = (e: MouseEvent) => {
      if (w > 0) xpos = e.clientX / w;
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);
    raf = requestAnimationFrame(step);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[25] h-full w-full"
      aria-hidden
    />
  );
}
