"use client";

/**
 * A lightweight, dependency-free confetti burst. Mounted once in the student
 * layout; fires when a `propel:celebrate` window event is dispatched (e.g. after a
 * successful payment returns to the dashboard). Canvas is invisible + click-through
 * until it fires, and clears itself when done.
 */
import { useEffect, useRef } from 'react';

export default function ConfettiCelebration() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    const run = () => {
      const canvas = canvasRef.current;
      if (!canvas || runningRef.current) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      runningRef.current = true;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = window.innerWidth;
      const H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.scale(dpr, dpr);

      const colors = ['#A8123C', '#E8527A', '#E9B873', '#7ADCBF', '#5B3FA8', '#C0461F'];
      type P = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; size: number; color: string; shape: number };
      const parts: P[] = [];
      const N = 170;
      for (let i = 0; i < N; i++) {
        parts.push({
          x: W / 2 + (Math.random() - 0.5) * W * 0.35,
          y: H * 0.32 + (Math.random() - 0.5) * 90,
          vx: (Math.random() - 0.5) * 11,
          vy: Math.random() * -13 - 3,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.32,
          size: 6 + Math.random() * 9,
          color: colors[(Math.random() * colors.length) | 0],
          shape: (Math.random() * 2) | 0,
        });
      }

      const start = performance.now();
      const DURATION = 2600;
      const frame = (now: number) => {
        const t = now - start;
        ctx.clearRect(0, 0, W, H);
        let alive = false;
        const fade = Math.max(0, 1 - t / DURATION);
        for (const p of parts) {
          p.vy += 0.35; // gravity
          p.vx *= 0.99;
          p.x += p.vx;
          p.y += p.vy;
          p.rot += p.vr;
          if (p.y < H + 40 && fade > 0) alive = true;
          ctx.save();
          ctx.globalAlpha = fade;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          if (p.shape === 0) ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          else { ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill(); }
          ctx.restore();
        }
        if (alive && t < DURATION + 500) requestAnimationFrame(frame);
        else { ctx.clearRect(0, 0, W, H); runningRef.current = false; }
      };
      requestAnimationFrame(frame);
    };

    window.addEventListener('propel:celebrate', run as EventListener);
    return () => window.removeEventListener('propel:celebrate', run as EventListener);
  }, []);

  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 z-[300]" />;
}
