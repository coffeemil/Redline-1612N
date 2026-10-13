import { AudioEngine } from './audio.js';
import { Camera } from '../core/camera.js';
import {
  BUDGETS_COARSE,
  BUDGETS_FINE,
  BRAKE_DANGER,
  BRAKE_THRESHOLD,
  FIXED_DT,
  MAX_FRAME_DT,
  V_MAX,
} from '../core/config.js';
import { Effects } from '../core/effects.js';
import { Physics } from '../core/physics.js';
import { loadBest, saveBest } from '../core/storage.js';
import { Track } from '../core/track.js';
import { Viewport } from '../core/viewport.js';
import { drawCar } from '../render/car.js';
import { drawDanger } from '../render/danger.js';
import { drawParticles, drawSkids } from '../render/effects.js';
import {
  drawGameOver,
  drawHud,
  drawRestartButton,
  hitRestart,
  layoutHud,
  type ButtonRect,
} from '../render/hud.js';
import { drawRoad } from '../render/road.js';
import { InputManager } from './input.js';

/**
 * Wires the simulation, the renderer and the platform together.
 *
 * The loop is a fixed-step accumulator: physics always advances in
 * {@link FIXED_DT} slices so handling is identical on a 60 Hz phone and a
 * 144 Hz monitor, while rendering happens once per animation frame.
 */
export class Game {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly viewport: Viewport;
  private readonly track = new Track();
  private readonly physics: Physics;
  private readonly effects: Effects;
  private readonly camera = new Camera();
  private readonly audio = new AudioEngine();
  private readonly input: InputManager;
  private readonly button: ButtonRect = { x: 0, y: 0, w: 0, h: 0 };

  private brakeHeld = false;
  private hintAlpha = 1;
  private accumulator = 0;
  private lastTime = 0;
  private rafId = 0;
  private resizeTimer = 0;
  private running = false;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas context is not available');

    this.ctx = ctx;
    this.viewport = new Viewport(canvas);
    this.physics = new Physics(this.track);
    this.effects = new Effects(this.viewport.coarse ? BUDGETS_COARSE : BUDGETS_FINE, this.viewport.coarse);

    this.input = new InputManager(canvas, this.viewport, {
      onPress: (x, y) => this.onPress(x, y),
      onRelease: () => this.onRelease(),
      onRestart: () => this.restart(),
    });
  }

  /** Boot the game: size the canvas, load the high score and start the loop. */
  start(): void {
    this.physics.best = loadBest();
    this.viewport.resize();
    layoutHud(this.viewport, this.button);
    this.reset();

    this.input.attach();
    this.attachResizeHandlers();

    this.running = true;
    this.lastTime = 0;
    this.rafId = requestAnimationFrame(this.frame);
  }

  /** Tear everything down. */
  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.input.dispose();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('orientationchange', this.onOrientation);
    window.visualViewport?.removeEventListener('resize', this.onResize);
    clearTimeout(this.resizeTimer);
  }

  /** Start a fresh run. */
  restart(): void {
    this.reset();
  }

  private reset(): void {
    this.track.reset();
    this.track.extendTo(26000);
    this.physics.reset();
    this.effects.clear();
    this.camera.reset();
    this.brakeHeld = false;
    this.hintAlpha = 1;
    this.accumulator = 0;
  }

  private onPress(x: number, y: number): void {
    this.audio.init();
    this.audio.resume();

    // Keyboard presses arrive as (-1, -1) and never hit the button.
    // The button is only visible on the game-over overlay, so it is only
    // interactive there too.
    if (
      this.physics.state === 'over' &&
      x >= 0 &&
      y >= 0 &&
      hitRestart(this.viewport, this.button, x, y)
    ) {
      this.restart();
      return;
    }

    if (this.physics.state === 'over') return;
    this.brakeHeld = true;
  }

  private onRelease(): void {
    this.brakeHeld = false;
  }

  private attachResizeHandlers(): void {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onOrientation);
    window.visualViewport?.addEventListener('resize', this.onResize);
  }

  private readonly onResize = (): void => {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => {
      this.viewport.resize();
      layoutHud(this.viewport, this.button);
    }, 100);
  };

  private readonly onOrientation = (): void => {
    window.setTimeout(() => {
      this.viewport.resize();
      layoutHud(this.viewport, this.button);
    }, 220);
  };

  private readonly frame = (time: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.frame);

    if (!this.lastTime) this.lastTime = time;
    let dt = (time - this.lastTime) / 1000;
    this.lastTime = time;
    if (dt > MAX_FRAME_DT) dt = MAX_FRAME_DT;
    if (dt < 0) dt = 0;

    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < 5) {
      this.step(FIXED_DT);
      this.accumulator -= FIXED_DT;
      steps++;
    }
    if (steps === 5) this.accumulator = 0;

    this.render(time);
  };

  private step(dt: number): void {
    const events = this.physics.step(dt, { brake: this.brakeHeld });

    if (events.broke) {
      this.camera.addShake(26);
      this.audio.fail();
    }

    if (events.ended) {
      this.camera.addShake(32);
      this.audio.crash();
      saveBest(this.physics.best);
    }

    const car = this.physics.car;
    this.effects.spawn(car, this.physics.braking, this.physics.brakeForce);
    this.effects.update(dt);

    if (this.brakeHeld || this.physics.distance > 0.005 || car.broken) {
      this.hintAlpha = Math.max(0, this.hintAlpha - dt * 2.5);
    }

    this.updateCamera(dt);
    this.audio.update(
      this.physics.state === 'play',
      this.physics.braking,
      car.broken,
      car.v,
    );
  }

  private updateCamera(dt: number): void {
    const car = this.physics.car;

    if (this.physics.state !== 'play') {
      this.camera.decayShake(dt);
      return;
    }

    let sustain = (car.v / V_MAX) * 2.8 + this.physics.brakeRatio() * 3.8;
    if (car.broken) sustain += 8;
    if (Math.abs(car.drift) > 0.3) sustain += Math.abs(car.drift) * 4;

    this.camera.update(dt, car.x, car.y, car.v, sustain);
  }

  private render(time: number): void {
    const ctx = this.ctx;
    const { width: W, height: H, dpr } = this.viewport;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0a0b0f';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W / 2 + this.camera.shakeX, this.camera.anchorY(H) + this.camera.shakeY);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);

    drawRoad(ctx, this.track, this.physics.car.s, this.viewport, this.camera.zoom);
    drawSkids(ctx, this.effects);
    drawParticles(ctx, this.effects);
    drawCar(ctx, this.physics.car, this.physics.braking);

    ctx.restore();

    drawDanger(
      ctx,
      this.viewport,
      this.physics.car.o,
      Math.max(0, (this.physics.brakeForce - BRAKE_DANGER) / (BRAKE_THRESHOLD - BRAKE_DANGER)),
      this.physics.car.broken,
      time,
    );

    drawHud(ctx, {
      viewport: this.viewport,
      physics: this.physics,
      button: this.button,
      hintAlpha: this.hintAlpha,
    });

    if (this.physics.state === 'over') {
      drawGameOver(ctx, this.viewport, this.physics);
      // Drawn last so the overlay's scrim cannot dim the button.
      drawRestartButton(ctx, this.viewport, this.button);
    }
  }
}
