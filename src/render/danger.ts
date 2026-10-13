import { ROAD_HALF } from '../core/config.js';
import type { Viewport } from '../core/viewport.js';

/**
 * The red vignette that warns the player.
 *
 * It is driven by the worst of three signals: drifting towards the edge of the
 * road, squeezing the brake towards its breaking point, and the brake having
 * already snapped.
 */
export function drawDanger(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  lateralOffset: number,
  brakeDanger: number,
  broken: boolean,
  timeMs: number,
): void {
  const dOff = Math.max(0, (Math.abs(lateralOffset) - ROAD_HALF * 0.55) / (ROAD_HALF * 0.45));
  const d = Math.max(dOff * 0.75, brakeDanger, broken ? 1 : 0);
  if (d <= 0.01) return;

  const { width: W, height: H } = viewport;
  const pulse = 0.85 + 0.15 * Math.sin(timeMs * 0.012);
  const alpha = Math.min(0.5, d * 0.5 * pulse);

  const g = ctx.createRadialGradient(
    W / 2,
    H / 2,
    Math.min(W, H) * 0.25,
    W / 2,
    H / 2,
    Math.max(W, H) * 0.75,
  );
  g.addColorStop(0, 'rgba(255,0,0,0)');
  g.addColorStop(1, `rgba(255,0,0,${alpha.toFixed(3)})`);

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
