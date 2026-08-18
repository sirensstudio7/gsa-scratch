"use client";

import { useEffect, useRef } from "react";

const COLORS = [
  "#ff0043",
  "#14fc56",
  "#1e7fff",
  "#e60aff",
  "#ffbf36",
  "#ea4335",
  "#fbbc05",
  "#34a853",
  "#4285f4",
];

type Star = {
  x: number;
  y: number;
  px: number;
  py: number;
  /** px / second */
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  heavy?: boolean;
  onBurst?: boolean;
};

/**
 * Fireworks for the success celebration.
 * Bursts are sized as a fraction of the viewport so they read large.
 */
export function SuccessFireworks() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let alive = true;
    let last = performance.now();
    let launchIn = 280;
    const stars: Star[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const pick = <T,>(arr: T[]) => arr[(Math.random() * arr.length) | 0]!;

    const addStar = (
      x: number,
      y: number,
      angle: number,
      speedPxPerSec: number,
      life: number,
      color: string,
      heavy = false,
    ) => {
      stars.push({
        x,
        y,
        px: x,
        py: y,
        vx: Math.sin(angle) * speedPxPerSec,
        vy: Math.cos(angle) * speedPxPerSec,
        life,
        maxLife: life,
        color,
        heavy,
      });
    };

    const burst = (x: number, y: number, color: string) => {
      // Target radius ≈ 45–65% of the shorter side — fills the stage.
      const radius = Math.min(w, h) * rand(0.45, 0.65);
      const lifeSec = rand(1.6, 2.4);
      // Outer stars should roughly reach `radius` before drag kills them.
      const baseSpeed = (radius / lifeSec) * 2.35;
      const count = 110 + ((Math.random() * 70) | 0);

      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + rand(-0.06, 0.06);
        const speed = baseSpeed * (0.55 + Math.random() * 0.55);
        addStar(x, y, angle, speed, lifeSec * 1000, color);
        if (Math.random() < 0.45) {
          addStar(
            x,
            y,
            angle + rand(-0.25, 0.25),
            speed * 0.55,
            lifeSec * 1000 * 0.55,
            "#ffbf36",
          );
        }
      }

      // Inner ring
      const c2 = pick(COLORS);
      for (let i = 0; i < 40; i++) {
        addStar(
          x,
          y,
          (Math.PI * 2 * i) / 40,
          baseSpeed * 0.4,
          lifeSec * 1000 * 0.7,
          c2,
        );
      }
    };

    const launch = () => {
      const x = w * rand(0.08, 0.92);
      const targetY = h * rand(0.18, 0.42);
      const dist = h - targetY;
      // Reach apex in ~0.9–1.2s
      const flightSec = rand(0.9, 1.2);
      const speed = dist / flightSec;
      const color = pick(COLORS);
      stars.push({
        x,
        y: h + 8,
        px: x,
        py: h + 8,
        vx: rand(-40, 40),
        vy: -speed,
        life: flightSec * 1000 + 200,
        maxLife: flightSec * 1000 + 200,
        color,
        heavy: true,
        onBurst: true,
      });
    };

    const later = (fn: () => void, ms: number) => {
      timers.push(setTimeout(fn, ms));
    };

    const step = (now: number) => {
      if (!alive) return;
      raf = requestAnimationFrame(step);
      const dtMs = Math.min(33, now - last);
      last = now;
      const dt = dtMs / 1000;
      // Mild gravity so bursts stay wide longer
      const g = 420;

      launchIn -= dtMs;
      if (launchIn <= 0) {
        launch();
        if (Math.random() < 0.55) later(launch, 70 + Math.random() * 140);
        if (Math.random() < 0.3) later(launch, 160 + Math.random() * 200);
        launchIn = 480 + Math.random() * 700;
      }

      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = "round";

      for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i]!;
        s.life -= dtMs;
        s.px = s.x;
        s.py = s.y;
        s.x += s.vx * dt;
        s.y += s.vy * dt;

        const drag = s.heavy ? 0.15 : 0.55; // per-second exponential-ish
        const damp = Math.exp(-drag * dt);
        s.vx *= damp;
        s.vy *= damp;
        s.vy += g * dt;

        if (s.onBurst && s.vy >= 0) {
          burst(s.x, s.y, s.color);
          stars.splice(i, 1);
          continue;
        }

        if (s.life <= 0 || s.y > h + 80) {
          stars.splice(i, 1);
          continue;
        }

        const alpha = Math.max(0.2, Math.min(1, s.life / s.maxLife));
        const trailLen = Math.min(28, Math.hypot(s.vx, s.vy) * 0.018);

        ctx.strokeStyle = s.color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = s.heavy ? 5 : 4;
        ctx.beginPath();
        ctx.moveTo(s.x - (s.vx / Math.max(1, Math.hypot(s.vx, s.vy))) * trailLen, s.y - (s.vy / Math.max(1, Math.hypot(s.vx, s.vy))) * trailLen);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();

        ctx.globalAlpha = alpha * 0.95;
        ctx.lineWidth = s.heavy ? 2.4 : 2;
        ctx.strokeStyle = "#fff";
        ctx.beginPath();
        ctx.moveTo(s.px, s.py);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
    };

    resize();
    later(launch, 120);
    later(launch, 280);
    later(launch, 480);
    later(launch, 620);
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(step);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[24] h-full w-full"
      aria-hidden
    />
  );
}
