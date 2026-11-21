import { Button } from '@ashears/2d-fighter-framework';
import type { InputFrame, Seat } from '@ashears/2d-fighter-framework';

const firstKeys: Record<string, InputFrame> = {
  KeyA: Button.Left, KeyD: Button.Right, KeyW: Button.Jump, KeyS: Button.Down,
  KeyR: Button.Guard, KeyF: Button.Light, KeyG: Button.Heavy, KeyH: Button.Special,
};
const secondKeys: Record<string, InputFrame> = {
  ArrowLeft: Button.Left, ArrowRight: Button.Right, ArrowUp: Button.Jump, ArrowDown: Button.Down,
  ShiftRight: Button.Guard, KeyJ: Button.Light, KeyK: Button.Heavy, KeyL: Button.Special,
};

export class Controls {
  active = false;
  local = false;
  private keys = new Set<string>();
  private touches = new Map<number, HTMLButtonElement>();
  private held: [InputFrame, InputFrame] = [0, 0];
  private queued: [InputFrame[], InputFrame[]] = [[], []];

  constructor(touchControls: HTMLElement, onBlur: () => void) {
    window.addEventListener('keydown', (event) => this.key(event, true));
    window.addEventListener('keyup', (event) => this.key(event, false));
    const deactivate = () => { this.release(); onBlur(); };
    window.addEventListener('blur', deactivate);
    document.addEventListener('visibilitychange', () => { if (document.hidden) deactivate(); });
    const releasePointer = (event: PointerEvent) => {
      this.touches.delete(event.pointerId);
      this.updateButtons(touchControls);
      this.capture();
    };
    touchControls.addEventListener('pointerdown', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-input]');
      if (!button || !this.active) return;
      event.preventDefault();
      this.touches.set(event.pointerId, button);
      button.setPointerCapture(event.pointerId);
      this.updateButtons(touchControls);
      this.capture();
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
      touchControls.addEventListener(event, releasePointer);
    }
  }

  private updateButtons(root: HTMLElement) {
    const pressed = new Set(this.touches.values());
    for (const button of root.querySelectorAll<HTMLButtonElement>('button[data-input]')) {
      button.dataset.held = String(pressed.has(button));
    }
  }

  private key(event: KeyboardEvent, down: boolean) {
    if (!this.active || !(event.code in firstKeys || (this.local && event.code in secondKeys))) return;
    const currentTarget = event.target instanceof HTMLElement ? event.target : null;
    if (down && (event.metaKey || event.ctrlKey || event.altKey || currentTarget?.matches('input, select, textarea, [contenteditable]'))) return;
    event.preventDefault();
    if (down) this.keys.add(event.code);
    else this.keys.delete(event.code);
    this.capture();
  }

  private capture() {
    let first = 0;
    let second = 0;
    for (const key of this.keys) {
      first |= firstKeys[key] ?? 0;
      if (this.local) second |= secondKeys[key] ?? 0;
    }
    for (const button of this.touches.values()) first |= Number(button.dataset.input);
    for (const seat of [0, 1] as const) {
      const frame = seat === 0 ? first : second;
      if (frame === this.held[seat]) continue;
      this.held[seat] = frame;
      const queue = this.queued[seat];
      if (queue.length === 8) queue.shift();
      queue.push(frame);
    }
  }

  next(seat: Seat) {
    return this.queued[seat].shift() ?? this.held[seat];
  }

  release() {
    this.keys.clear();
    for (const button of this.touches.values()) button.dataset.held = 'false';
    this.touches.clear();
    this.queued = [[], []];
    this.held = [0, 0];
  }
}
