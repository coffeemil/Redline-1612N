import { V_MAX } from '../core/config.js';

/**
 * Web Audio engine.
 *
 * Two layers: a looping band-passed noise source for tyre and brake noise, and
 * one-shot oscillators for the pass / fail / crash stingers. Everything is
 * created lazily on the first user gesture, because browsers refuse to start an
 * AudioContext before then.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private noiseGain: GainNode | null = null;
  private noiseFilter: BiquadFilterNode | null = null;
  private failed = false;

  /** Create the context and start the noise loop. Safe to call repeatedly. */
  init(): void {
    if (this.ctx || this.failed) return;

    try {
      const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) {
        this.failed = true;
        return;
      }
      this.ctx = new Ctor();
    } catch {
      this.failed = true;
      return;
    }

    const ctx = this.ctx;
    const size = Math.floor(ctx.sampleRate * 2);
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200;
    filter.Q.value = 1.1;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    try {
      src.start();
    } catch {
      /* already started */
    }

    this.noiseFilter = filter;
    this.noiseGain = gain;
  }

  /** Resume a context that the browser suspended (iOS, background tabs). */
  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => undefined);
    }
  }

  /** Short confirmation blip. */
  pass(): void {
    this.tone(920, 0.09, 'sine', 0.05);
  }

  /** The brake line snapping. */
  fail(): void {
    this.tone(220, 0.55, 'sawtooth', 0.12, 55);
  }

  /** The crash that ends the run. */
  crash(): void {
    this.tone(130, 0.6, 'square', 0.16, 38);

    const ctx = this.ctx;
    if (!ctx || !this.noiseBuffer) return;

    try {
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start(t);
      src.stop(t + 0.6);
    } catch {
      /* the stinger is optional */
    }
  }

  /**
   * Drive the continuous tyre / brake noise.
   *
   * `braking` opens the filter and raises the level; a broken brake keeps a
   * quieter rumble so the player can still hear the car sliding.
   */
  update(playing: boolean, braking: boolean, broken: boolean, speed: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.noiseGain || !this.noiseFilter) return;

    let target = 0;
    if (playing) {
      if (braking) target = 0.1 * Math.min(1, speed / V_MAX);
      else if (broken) target = 0.075;
    }

    try {
      const t = ctx.currentTime;
      this.noiseGain.gain.setTargetAtTime(target, t, 0.06);
      this.noiseFilter.frequency.setTargetAtTime(braking ? 2600 : 1000, t, 0.08);
    } catch {
      /* parameter automation is best-effort */
    }
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number): void {
    const ctx = this.ctx;
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    } catch {
      /* ignore */
    }
  }
}
