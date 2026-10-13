import {
  DIFFICULTY_RAMP_SEGMENTS,
  MAX_HEADING_OFFSET,
  STEP,
} from './config.js';
import { clamp, smoothstep } from './math.js';

/**
 * Procedural track generation.
 *
 * The track is a polyline sampled every {@link STEP} units. Each sample stores
 * its position, its curvature and its absolute heading, which lets the physics
 * and the renderer query the track by arc length `s` with a simple lerp.
 *
 * Generation is incremental: {@link Track.extendTo} keeps appending segments
 * until the requested arc length exists, so an endless run never allocates a
 * whole track up front.
 */

/** A single generated corner. */
export interface Segment {
  /** Arc length at which the corner starts. */
  readonly start: number;
  /** Arc length at which the corner ends. */
  readonly end: number;
  /** Signed curvature, in radians per track unit. */
  readonly curvature: number;
  /** Radius of the corner, in track units. */
  readonly radius: number;
  /** Turn direction: `1` for left, `-1` for right. */
  readonly dir: 1 | -1;
}

/** A point on the track centre line. */
export interface TrackPoint {
  x: number;
  y: number;
}

export interface TrackOptions {
  /** Injectable RNG so tests can generate deterministic tracks. */
  readonly random?: () => number;
}

export class Track {
  /** Centre-line samples, one every {@link STEP} units. */
  readonly pts: TrackPoint[] = [{ x: 0, y: 0 }];
  /** Curvature at each sample. */
  readonly ks: number[] = [0];
  /** Absolute heading at each sample, in radians. */
  readonly hs: number[] = [0];
  /** Corners generated so far, in order. */
  readonly segments: Segment[] = [];

  /** Total generated arc length. */
  len = 0;
  /** Current generation cursor position. */
  x = 0;
  y = 0;
  /** Current generation cursor heading. */
  heading = 0;

  private readonly random: () => number;

  private genRemain = 0;
  private genTotal = 0;
  private genFrom = 0;
  private genTarget = 0;
  private genTrans = 1;
  private genCount = 0;

  constructor(options: TrackOptions = {}) {
    this.random = options.random ?? Math.random;
  }

  /** Curvature of the segment currently being generated. */
  get curvature(): number {
    return this.genTarget;
  }

  /** Number of corners generated so far. */
  get segmentCount(): number {
    return this.genCount;
  }

  /** Difficulty ramp in `[0, 1]`, driven by how many corners have been generated. */
  get difficulty(): number {
    return Math.min(1, this.genCount / DIFFICULTY_RAMP_SEGMENTS);
  }

  /** Discard the track and start over from the origin. */
  reset(): void {
    this.pts.length = 0;
    this.pts.push({ x: 0, y: 0 });
    this.ks.length = 0;
    this.ks.push(0);
    this.hs.length = 0;
    this.hs.push(0);
    this.segments.length = 0;

    this.len = 0;
    this.x = 0;
    this.y = 0;
    this.heading = 0;

    this.genRemain = 800;
    this.genTotal = 800;
    this.genFrom = 0;
    this.genTarget = 0;
    this.genTrans = 1;
    this.genCount = 0;
  }

  /**
   * Append samples until the track is at least `until` units long.
   *
   * The guard counter keeps a pathological RNG from hanging the frame; it is
   * far above any realistic request (`GEN_BUFFER` is 24000 units, i.e. 4000
   * samples).
   */
  extendTo(until: number): void {
    let guard = 0;
    while (this.len < until && guard++ < 60000) {
      if (this.genRemain <= 0) this.newSegment();

      const ds = STEP;
      const done = this.genTotal - this.genRemain;

      let k: number;
      if (done < this.genTrans) {
        // Ease into the corner so the curvature is continuous at the joint.
        k = this.genFrom + (this.genTarget - this.genFrom) * smoothstep(done / this.genTrans);
      } else {
        k = this.genTarget;
      }

      this.heading += k * ds;
      this.x += Math.cos(this.heading) * ds;
      this.y += Math.sin(this.heading) * ds;
      this.len += ds;
      this.genRemain -= ds;

      this.pts.push({ x: this.x, y: this.y });
      this.ks.push(k);
      this.hs.push(this.heading);
    }
  }

  /** Interpolated centre-line position at arc length `s`. */
  posAt(s: number): TrackPoint {
    const clamped = clamp(s, 0, this.len);
    const i = this.indexAt(clamped);
    const t = clamped / STEP - i;
    const a = this.pts[i];
    const b = this.pts[i + 1];
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  /** Interpolated heading at arc length `s`. */
  headingAt(s: number): number {
    const clamped = clamp(s, 0, this.len);
    const i = this.indexAt(clamped);
    const t = clamped / STEP - i;
    return this.hs[i] + (this.hs[i + 1] - this.hs[i]) * t;
  }

  /** Interpolated curvature at arc length `s`. */
  curvatureAt(s: number): number {
    const clamped = clamp(s, 0, this.len);
    const i = this.indexAt(clamped);
    const t = clamped / STEP - i;
    return this.ks[i] + (this.ks[i + 1] - this.ks[i]) * t;
  }

  /** Clamped sample index for arc length `s`, always leaving room for `i + 1`. */
  private indexAt(s: number): number {
    const n = this.pts.length;
    let i = Math.floor(s / STEP);
    if (!(i >= 0)) i = 0; // also catches NaN
    if (i > n - 2) i = n - 2;
    return i;
  }

  /**
   * Pick the next corner.
   *
   * Two rules keep the track drivable and interesting:
   *  - the heading may never wander more than {@link MAX_HEADING_OFFSET} from
   *    the start direction, so the road cannot fold back on itself;
   *  - as the heading approaches that limit, corners that would push further
   *    out are rejected in favour of corners that steer back.
   */
  private newSegment(): void {
    const d = this.difficulty;

    const rMin = 900 - 700 * d;
    const rMax = 1700 - 1100 * d;
    const radius = rMin + this.random() * (rMax - rMin);

    let ang = 0.55 + this.random() * 1.65;

    // Bound the heading directly. It is a continuous accumulator, not an angle,
    // so wrapping it through `atan2` would let it drift past the limit: once the
    // heading passes +PI/2 the wrapped value starts decreasing again, which
    // makes the "room" look larger than it is.
    const offset = this.heading;
    const roomPos = MAX_HEADING_OFFSET - offset;
    const roomNeg = MAX_HEADING_OFFSET + offset;
    let dir: 1 | -1;
    if (roomPos < 0.2) {
      dir = -1;
    } else if (roomNeg < 0.2) {
      dir = 1;
    } else {
      const edgePos = 1 - roomPos / MAX_HEADING_OFFSET;
      const edgeNeg = 1 - roomNeg / MAX_HEADING_OFFSET;
      if (edgePos > 0.4 && this.random() < (edgePos - 0.4) * 1.6) {
        dir = -1;
      } else if (edgeNeg > 0.4 && this.random() < (edgeNeg - 0.4) * 1.6) {
        dir = 1;
      } else {
        dir = this.random() < 0.5 ? 1 : -1;
      }
    }

    // Clamp the turn so the corner cannot carry the heading past the fold-back
    // limit. Note the floor is applied to the *room*, not to the angle: when
    // the heading is already at the limit the room is zero and the corner must
    // turn back, so forcing a minimum angle here would defeat the guard.
    const room = dir > 0 ? roomPos : roomNeg;
    const maxTurn = Math.max(0, room);
    if (ang > maxTurn) ang = maxTurn;

    // The corner's total turn is the integral of the curvature ramp plus the
    // hold at full curvature. Deriving the length from the pre-clamp arc lets
    // the `trans`/`hold` minimums stretch the corner past the room that was
    // actually available, which is what pushes the heading through the limit.
    // So: build the corner, measure the turn it would produce, and shrink it
    // until it fits the room.
    const curvature = dir / radius;
    const arc = ang * radius;
    const trans = clamp(arc * 0.45, 160, 420);
    const hold = clamp(arc * 0.65, 180, 900);

    let len = Math.round((trans + hold) / STEP) * STEP;

    // Simulate the corner exactly the way `extendTo` will — stepping in
    // STEP-sized slices — and track the *running* heading, not the net turn.
    // A corner that turns back still pushes the heading further past the limit
    // while its ramp is still on the previous corner's side, so the peak
    // excursion is what has to be bounded, not the final value.
    const peakExcursion = (length: number) => {
      let heading = this.heading;
      let peak = Math.abs(heading);
      for (let done = 0; done < length; done += STEP) {
        const k =
          done < trans
            ? this.genTarget + (curvature - this.genTarget) * smoothstep(done / trans)
            : curvature;
        heading += k * STEP;
        peak = Math.max(peak, Math.abs(heading));
      }
      return peak;
    };

    while (len > STEP && peakExcursion(len) > MAX_HEADING_OFFSET) len -= STEP;

    this.genFrom = this.genTarget;
    this.genTarget = dir / radius;
    this.genTrans = trans;
    this.genTotal = len;
    this.genRemain = len;
    this.genCount++;

    // `len` is a multiple of STEP, so segment boundaries always land exactly on
    // a sample and the curvature ramp is never split across a joint.
    this.segments.push({
      start: this.len,
      end: this.len + len,
      curvature: this.genTarget,
      radius,
      dir,
    });
  }
}
