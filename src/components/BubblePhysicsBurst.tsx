"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  delay: number;
  max: number;
  drag: number;
  gravity: number;
  mist: boolean;
};

type Film = {
  x: number;
  y: number;
  r: number;
  born: number;
  puncture: number;
};

export type BubblePhysicsBurstHandle = {
  burst: (x: number, y: number, radius: number) => void;
};

export const BubblePhysicsBurst = forwardRef<BubblePhysicsBurstHandle>(
  function BubblePhysicsBurst(_, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particles = useRef<Particle[]>([]);
    const films = useRef<Film[]>([]);
    const raf = useRef(0);
    const last = useRef(0);

    useEffect(() => {
      const canvas = canvasRef.current;
      const parent = canvas?.parentElement;
      if (!canvas || !parent) return;

      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const { width, height } = parent.getBoundingClientRect();
        canvas.width = Math.max(1, Math.floor(width * dpr));
        canvas.height = Math.max(1, Math.floor(height * dpr));
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        canvas.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
      };

      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(parent);
      return () => observer.disconnect();
    }, []);

    useImperativeHandle(ref, () => ({
      burst(x, y, radius) {
        const reduced = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        const list = particles.current;
        const beads = reduced ? 8 : 32;

        for (let i = 0; i < beads; i += 1) {
          const angle = (i / beads) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
          const speed = radius * (1.6 + Math.random() * 1.8);
          list.push({
            x: x + Math.cos(angle) * radius * 0.62,
            y: y + Math.sin(angle) * radius * 0.62,
            vx: Math.cos(angle) * speed * 0.022,
            vy: Math.sin(angle) * speed * 0.022 - radius * 0.006,
            r: radius * (0.035 + Math.random() * 0.045),
            life: 0,
            delay: 110,
            max: 480 + Math.random() * 320,
            drag: 0.988,
            gravity: 0.14 + Math.random() * 0.08,
            mist: false,
          });
        }

        if (!reduced) {
          for (let i = 0; i < 28; i += 1) {
            const angle = Math.random() * Math.PI * 2;
            const speed = radius * (0.6 + Math.random() * 2.4);
            list.push({
              x: x + Math.cos(angle) * radius * 0.15,
              y: y + Math.sin(angle) * radius * 0.15,
              vx: Math.cos(angle) * speed * 0.026,
              vy: Math.sin(angle) * speed * 0.026,
              r: radius * (0.01 + Math.random() * 0.018),
              life: 0,
              delay: 120,
              max: 220 + Math.random() * 180,
              drag: 0.94,
              gravity: 0.03,
              mist: true,
            });
          }
        }

        for (let i = 0; i < (reduced ? 2 : 5); i += 1) {
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
          list.push({
            x: x + (Math.random() - 0.5) * radius * 0.2,
            y: y + (Math.random() - 0.5) * radius * 0.2,
            vx: Math.cos(angle) * radius * 0.01,
            vy: Math.sin(angle) * radius * (0.018 + Math.random() * 0.02),
            r: radius * (0.055 + Math.random() * 0.04),
            life: 0,
            delay: 130,
            max: 640 + Math.random() * 180,
            drag: 0.992,
            gravity: 0.2,
            mist: false,
          });
        }

        films.current.push({
          x,
          y,
          r: radius * 1.15,
          born: performance.now(),
          puncture: Math.random() * Math.PI * 2,
        });
        if (!raf.current) {
          last.current = 0;
          raf.current = requestAnimationFrame(frame);
        }
      },
    }));

    function frame(now: number) {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) {
        raf.current = 0;
        return;
      }

      const dt = Math.min(34, last.current ? now - last.current : 16);
      last.current = now;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      ctx.clearRect(0, 0, width, height);

      films.current = films.current.filter((film) => {
        try {
          return paintFilm(ctx, film, now);
        } catch {
          return false;
        }
      });

      const alive: Particle[] = [];
      const step = dt / 16;
      for (const particle of particles.current) {
        particle.life += dt;
        if (particle.life < particle.delay) {
          alive.push(particle);
          continue;
        }
        const age = particle.life - particle.delay;
        if (age >= particle.max) continue;
        particle.vx *= particle.drag;
        particle.vy = particle.vy * particle.drag + particle.gravity * step;
        particle.x += particle.vx * step;
        particle.y += particle.vy * step;
        const t = age / particle.max;
        const alpha = t < 0.06 ? t / 0.06 : Math.pow(1 - t, 1.15);
        paintDrop(ctx, particle, alpha);
        alive.push(particle);
      }
      particles.current = alive;

      if (alive.length > 0 || films.current.length > 0) {
        raf.current = requestAnimationFrame(frame);
      } else {
        raf.current = 0;
        ctx.clearRect(0, 0, width, height);
      }
    }

    return (
      <canvas
        ref={canvasRef}
        className="onboarding-physics-burst"
        aria-hidden
      />
    );
  },
);

const FILM_MS = 460;

function paintFilm(
  ctx: CanvasRenderingContext2D,
  film: Film,
  now: number,
) {
  const t = (now - film.born) / FILM_MS;
  if (t >= 1) return false;

  const { x, y, r } = film;
  ctx.save();
  ctx.lineCap = "round";

  if (t < 0.28) {
    const swell = 1 + t * 0.45;
    const radius = r * swell;
    const gloss = ctx.createRadialGradient(
      x - radius * 0.32,
      y - radius * 0.36,
      radius * 0.04,
      x,
      y,
      radius,
    );
    gloss.addColorStop(0, "rgba(255,255,255,0.72)");
    gloss.addColorStop(0.28, "rgba(190,235,255,0.28)");
    gloss.addColorStop(0.72, "rgba(255,180,230,0.08)");
    gloss.addColorStop(1, "rgba(255,255,255,0.02)");
    ctx.fillStyle = gloss;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = Math.max(3, radius * 0.09);
    ctx.strokeStyle = `rgba(255,255,255,${0.95 - t})`;
    ctx.stroke();
    ctx.lineWidth = Math.max(1.5, radius * 0.045);
    ctx.strokeStyle = `hsla(${190 + t * 140}, 100%, 72%, ${0.9 - t * 0.4})`;
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.ellipse(
      x - radius * 0.28,
      y - radius * 0.32,
      radius * 0.16,
      radius * 0.09,
      -0.6,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  } else {
    const p = (t - 0.28) / 0.72;
    const radius = r * (1.12 + p * 0.95);
    const gap = Math.min(Math.PI * 2.05, p * Math.PI * 2.4);
    const start = film.puncture + gap / 2;
    const end = film.puncture + Math.PI * 2 - gap / 2;

    if (end - start > 0.15) {
      ctx.beginPath();
      ctx.arc(x, y, radius, start, end);
      ctx.strokeStyle = `rgba(245,252,255,${(1 - p) * 0.95})`;
      ctx.lineWidth = Math.max(1.2, r * 0.11 * (1 - p * 0.65));
      ctx.stroke();
      ctx.strokeStyle = `hsla(${300 - p * 160}, 95%, 68%, ${(1 - p) * 0.75})`;
      ctx.lineWidth = Math.max(0.8, r * 0.05 * (1 - p));
      ctx.stroke();
    }

    for (let i = 0; i < 8; i += 1) {
      const angle = film.puncture + (i / 8) * Math.PI * 2;
      const dist = radius * (0.05 + p * 0.72);
      ctx.beginPath();
      ctx.arc(
        x + Math.cos(angle) * dist,
        y + Math.sin(angle) * dist,
        r * (0.28 - p * 0.1),
        angle - 0.55,
        angle + 0.55,
      );
      ctx.strokeStyle = `rgba(255,255,255,${(1 - p) * 0.85})`;
      ctx.lineWidth = Math.max(1, r * 0.055 * (1 - p));
      ctx.stroke();
    }

    if (p < 0.22) {
      const flash = ctx.createRadialGradient(x, y, 0, x, y, r * 1.35);
      flash.addColorStop(0, `rgba(255,255,255,${0.85 * (1 - p / 0.22)})`);
      flash.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = flash;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
  return true;
}

function paintDrop(
  ctx: CanvasRenderingContext2D,
  particle: Particle,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha * (particle.mist ? 0.55 : 1)));
  const gradient = ctx.createRadialGradient(
    particle.x - particle.r * 0.28,
    particle.y - particle.r * 0.32,
    particle.r * 0.05,
    particle.x,
    particle.y,
    particle.r,
  );
  gradient.addColorStop(0, "rgba(255,255,255,0.98)");
  gradient.addColorStop(0.42, "rgba(186,232,255,0.88)");
  gradient.addColorStop(1, "rgba(70,150,210,0.05)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(
    particle.x,
    particle.y,
    particle.r * (particle.mist ? 1.4 : 0.82),
    particle.r * (particle.mist ? 1.4 : 1.15),
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();
}
