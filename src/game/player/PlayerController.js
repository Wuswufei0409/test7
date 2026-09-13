/**
 * PlayerController — bridges DOM input to the Player + PlayerPhysics.
 *
 * Implements the pointer-lock mouse look and the WASD / Space / Shift /
 * Ctrl keyboard scheme, translating raw input into an `input` object the
 * physics consumes. Headless-friendly: `readState()` produces the same input
 * the browser listeners would, so automated tests can drive it without a DOM.
 */

export const KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  sneak: ['ControlLeft', 'ControlRight'],
};

export class PlayerController {
  constructor(player, physics, opts = {}) {
    this.player = player;
    this.physics = physics;
    this.pointerLocked = false;
    this.sensitivity = opts.sensitivity ?? 0.0025; // rad per pixel
    this.keys = new Set(); // raw key codes currently held
    this.lastDt = 0;
  }

  // ----- pointer lock -----
  requestPointerLock(doc, canvas) {
    if (!doc || !canvas) return false;
    try {
      const root = canvas.requestPointerLock
        || canvas.webkitRequestPointerLock;
      if (root) root.call(canvas);
      return true;
    } catch {
      return false;
    }
  }

  onPointerLockChange(doc) {
    this.pointerLocked = !!doc?.pointerLockElement;
  }

  onMouseMove(dx, dy) {
    if (!this.pointerLocked) return;
    this.player.yaw -= dx * this.sensitivity;
    this.player.pitch += dy * this.sensitivity;
    // clamp pitch to avoid flipping
    const lim = Math.PI / 2 - 1e-3;
    this.player.pitch = Math.max(-lim, Math.min(lim, this.player.pitch));
  }

  onKeyDown(code) {
    this.keys.add(code);
  }
  onKeyUp(code) {
    this.keys.delete(code);
  }
  press(code) {
    this.keys.add(code);
  }
  release(code) {
    this.keys.delete(code);
  }

  // ----- headless-friendly input synthesis -----
  readState() {
    const held = (codes) => codes.some((c) => this.keys.has(c));
    // z: +1 forward, -1 back ; x: +1 left, -1 right
    let z = 0;
    if (held(KEYS.forward)) z += 1;
    if (held(KEYS.back)) z -= 1;
    let x = 0;
    if (held(KEYS.left)) x += 1;
    if (held(KEYS.right)) x -= 1;
    return {
      x,
      z,
      jump: held(KEYS.jump),
      sprint: held(KEYS.sprint),
      sneak: held(KEYS.sneak),
    };
  }

  /** Advance sim one frame using current held keys. */
  update(dt = this.lastDt || 1 / 60) {
    this.lastDt = dt;
    const input = this.readState();
    this.physics.step(dt, input);
    this.player.moving = input.x !== 0 || input.z !== 0;
    return this.player;
  }

  // ----- browser wiring (optional; used by demo) -----
  attach(canvas, doc = window?.document, opt = {}) {
    const onLockChange = () => this.onPointerLockChange(doc);
    const onMouseMove = (ev) => this.onMouseMove(
      ev.movementX ?? ev.webkitMovementX ?? 0,
      ev.movementY ?? ev.webkitMovementY ?? 0);
    const onKeyDown = (ev) => this.onKeyDown(ev.code);
    const onKeyUp = (ev) => this.onKeyUp(ev.code);
    doc.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    this._handlers = { onLockChange, onMouseMove, onKeyDown, onKeyUp };
    if (opt.autoLock) {
      canvas.addEventListener('click', () => this.requestPointerLock(doc, canvas));
    }
    return () => this.detach();
  }

  detach(doc = window?.document) {
    if (!this._handlers) return;
    const { onLockChange, onMouseMove, onKeyDown, onKeyUp } = this._handlers;
    doc?.removeEventListener('pointerlockchange', onLockChange);
    document?.removeEventListener('mousemove', onMouseMove);
    document?.removeEventListener('keydown', onKeyDown);
    document?.removeEventListener('keyup', onKeyUp);
    this._handlers = null;
  }
}
