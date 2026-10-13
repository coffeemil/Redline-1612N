import { ROAD_HALF, STEP } from '../core/config.js';
import type { Track } from '../core/track.js';
import type { Viewport } from '../core/viewport.js';

/**
 * Road rendering.
 *
 * The road is drawn as a stack of progressively narrower strokes along the same
 * path, which gives the asphalt its shoulder, kerb and centre line without any
 * per-sample geometry.
 */
export function drawRoad(
  ctx: CanvasRenderingContext2D,
  track: Track,
  carS: number,
  viewport: Viewport,
  zoom: number,
): void {
  const n = track.pts.length;
  if (n < 3) return;

  const ci = carS / STEP;
  const range = Math.ceil((Math.max(viewport.width, viewport.height) / zoom / STEP) * 2.5) + 200;

  // Keep a margin of unrendered samples at the end so the road never shows a
  // hard cut where generation stopped.
  const END_MARGIN = 30;
  const i0 = Math.max(0, Math.floor(ci - range));
  const i1 = Math.min(n - 1 - END_MARGIN, Math.ceil(ci + range));
  if (i1 - i0 < 2) return;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(track.pts[i0].x, track.pts[i0].y);
  for (let i = i0 + 1; i <= i1; i++) {
    ctx.lineTo(track.pts[i].x, track.pts[i].y);
  }

  ctx.strokeStyle = '#14161c';
  ctx.lineWidth = ROAD_HALF * 2 + 22;
  ctx.stroke();

  ctx.strokeStyle = '#1e2129';
  ctx.lineWidth = ROAD_HALF * 2 + 12;
  ctx.stroke();

  ctx.strokeStyle = '#2c2f38';
  ctx.lineWidth = ROAD_HALF * 2;
  ctx.stroke();

  ctx.strokeStyle = '#32363f';
  ctx.lineWidth = ROAD_HALF * 1.55;
  ctx.stroke();

  ctx.setLineDash([28, 32]);
  ctx.lineDashOffset = -((i0 * STEP) % 60);
  ctx.strokeStyle = 'rgba(255,255,255,0.09)';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
}
