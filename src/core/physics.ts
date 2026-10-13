import {
  BRAKE_BUILD_BASE,
  BRAKE_BUILD_GAIN,
  BRAKE_C1,
  BRAKE_C2,
  BRAKE_DECEL_BASE,
  BRAKE_DECEL_GAIN,
  BRAKE_GRIP_LIMIT,
  BRAKE_MAX,
  BRAKE_RELEASE_BASE,
  BRAKE_RELEASE_GAIN,
  BRAKE_THRESHOLD,
  BROKEN_C1,
  BROKEN_C2,
  BROKEN_DECEL,
  BROKEN_GRIP_LIMIT,
  BROKEN_SLIP,
  GEN_BUFFER,
  GRIP_C1,
  GRIP_C2,
  GRIP_LIMIT,
  KM_UNITS,
  ROAD_HALF,
  V_ACCEL,
  V_CRUISE_BASE,
  V_CRUISE_PER_KM,
  V_DRAG,
  V_MAX,
  V_MIN,
} from './config.js';
import { clamp, damp, wrapAngle } from './math.js';
import type { Track } from './track.js';

/** How quickly the rendered body angle catches up with the physical heading. */
const BODY_TURN_RATE = 16;

/** Why a run ended. */
export type GameOverReason = 'out' | 'broken';

/** High-level run state. */
export type RunState = 'play' | 'over';

/** Everything the simulation needs to know about the player's intent. */
export interface CarInput {
  brake: boolean;
}

/** Injectable random source, so runs can be made reproducible. */
export type RandomSource = () => number;

export interface PhysicsOptions {
  /**
   * Random source used for the post-breakdown slide noise. Defaults to
   * `Math.random`; tests pass a seeded generator to get deterministic runs.
   */
  readonly random?: RandomSource;
}

/** Mutable car state, in track space plus a cached world position. */
export interface Car {
  /** Arc length travelled along the centre line. */
  s: number;
  /** Lateral offset from the centre line; positive is to the left. */
  o: number;
  /** Lateral velocity. */
  vo: number;
  /** Forward speed, in track units per second. */
  v: number;
  /** World position, derived from `s` and `o` each step. */
  x: number;
  y: number;
  /** Body angle in world space, including the visual drift. */
  angle: number;
  /** True once the brake line has snapped. */
  broken: boolean;
  /** Visual drift angle, smoothed towards its target. */
  drift: number;
}

/** Events emitted by a single simulation step, for the presentation layer. */
export interface StepEvents {
  /** The brake line snapped during this step. */
  broke: boolean;
  /** The run ended during this step. */
  ended: boolean;
  /** Why the run ended, when `ended` is true. */
  reason: GameOverReason | null;
}

export function createCar(): Car {
  return {
    s: 0,
    o: 0,
    vo: 0,
    v: V_MIN,
    x: 0,
    y: 0,
    angle: 0,
    broken: false,
    drift: 0,
  };
}

/**
 * The whole simulation.
 *
 * The car is integrated in track space rather than world space: `s` advances
 * along the centre line and `o` is the lateral offset. Curvature pushes the car
 * outwards, the tyres pull it back, and the residual is what the player feels
 * as understeer, grip and — once the brake line snaps — total loss of control.
 */
export class Physics {
  readonly car: Car = createCar();

  /** Current brake force in newtons, `0 .. BRAKE_MAX`. */
  brakeForce = 0;
  /** Whether the brake was held during the last step. */
  braking = false;
  /** Distance travelled this run, in kilometres. */
  distance = 0;
  /** Best distance across runs, in kilometres. */
  best = 0;
  /** Current run state. */
  state: RunState = 'play';
  /** Why the current run ended. */
  reason: GameOverReason = 'out';

  private readonly track: Track;
  private readonly random: RandomSource;

  constructor(track: Track, options: PhysicsOptions = {}) {
    this.track = track;
    this.random = options.random ?? Math.random;
  }

  /** Start a fresh run. `best` is preserved across resets. */
  reset(): void {
    const car = this.car;
    car.s = 0;
    car.o = 0;
    car.vo = 0;
    car.v = V_MIN;
    car.x = 0;
    car.y = 0;
    car.angle = 0;
    car.broken = false;
    car.drift = 0;

    this.brakeForce = 0;
    this.braking = false;
    this.distance = 0;
    this.state = 'play';
    this.reason = 'out';
  }

  /** End the run. Returns `true` if this call actually ended it. */
  end(reason: GameOverReason): boolean {
    if (this.state !== 'play') return false;
    this.state = 'over';
    this.reason = reason;
    if (this.distance > this.best) this.best = this.distance;
    return true;
  }

  /** Cruise speed for the current distance: the further you go, the faster it gets. */
  cruiseSpeed(): number {
    return Math.min(V_MAX, V_CRUISE_BASE + this.distance * V_CRUISE_PER_KM);
  }

  /** Brake force as a fraction of the breaking point, clamped to `[0, 1]`. */
  brakeRatio(): number {
    return clamp(this.brakeForce / BRAKE_THRESHOLD, 0, 1);
  }

  /** Centre-line position under the car. */
  trackPos(): { x: number; y: number } {
    return this.track.posAt(this.car.s);
  }

  /** Centre-line heading under the car. */
  trackHeading(): number {
    return this.track.headingAt(this.car.s);
  }

  /** Advance the simulation by `dt` seconds. */
  step(dt: number, input: CarInput): StepEvents {
    const car = this.car;
    const events: StepEvents = { broke: false, ended: false, reason: null };

    if (this.state !== 'play') return events;

    // Once the brake line snaps the pedal is dead: the car coasts and slides.
    const braking = input.brake && !car.broken;
    this.braking = braking;

    this.updateBrakeForce(dt, braking);

    if (this.brakeForce >= BRAKE_THRESHOLD && !car.broken) {
      car.broken = true;
      this.brakeForce = BRAKE_THRESHOLD;
      events.broke = true;
    }

    const effectiveForce = this.brakeRatio();

    this.updateSpeed(dt, braking, effectiveForce);

    car.s += car.v * dt;
    this.track.extendTo(car.s + GEN_BUFFER);

    this.distance = car.s / KM_UNITS;
    if (this.distance > this.best) this.best = this.distance;

    this.updateLateral(dt, braking);
    this.updateDrift(dt, braking);
    this.updateWorldTransform(dt);

    const reason = this.checkEndConditions();
    if (reason) {
      this.end(reason);
      events.ended = true;
      events.reason = reason;
    }

    return events;
  }

  private updateBrakeForce(dt: number, braking: boolean): void {
    if (this.car.broken) return;
    if (braking) {
      this.brakeForce = Math.min(
        BRAKE_MAX,
        this.brakeForce + (BRAKE_BUILD_BASE + this.brakeForce * BRAKE_BUILD_GAIN) * dt,
      );
    } else {
      this.brakeForce = Math.max(
        0,
        this.brakeForce - (BRAKE_RELEASE_BASE + this.brakeForce * BRAKE_RELEASE_GAIN) * dt,
      );
    }
  }

  private updateSpeed(dt: number, braking: boolean, effectiveForce: number): void {
    const car = this.car;

    if (car.broken) {
      // The pedal is dead, so the car simply coasts down to a stop.
      car.v = Math.max(0, car.v - BROKEN_DECEL * dt);
      return;
    }

    if (braking) {
      car.v -= (BRAKE_DECEL_BASE + effectiveForce * BRAKE_DECEL_GAIN) * dt;
      car.v = clamp(car.v, V_MIN, V_MAX);
      return;
    }

    const cruise = this.cruiseSpeed();
    car.v += car.v < cruise ? V_ACCEL * dt : -V_DRAG * dt;
    car.v = clamp(car.v, V_MIN, V_MAX);
  }

  private updateLateral(dt: number, braking: boolean): void {
    const car = this.car;
    const k = this.track.curvatureAt(car.s);

    let c1: number;
    let c2: number;
    let grip: number;
    if (car.broken) {
      c1 = BROKEN_C1;
      c2 = BROKEN_C2;
      grip = BROKEN_GRIP_LIMIT;
    } else if (braking) {
      c1 = BRAKE_C1;
      c2 = BRAKE_C2;
      grip = BRAKE_GRIP_LIMIT;
    } else {
      c1 = GRIP_C1;
      c2 = GRIP_C2;
      grip = GRIP_LIMIT;
    }

    const aOut = -car.v * car.v * k;
    const aIn = clamp(c1 * car.o + c2 * car.vo, -grip, grip);

    car.vo += (aOut - aIn) * dt;
    if (car.broken) car.vo += (this.random() - 0.5) * BROKEN_SLIP * dt;
    car.o += car.vo * dt;
  }

  private updateDrift(dt: number, braking: boolean): void {
    const car = this.car;
    const k = this.track.curvatureAt(car.s);
    const absK = Math.abs(k);

    let target: number;
    if (car.broken) {
      target = clamp(-car.vo / 400, -0.9, 0.9);
    } else if (braking && absK > 0.0004) {
      const curveFactor = Math.min(1, absK * 1400);
      const speedFactor = Math.min(1, car.v / 1100);
      const amt = 0.35 + curveFactor * 0.6 * speedFactor;
      target = Math.sign(k) * Math.min(1.1, amt) + clamp(-car.vo / 900, -0.2, 0.2);
    } else {
      target = clamp(-car.vo / 360, -0.75, 0.75);
    }

    target = clamp(target, -1.2, 1.2);
    const response = car.broken ? 5 : braking ? 15 : 9;
    car.drift = damp(car.drift, target, response, dt);
  }

  private updateWorldTransform(dt: number): void {
    const car = this.car;
    const p = this.track.posAt(car.s);
    const h = this.track.headingAt(car.s);

    // The road normal is the heading rotated by +90 degrees.
    car.x = p.x - Math.sin(h) * car.o;
    car.y = p.y + Math.cos(h) * car.o;

    car.angle += wrapAngle(h + car.drift - car.angle) * Math.min(1, BODY_TURN_RATE * dt);
  }

  private checkEndConditions(): GameOverReason | null {
    const car = this.car;
    if (Math.abs(car.o) > ROAD_HALF) return car.broken ? 'broken' : 'out';
    if (car.broken && car.v <= 0.5) return 'broken';
    return null;
  }
}