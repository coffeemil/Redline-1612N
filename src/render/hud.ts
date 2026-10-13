import {
  BRAKE_CAUTION,
  BRAKE_MAX,
  BRAKE_THRESHOLD,
  BRAKE_WARN,
  DRIFT_INDICATOR,
  KMH_SCALE,
} from '../core/config.js';
import { clamp } from '../core/math.js';
import type { Physics } from '../core/physics.js';
import type { Viewport } from '../core/viewport.js';
import { roundRect } from './car.js';

/** Screen-space rectangle of the restart button, refreshed by {@link layoutHud}. */
export interface ButtonRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Build a font string scaled to the current viewport. */
export function uiFont(viewport: Viewport, weight: number, size: number): string {
  const px = Math.max(9, Math.round(size * viewport.scale));
  return `${weight} ${px}px system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif`;
}

/**
 * Position the restart button for the current viewport.
 *
 * The button only appears on the game-over overlay, so it is centred
 * horizontally and sits just below the overlay's text block.
 */
export function layoutHud(viewport: Viewport, button: ButtonRect): void {
  const S = viewport.scale;
  button.w = 132 * S;
  button.h = 46 * S;
  button.x = (viewport.width - button.w) / 2;
  button.y = viewport.height / 2 + 150 * S;
}

/** Hit-test the restart button, with a generous touch padding. */
export function hitRestart(viewport: Viewport, button: ButtonRect, x: number, y: number): boolean {
  const pad = 10 * viewport.scale;
  return (
    x >= button.x - pad &&
    x <= button.x + button.w + pad &&
    y >= button.y - pad &&
    y <= button.y + button.h + pad
  );
}

/** Colour of the brake gauge for a given force. */
export function brakeColor(brakeForce: number, broken: boolean): string {
  if (broken) return '#ff2b2b';
  if (brakeForce > BRAKE_WARN) return '#ff3b30';
  if (brakeForce > BRAKE_CAUTION) return '#ffc93c';
  return '#3ddc84';
}

export interface HudOptions {
  readonly viewport: Viewport;
  readonly physics: Physics;
  readonly button: ButtonRect;
  readonly hintAlpha: number;
}

/** Draw the in-run HUD: distance, best, speed, brake gauge and hints. */
export function drawHud(ctx: CanvasRenderingContext2D, opts: HudOptions): void {
  const { viewport, physics, button, hintAlpha } = opts;
  const { width: W, height: H, scale: S, safe } = viewport;
  const car = physics.car;

  ctx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
  ctx.textBaseline = 'alphabetic';

  const padL = 22 * S + safe.left;
  const padT = 44 * S + safe.top;

  // Distance travelled.
  const distText = physics.distance.toFixed(2);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = uiFont(viewport, 800, 34);
  ctx.fillText(distText, padL, padT);
  const wDist = ctx.measureText(distText).width;

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = uiFont(viewport, 700, 16);
  ctx.fillText('km', padL + wDist + 6 * S, padT - 2 * S);

  // Personal best.
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = uiFont(viewport, 600, 15);
  ctx.fillText(`最高 ${physics.best.toFixed(2)} km`, padL + 3, padT + 27 * S);

  // Control hint, fading out once the player starts driving.
  if (physics.state === 'play' && hintAlpha > 0.01) {
    ctx.globalAlpha = hintAlpha * 0.75;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = uiFont(viewport, 700, 16);
    ctx.fillText('按住屏幕刹车 · 松手加速', W / 2, H - safe.bottom - 132 * S);
    ctx.globalAlpha = 1;
  }

  // Speedometer.
  const kmh = Math.round(car.v * KMH_SCALE);
  const speedY = H - safe.bottom - 96 * S;
  ctx.textAlign = 'left';
  ctx.fillStyle = car.broken ? '#ff5b5b' : 'rgba(255,255,255,0.92)';
  ctx.font = uiFont(viewport, 800, 30);
  ctx.fillText(String(kmh), padL, speedY);
  const wSpeed = ctx.measureText(String(kmh)).width;
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = uiFont(viewport, 600, 14);
  ctx.fillText('km/h', padL + wSpeed + 6 * S, speedY);

  drawBrakeGauge(ctx, viewport, physics);

  // Drift indicator.
  if (physics.state === 'play' && Math.abs(car.drift) > DRIFT_INDICATOR && !car.broken) {
    const alpha = clamp((Math.abs(car.drift) - DRIFT_INDICATOR) / 0.5, 0, 1);
    ctx.fillStyle = `rgba(255,200,60,${(alpha * 0.85).toFixed(2)})`;
    ctx.font = uiFont(viewport, 800, 18);
    ctx.textAlign = 'center';
    ctx.fillText('DRIFT', W / 2, H - safe.bottom - 150 * S);
  }

  // The restart button is part of the game-over overlay only.
  if (physics.state === 'over') {
    drawRestartButton(ctx, viewport, button);
  }
}

/**
 * Draw the restart button on its own.
 *
 * It is rendered after {@link drawGameOver} so the overlay's dark scrim does
 * not wash it out — the button must stay crisp and clearly tappable.
 */
export function drawRestartButton(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  button: ButtonRect,
): void {
  const S = viewport.scale;

  ctx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);

  ctx.fillStyle = 'rgba(255,80,80,0.22)';
  roundRect(ctx, button.x, button.y, button.w, button.h, 12 * S);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,120,120,0.65)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, button.x, button.y, button.w, button.h, 12 * S);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = uiFont(viewport, 700, 18);
  ctx.textAlign = 'center';
  ctx.fillText('重开', button.x + button.w / 2, button.y + button.h / 2 + 6 * S);
}

function drawBrakeGauge(ctx: CanvasRenderingContext2D, viewport: Viewport, physics: Physics): void {
  const { width: W, height: H, scale: S, safe } = viewport;
  const padL = 22 * S + safe.left;

  const bw = Math.min(360 * S, Math.max(120, W - 2 * (padL + 8)));
  const bh = 18 * S;
  const bx = (W - bw) / 2;
  const by = H - safe.bottom - 56 * S;

  ctx.fillStyle = 'rgba(255,255,255,0.09)';
  roundRect(ctx, bx - 3, by - 3, bw + 6, bh + 6, 13);
  ctx.fill();

  const fillRatio = clamp(physics.brakeForce / BRAKE_MAX, 0, 1);
  if (fillRatio > 0.002) {
    const col = brakeColor(physics.brakeForce, physics.car.broken);
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = physics.braking ? 20 : 10;
    roundRect(ctx, bx, by, Math.max(6, bw * fillRatio), bh, 10);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // The dashed line marks the breaking point, so the player can aim at it.
  const breakX = bx + bw * (BRAKE_THRESHOLD / BRAKE_MAX);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(breakX, by - 2);
  ctx.lineTo(breakX, by + bh + 2);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = uiFont(viewport, 600, 11);
  ctx.textAlign = 'left';
  ctx.fillText('0N', bx, by + bh + 16 * S);
  ctx.textAlign = 'center';
  ctx.fillText(`${BRAKE_THRESHOLD}N`, breakX, by + bh + 16 * S);
  ctx.textAlign = 'right';
  ctx.fillText(`${BRAKE_MAX}N`, bx + bw, by + bh + 16 * S);

  ctx.fillStyle = physics.car.broken ? '#ff8a8a' : 'rgba(255,255,255,0.85)';
  ctx.font = uiFont(viewport, 700, 12);
  ctx.textAlign = 'center';
  ctx.fillText(physics.car.broken ? '刹车已踩断！' : '刹车力度', W / 2, by - 10 * S);
}

/** Draw the end-of-run overlay. */
export function drawGameOver(ctx: CanvasRenderingContext2D, viewport: Viewport, physics: Physics): void {
  const { width: W, height: H, scale: S } = viewport;
  const isBroken = physics.reason === 'broken';

  ctx.fillStyle = isBroken ? 'rgba(20,6,0,0.72)' : 'rgba(16,0,2,0.72)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';

  if (isBroken) {
    ctx.fillStyle = '#ff8c1a';
    ctx.font = uiFont(viewport, 900, 52);
    ctx.fillText('刹车断裂 !', W / 2, H / 2 - 42 * S);

    ctx.fillStyle = 'rgba(255,210,160,0.85)';
    ctx.font = uiFont(viewport, 600, 16);
    ctx.fillText('刹车失效 · 车辆失控滑出赛道', W / 2, H / 2 - 4 * S);
  } else {
    ctx.fillStyle = '#ff4d4d';
    ctx.font = uiFont(viewport, 900, 56);
    ctx.fillText('出 界 !', W / 2, H / 2 - 42 * S);

    ctx.fillStyle = 'rgba(255,180,180,0.85)';
    ctx.font = uiFont(viewport, 600, 16);
    ctx.fillText('车辆偏离赛道', W / 2, H / 2 - 4 * S);
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = uiFont(viewport, 800, 26);
  ctx.fillText(`本次距离  ${physics.distance.toFixed(2)} km`, W / 2, H / 2 + 42 * S);

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = uiFont(viewport, 600, 18);
  ctx.fillText(`最高纪录  ${physics.best.toFixed(2)} km`, W / 2, H / 2 + 78 * S);

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = uiFont(viewport, 600, 15);
  ctx.fillText('点击下方「重开」按钮重新开始', W / 2, H / 2 + 122 * S);
}
