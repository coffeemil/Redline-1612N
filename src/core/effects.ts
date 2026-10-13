import {
  BRAKE_SPARK,
  BRAKE_THRESHOLD,
  SKID_LIFE,
  SMOKE_LIFE_MAX,
  SMOKE_LIFE_MIN,
  SPARK_LIFE_MAX,
  SPARK_LIFE_MIN,
  type Budgets,
} from './config.js';
import { rand, randSigned, clamp } from './math.js';
import type { Car } from './physics.js';

/** A tyre mark left on the road. */
export interface Skid {
  x: number;
  y: number;
  /** Half width of the mark. */
  w: number;
  life: number;
  maxLife: number;
}

/** A smoke puff. */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  maxLife: number;
}

/** A brake spark. */
export interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

/** Push `item` onto `arr`, dropping the oldest entries past `max`. */
function pushLimited<T>(arr: T[], item: T, max: number): void {
  arr.push(item);
  if (arr.length > max) arr.splice(0, arr.length - max);
}

/**
 * The particle systems: tyre marks, smoke and brake sparks.
 *
 * All three are hard-capped by {@link Budgets} so a long drift cannot grow the
 * arrays without bound on a phone.
 */
export class Effects {
  readonly skids: Skid[] = [];
  readonly particles: Particle[] = [];
  readonly sparks: Spark[] = [];

  private readonly budgets: Budgets;
  private readonly coarse: boolean;

  constructor(budgets: Budgets, coarse: boolean) {
    this.budgets = budgets;
    this.coarse = coarse;
  }

  clear(): void {
    this.skids.length = 0;
    this.particles.length = 0;
    this.sparks.length = 0;
  }

  /** Emit this frame's marks, smoke and sparks for the given car state. */
  spawn(car: Car, braking: boolean, brakeForce: number): void {
    const ca = Math.cos(car.angle);
    const sa = Math.sin(car.angle);
    const driftIntensity = Math.min(1, Math.abs(car.drift) * 1.3);

    const skidEmitting = braking || car.broken || driftIntensity > 0.25;
    const smokeEmitting = braking || car.broken;

    if (skidEmitting) {
      for (let side = -1; side <= 1; side += 2) {
        const lx = -16;
        const ly = side * 11;
        const wx = car.x + lx * ca - ly * sa;
        const wy = car.y + lx * sa + ly * ca;

        pushLimited(
          this.skids,
          { x: wx, y: wy, w: 3.2 + driftIntensity * 3, life: SKID_LIFE, maxLife: SKID_LIFE },
          this.budgets.skid,
        );

        if (!smokeEmitting) continue;

        let chance = braking ? 0.55 : 0.3;
        if (this.coarse) chance *= 0.7;

        if (Math.random() < chance) {
          pushLimited(
            this.particles,
            {
              x: wx + randSigned() * 4,
              y: wy + randSigned() * 4,
              vx: randSigned() * 40,
              vy: randSigned() * 40,
              r: 4 + Math.random() * 7 + driftIntensity * 6,
              life: rand(SMOKE_LIFE_MIN, SMOKE_LIFE_MAX),
              maxLife: SMOKE_LIFE_MAX,
            },
            this.budgets.particle,
          );
        }
      }
    }

    if ((car.broken || brakeForce > BRAKE_SPARK) && Math.random() < 0.75) {
      const lx = -20;
      const ly = (Math.random() < 0.5 ? -1 : 1) * 12;
      const a = Math.random() * Math.PI * 2;
      const speed = 90 + Math.random() * 220;

      pushLimited(
        this.sparks,
        {
          x: car.x + lx * ca - ly * sa,
          y: car.y + lx * sa + ly * ca,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          life: rand(SPARK_LIFE_MIN, SPARK_LIFE_MAX),
          maxLife: SPARK_LIFE_MAX,
        },
        this.budgets.spark,
      );
    }
  }

  /** Integrate and retire every live effect. */
  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.955;
      p.vy *= 0.955;
      p.r += 28 * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 0.93;
      s.vy *= 0.93;
      s.life -= dt;
      if (s.life <= 0) this.sparks.splice(i, 1);
    }

    for (let i = this.skids.length - 1; i >= 0; i--) {
      const s = this.skids[i];
      s.life -= dt;
      if (s.life <= 0) this.skids.splice(i, 1);
    }
  }

  /** How close the brake is to snapping, in `[0, 1]`. Drives the red vignette. */
  static dangerFromBrake(brakeForce: number): number {
    const span = BRAKE_THRESHOLD - BRAKE_SPARK;
    return clamp((brakeForce - BRAKE_SPARK) / span, 0, 1);
  }
}
