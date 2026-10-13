/**
 * Viewport metrics shared by the renderer, the HUD and the input layer.
 *
 * Everything is expressed in CSS pixels; the canvas backing store is scaled by
 * {@link Viewport.dpr} once per frame.
 */
export interface SafeInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export class Viewport {
  /** Viewport width in CSS pixels. */
  width = 360;
  /** Viewport height in CSS pixels. */
  height = 640;
  /** Device pixel ratio, capped at 2 to bound the fill cost on phones. */
  dpr = 1;
  /** UI scale factor derived from the shorter viewport edge. */
  scale = 1;
  /** Whether the primary pointer is coarse (touch). */
  coarse = false;
  /** Safe-area insets, read from the CSS environment variables. */
  readonly safe: SafeInsets = { top: 0, bottom: 0, left: 0, right: 0 };

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.coarse = detectCoarsePointer();
  }

  /** Re-read the viewport size, DPR and safe-area insets, then resize the canvas. */
  resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);

    const vv = window.visualViewport;
    this.width = Math.round(vv ? vv.width : window.innerWidth || document.documentElement.clientWidth);
    this.height = Math.round(vv ? vv.height : window.innerHeight || document.documentElement.clientHeight);
    if (!this.width || !this.height) {
      this.width = 360;
      this.height = 640;
    }

    this.canvas.width = Math.max(1, Math.floor(this.width * this.dpr));
    this.canvas.height = Math.max(1, Math.floor(this.height * this.dpr));
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.scale = Math.min(1, Math.max(0.76, Math.min(this.width, this.height) / 430));

    this.readSafeInsets();
  }

  /** Convert a client-space point to canvas CSS-pixel space. */
  toCanvas(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }

  private readSafeInsets(): void {
    try {
      const cs = getComputedStyle(document.documentElement);
      this.safe.top = Number.parseFloat(cs.getPropertyValue('--sat')) || 0;
      this.safe.bottom = Number.parseFloat(cs.getPropertyValue('--sab')) || 0;
      this.safe.left = Number.parseFloat(cs.getPropertyValue('--sal')) || 0;
      this.safe.right = Number.parseFloat(cs.getPropertyValue('--sar')) || 0;
    } catch {
      this.safe.top = this.safe.bottom = this.safe.left = this.safe.right = 0;
    }
  }
}

function detectCoarsePointer(): boolean {
  try {
    return Boolean(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  } catch {
    return false;
  }
}
