import { CAMERA_ANCHOR_Y, ZOOM_MAX, ZOOM_MIN } from './config.js';
import { clamp, damp } from './math.js';

/**
 * A smoothed chase camera.
 *
 * The camera trails the car with exponential smoothing and pulls back as speed
 * rises, which is what sells the sense of speed without any motion blur.
 */
export class Camera {
  x = 0;
  y = 0;
  zoom = 1.1;
  /** Screen-space shake offset, refreshed every frame. */
  shakeX = 0;
  shakeY = 0;

  private shake = 0;

  reset(): void {
    this.x = 0;
    this.y = 0;
    this.zoom = 1.1;
    this.shake = 0;
    this.shakeX = 0;
    this.shakeY = 0;
  }

  /** Add an impulse to the shake amplitude. */
  addShake(amount: number): void {
    this.shake = Math.max(this.shake, amount);
  }

  /** Target zoom for a given speed. */
  static zoomForSpeed(speed: number): number {
    return clamp(ZOOM_MAX - speed * 0.00015, ZOOM_MIN, ZOOM_MAX);
  }

  /**
   * Follow the car.
   *
   * `sustain` is the shake level the current driving state deserves; the actual
   * shake decays towards it so impacts fade out smoothly.
   */
  update(dt: number, targetX: number, targetY: number, speed: number, sustain: number): void {
    this.zoom = damp(this.zoom, Camera.zoomForSpeed(speed), 6, dt);
    this.x = damp(this.x, targetX, 20, dt);
    this.y = damp(this.y, targetY, 20, dt);

    this.shake = Math.max(this.shake * Math.pow(0.0006, dt), sustain);
    this.shakeX = (Math.random() - 0.5) * this.shake;
    this.shakeY = (Math.random() - 0.5) * this.shake;
  }

  /** Decay the shake while the run is over. */
  decayShake(dt: number): void {
    this.shake *= Math.pow(0.000001, dt);
    this.shakeX = (Math.random() - 0.5) * this.shake;
    this.shakeY = (Math.random() - 0.5) * this.shake;
  }

  /** Screen-space translation of the world layer, in CSS pixels. */
  anchorY(height: number): number {
    return height * CAMERA_ANCHOR_Y;
  }
}
