/**
 * Small numeric helpers shared by every subsystem.
 *
 * These are deliberately allocation-free and branch-light: they run inside the
 * fixed-step physics loop and the per-frame render pass.
 */

/** Clamp `v` into the inclusive range `[a, b]`. */
export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

/** Linear interpolation between `a` and `b`. `t` is not clamped. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Frame-rate independent exponential smoothing.
 *
 * `rate` is the fraction of the remaining distance that would be covered in one
 * second, so `damp(current, target, 0.5, dt)` moves halfway per second no matter
 * how the frame time is sliced.
 */
export function damp(current: number, target: number, rate: number, dt: number): number {
  return current + (target - current) * Math.min(1, rate * dt);
}

/** Smoothstep easing on `[0, 1]`. */
export function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/** Wrap an angle into `(-PI, PI]`. */
export function wrapAngle(a: number): number {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x < -Math.PI) x += Math.PI * 2;
  return x;
}

/** Sign of `v`, returning `0` for `0` (unlike `Math.sign`'s `-0`). */
export function sign(v: number): number {
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

/** Random float in `[min, max)`. */
export function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Random float in `[-1, 1)`. */
export function randSigned(): number {
  return Math.random() * 2 - 1;
}

/** Round to `digits` decimal places, avoiding float noise in HUD text. */
export function roundTo(v: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}
