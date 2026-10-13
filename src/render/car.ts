import type { Car } from '../core/physics.js';

/**
 * Car rendering.
 *
 * The body is drawn in local space and rotated by the physics-provided angle,
 * which already includes the drift offset.
 */
export function drawCar(ctx: CanvasRenderingContext2D, car: Car, braking: boolean): void {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);

  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.beginPath();
  ctx.ellipse(0, 5, 30, 17, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#111217';
  ctx.fillRect(-21, -16, 15, 8);
  ctx.fillRect(-21, 8, 15, 8);
  ctx.fillRect(7, -16, 15, 8);
  ctx.fillRect(7, 8, 15, 8);

  const g = ctx.createLinearGradient(0, -13, 0, 13);
  g.addColorStop(0, '#ff7b6b');
  g.addColorStop(0.45, '#e0342f');
  g.addColorStop(1, '#8f1c1c');
  ctx.fillStyle = g;
  roundRect(ctx, -25, -13, 50, 26, 7);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  roundRect(ctx, -20, -10, 34, 6, 3);
  ctx.fill();

  ctx.fillStyle = 'rgba(140,205,255,0.8)';
  roundRect(ctx, -1, -9, 13, 18, 4);
  ctx.fill();

  ctx.fillStyle = braking ? '#ff2b2b' : '#5c1414';
  if (braking) {
    ctx.shadowColor = '#ff2b2b';
    ctx.shadowBlur = 12;
  }
  ctx.fillRect(-25, -11, 4, 7);
  ctx.fillRect(-25, 4, 4, 7);
  ctx.shadowBlur = 0;

  ctx.restore();
}

/** Trace a rounded rectangle onto the current path. */
export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rad = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}
