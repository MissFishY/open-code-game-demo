/**
 * Keyboard + mouse input.
 *
 * Uses pointer lock for mouse look. Emits discrete events (interact, toggle
 * inventory, ...) through callbacks so the game loop stays in control of
 * when they are consumed.
 */

export type InputAction =
  | 'interact'
  | 'toggleInventory'
  | 'toggleHelp'
  | 'closePanel'
  | 'resetSave'
  | 'openJournal'
  | 'openSaves';

const KEY_BINDINGS: Record<string, InputAction> = {
  KeyE: 'interact',
  Enter: 'interact',
  Tab: 'toggleInventory',
  KeyI: 'toggleInventory',
  F1: 'toggleHelp',
  Escape: 'closePanel',
  Delete: 'resetSave',
  KeyJ: 'openJournal',
  KeyK: 'openSaves',
};

export class InputSystem {
  private readonly keys = new Set<string>();
  private readonly pressed = new Set<InputAction>();
  private readonly justPressed = new Set<string>();
  private mouseDeltaX = 0;
  private mouseDeltaY = 0;
  private downX = 0;
  private downY = 0;
  private downAt = 0;
  private click: { x: number; y: number } | null = null;
  private locked = false;
  private enabled = true;
  private readonly disposers: Array<() => void> = [];

  constructor(private readonly element: HTMLElement) {
    this.bind();
  }

  private bind(): void {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      this.keys.add(event.code);
      this.justPressed.add(event.code);
      const action = KEY_BINDINGS[event.code];
      if (action) {
        this.pressed.add(action);
        if (action === 'toggleInventory' || action === 'closePanel') {
          event.preventDefault();
        }
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      this.keys.delete(event.code);
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!this.locked) return;
      this.mouseDeltaX += event.movementX;
      this.mouseDeltaY += event.movementY;
    };

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      this.downX = event.clientX;
      this.downY = event.clientY;
      this.downAt = performance.now();
    };

    // A short press without much movement counts as a click.
    const onMouseUp = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const moved = Math.hypot(event.clientX - this.downX, event.clientY - this.downY);
      const held = performance.now() - this.downAt;
      if (moved < 8 && held < 600) {
        this.click = { x: event.clientX, y: event.clientY };
      }
    };

    const onPointerLockChange = () => {
      this.locked = document.pointerLockElement === this.element;
    };

    const onBlur = () => {
      this.keys.clear();
    };

    const onVisibilityChange = () => {
      // Never keep a key held when the tab is hidden.
      if (document.hidden) this.keys.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('pointerlockchange', onPointerLockChange);

    this.disposers.push(() => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
    });
  }

  /** Requests pointer lock so the mouse can drive the camera. */
  requestLock(): void {
    if (this.locked) return;
    const result = this.element.requestPointerLock?.();
    if (result && typeof result.catch === 'function') {
      result.catch(() => {
        /* the browser refused — the game still works with keyboard only */
      });
    }
  }

  /** Releases pointer lock (used when a menu is open). */
  exitLock(): void {
    if (document.pointerLockElement === this.element) {
      document.exitPointerLock?.();
    }
  }

  get isLocked(): boolean {
    return this.locked;
  }

  /** Disables movement input (e.g. while a dialogue is open). */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.keys.clear();
  }

  /** True while the key is held down. */
  isDown(code: string): boolean {
    return this.enabled && this.keys.has(code);
  }

  /** Axis helper: returns -1, 0 or 1. */
  axis(negative: string, positive: string): number {
    let value = 0;
    if (this.isDown(positive)) value += 1;
    if (this.isDown(negative)) value -= 1;
    return value;
  }

  /** Consumes a one-shot action. */
  consume(action: InputAction): boolean {
    if (!this.pressed.has(action)) return false;
    this.pressed.delete(action);
    return true;
  }

  /** True once for every physical key press of `code`. */
  consumeKey(code: string): boolean {
    if (!this.justPressed.has(code)) return false;
    this.justPressed.delete(code);
    return true;
  }

  /**
   * Drops any queued one-shot actions.
   * Used when a panel opens or closes so a key press that was meant for the
   * world is not delivered to the game a moment later.
   */
  clearActions(): void {
    this.pressed.clear();
    this.justPressed.clear();
  }

  /**
   * Consumes a mouse click (a short press that did not move).
   * @returns the position of the click in client coordinates, or null.
   */
  consumeClick(): { x: number; y: number } | null {
    const click = this.click;
    this.click = null;
    return click;
  }

  /** Reads and clears the accumulated mouse movement. */
  takeMouseDelta(): { x: number; y: number } {
    const delta = { x: this.mouseDeltaX, y: this.mouseDeltaY };
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    return delta;
  }

  dispose(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }
}
