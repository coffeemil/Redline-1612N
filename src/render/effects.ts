import type { Effects } from '../core/effects.js';

/**
 * Effect rendering: tyre marks, smoke and sparks.
 *
 * Skid marks are batched into alpha buckets so a long drift costs six fill
 * calls instead of one per mark.
 */
export function drawSkids(ctx: CanvasRenderingContext2D, effects: Effects): void {
  const skids = effects.skids;
  const n = skids.length;
  if (!n) return;

  const BUCKETS = 6;
  ctx.fillStyle = '#06060a';

  for (let b = 0; b < BUCKETS; b++) {
    const lo = b / BUCKETS;
    const hi = (b + 1) / BUCKETS;

    ctx.beginPath();
    let any = false;
    for (let i = 0; i < n; i++) {
      const s = skids[i];
      const r = s.life / s.maxLife;
      if (r <= lo || r > hi) continue;
      const w = s.w || 3.2;
      ctx.rect(s.x - w, s.y - w, w * 2, w * 2);
      any = true;
    }
    if (!any) continue;

    ctx.globalAlpha = 0.45 * hi;
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

export function drawParticles(ctx: CanvasRenderingContext2D, effects: Effects): void {
  const particles = effects.particles;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife) * 0.34;
    ctx.fillStyle = '#c9ccd6';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const sparks = effects.sparks;
  if (!sparks.length) return;

  ctx.strokeStyle = '#ffd34d';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let i = 0; i < sparks.length; i++) {
    const s = sparks[i];
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x - s.vx * 0.025, s.y - s.vy * 0.025);
  }
  ctx.stroke();
}
