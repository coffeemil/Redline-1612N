/**
 * Every tunable number in the game lives here.
 *
 * The gameplay is a single tension: hold the brake long enough to survive the
 * corner, but never long enough to snap the brake line. All of that tension is
 * expressed by the constants below, so they are kept in one auditable place
 * instead of being sprinkled through the physics code.
 */

// ---------------------------------------------------------------------------
// Track geometry
// ---------------------------------------------------------------------------

/** Distance between two generated track samples, in track units. */
export const STEP = 6;

/** Half width of the drivable road, in track units. */
export const ROAD_HALF = 62;

/** How far ahead of the car the track is generated. */
export const GEN_BUFFER = 24000;

/** Maximum absolute heading deviation from the start direction (90 degrees). */
export const MAX_HEADING_OFFSET = Math.PI * 0.5;

/** Number of segments after which the track reaches maximum difficulty. */
export const DIFFICULTY_RAMP_SEGMENTS = 18;

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

/** Track units per kilometre. The HUD divides travelled distance by this. */
export const KM_UNITS = 21600;

/** Track units per second per km/h, used to display the speedometer. */
export const KMH_SCALE = 1 / 6;

// ---------------------------------------------------------------------------
// Speed
// ---------------------------------------------------------------------------

/** Hard speed ceiling, in track units per second. */
export const V_MAX = 1800;

/** Speed the car never drops below while the brake is intact. */
export const V_MIN = 600;

/** Cruise speed at the start of a run. */
export const V_CRUISE_BASE = 1350;

/** Extra cruise speed granted per kilometre travelled. */
export const V_CRUISE_PER_KM = 250;

/** Acceleration while below the cruise speed. */
export const V_ACCEL = 400;

/** Deceleration while above the cruise speed. */
export const V_DRAG = 440;

// ---------------------------------------------------------------------------
// Brakes
// ---------------------------------------------------------------------------

/** Brake force at which the brake line snaps, in newtons. */
export const BRAKE_THRESHOLD = 1612;

/** Display ceiling of the brake gauge, in newtons. */
export const BRAKE_MAX = 2000;

/** Brake force at which the gauge turns red. */
export const BRAKE_WARN = 1400;

/** Brake force at which the gauge turns amber. */
export const BRAKE_CAUTION = 800;

/** Brake force at which the brake sparks start flying. */
export const BRAKE_SPARK = 1400;

/** Brake force at which the screen starts to bleed red. */
export const BRAKE_DANGER = 1400;

/** Brake force build-up: constant term plus a term proportional to current force. */
export const BRAKE_BUILD_BASE = 2600;
export const BRAKE_BUILD_GAIN = 1.2;

/** Brake force release: constant term plus a term proportional to current force. */
export const BRAKE_RELEASE_BASE = 1200;
export const BRAKE_RELEASE_GAIN = 0.7;

/** Speed lost per second while braking, before the force multiplier. */
export const BRAKE_DECEL_BASE = 780;
export const BRAKE_DECEL_GAIN = 620;

// ---------------------------------------------------------------------------
// Lateral dynamics
//
// The car is simulated in track space: `s` runs along the centre line and `o`
// is the lateral offset. Curvature pushes the car outwards (`aOut`), the tyres
// pull it back (`aIn`), and the difference integrates into lateral velocity.
// ---------------------------------------------------------------------------

/** Lateral spring / damper while coasting. */
export const GRIP_C1 = 32;
export const GRIP_C2 = 12;
export const GRIP_LIMIT = 14000;

/** Lateral spring / damper while braking — much stiffer, hence the drift. */
export const BRAKE_C1 = 310;
export const BRAKE_C2 = 55;
export const BRAKE_GRIP_LIMIT = 45000;

/** Lateral response after the brake line snaps: no grip, only chaos. */
export const BROKEN_C1 = 9;
export const BROKEN_C2 = 3.5;
export const BROKEN_GRIP_LIMIT = 0;
export const BROKEN_DECEL = 100;
export const BROKEN_SLIP = 260;

// ---------------------------------------------------------------------------
// Visuals
// ---------------------------------------------------------------------------

/** Seconds a skid mark stays on the road. */
export const SKID_LIFE = 7;

/** Seconds a smoke puff lives. */
export const SMOKE_LIFE_MIN = 0.7;
export const SMOKE_LIFE_MAX = 1.4;

/** Seconds a brake spark lives. */
export const SPARK_LIFE_MIN = 0.25;
export const SPARK_LIFE_MAX = 0.55;

/** Drift angle above which the DRIFT indicator appears. */
export const DRIFT_INDICATOR = 0.35;

/** Camera zoom range. */
export const ZOOM_MIN = 0.85;
export const ZOOM_MAX = 1.25;

/** Vertical anchor of the camera, as a fraction of viewport height. */
export const CAMERA_ANCHOR_Y = 0.62;

/** Repository linked from the GitHub icon in the top-right corner. */
export const REPO_URL = 'https://github.com/coffeemil/Redline-1612N';

// ---------------------------------------------------------------------------
// Object budgets
//
// Coarse pointers (phones) get smaller budgets so the particle systems cannot
// starve the frame budget on low-end hardware.
// ---------------------------------------------------------------------------

export interface Budgets {
  readonly skid: number;
  readonly particle: number;
  readonly spark: number;
}

export const BUDGETS_FINE: Budgets = { skid: 4000, particle: 700, spark: 260 };
export const BUDGETS_COARSE: Budgets = { skid: 1600, particle: 320, spark: 140 };

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/** localStorage key holding the best distance, in kilometres. */
export const STORAGE_KEY = 'redline1612n.best.km';

/** Legacy key used by the original single-file build, migrated on first load. */
export const LEGACY_STORAGE_KEY = 'wanqu_brake_best_km';

/** Fixed simulation step, in seconds. */
export const FIXED_DT = 1 / 60;

/** Largest frame time the loop will simulate, in seconds. */
export const MAX_FRAME_DT = 0.05;
