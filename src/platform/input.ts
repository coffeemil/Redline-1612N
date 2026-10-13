import type { Viewport } from '../core/viewport.js';

/** What the input layer reports to the game. */
export interface InputHandlers {
  /** A press began at the given canvas-space point. */
  onPress(x: number, y: number): void;
  /** The press ended. */
  onRelease(): void;
  /** The player asked to restart. */
  onRestart(): void;
}

/**
 * Unified pointer, touch, mouse and keyboard input.
 *
 * Only one pointer is tracked at a time: the game is played with a single
 * thumb, and ignoring extra fingers avoids the classic "second finger cancels
 * the brake" bug on phones.
 */
export class InputManager {
  private activePointerId: number | null = null;
  private readonly disposers: Array<() => void> = [];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly viewport: Viewport,
    private readonly handlers: InputHandlers,
  ) {}

  /** Attach every listener. */
  attach(): void {
    this.attachPointer();
    this.attachKeyboard();
    this.attachLifecycle();
    this.attachGestureSuppression();
  }

  /** Detach every listener. */
  dispose(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    this.activePointerId = null;
  }

  /** Release any held input, e.g. when the tab loses focus. */
  release(): void {
    this.activePointerId = null;
    this.handlers.onRelease();
  }

  private on<K extends keyof HTMLElementEventMap>(
    target: HTMLElement | Window | Document,
    type: K | string,
    listener: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, listener, options);
    this.disposers.push(() => target.removeEventListener(type, listener, options));
  }

  private press(clientX: number, clientY: number): void {
    const p = this.viewport.toCanvas(clientX, clientY);
    this.handlers.onPress(p.x, p.y);
  }

  private attachPointer(): void {
    if (window.PointerEvent) {
      this.on(this.canvas, 'pointerdown', ((e: PointerEvent) => {
        e.preventDefault();
        if (this.activePointerId !== null) return;
        this.activePointerId = e.pointerId;
        try {
          this.canvas.setPointerCapture(e.pointerId);
        } catch {
          /* capture is a nicety, not a requirement */
        }
        this.press(e.clientX, e.clientY);
      }) as EventListener, { passive: false });

      const end = (e: PointerEvent) => {
        if (this.activePointerId === null || e.pointerId === this.activePointerId) {
          this.activePointerId = null;
          this.handlers.onRelease();
        }
      };
      this.on(this.canvas, 'pointerup', end as EventListener);
      this.on(this.canvas, 'pointercancel', end as EventListener);
      this.on(this.canvas, 'lostpointercapture', end as EventListener);
      return;
    }

    // Fallback for browsers without Pointer Events.
    this.on(this.canvas, 'touchstart', ((e: TouchEvent) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      if (t) this.press(t.clientX, t.clientY);
    }) as EventListener, { passive: false });

    const endTouch = (e: Event) => {
      e.preventDefault();
      this.handlers.onRelease();
    };
    this.on(this.canvas, 'touchend', endTouch, { passive: false });
    this.on(this.canvas, 'touchcancel', endTouch, { passive: false });

    this.on(this.canvas, 'mousedown', ((e: MouseEvent) => {
      this.press(e.clientX, e.clientY);
    }) as EventListener);
    this.on(window, 'mouseup', () => this.handlers.onRelease());
  }

  private attachKeyboard(): void {
    const isBrakeKey = (e: KeyboardEvent) => e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar';

    this.on(window, 'keydown', ((e: KeyboardEvent) => {
      if (!isBrakeKey(e)) return;
      e.preventDefault();
      if (e.repeat) return;
      this.handlers.onPress(-1, -1);
    }) as EventListener);

    this.on(window, 'keyup', ((e: KeyboardEvent) => {
      if (!isBrakeKey(e)) return;
      e.preventDefault();
      this.handlers.onRelease();
    }) as EventListener);

    this.on(window, 'keydown', ((e: KeyboardEvent) => {
      if (e.code !== 'KeyR') return;
      e.preventDefault();
      this.handlers.onRestart();
    }) as EventListener);
  }

  private attachLifecycle(): void {
    this.on(window, 'blur', () => this.release());
    this.on(window, 'pagehide', () => this.release());
    this.on(document, 'visibilitychange', () => {
      if (document.hidden) this.release();
    });
  }

  private attachGestureSuppression(): void {
    const prevent = (e: Event) => e.preventDefault();
    for (const type of [
      'contextmenu',
      'selectstart',
      'gesturestart',
      'gesturechange',
      'gestureend',
      'dblclick',
    ]) {
      this.on(document, type, prevent);
    }
  }
}
