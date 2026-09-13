/**
 * FirstPersonCamera.js
 * R1 (MUL-34) — Minimal first-person camera rig.
 *
 * Provides pointer-lock mouse-look and an eye-height camera at a spawn
 * position. Full movement (WASD/jump/sprint/crouch/swim/physics/collision) is
 * the R3 (player control) issue and will drive `camera.position` directly;
 * this module stays the single owner of the camera object and mouse look so R3
 * can extend without touching the renderer.
 */

import * as THREE from 'three';

const EYE_HEIGHT = 1.62; // near Bedrock eye height
const SENSITIVITY = 0.0021;

export class FirstPersonCamera {
  constructor(camera, domElement) {
    this.camera = camera;
    this.dom = domElement;
    this.yaw = 0;
    this.pitch = 0;
    this.locked = false;

    this.spawnX = 8.5;
    this.spawnY = 60;
    this.spawnZ = 8.5;

    this._onMouseMove = this._onMouseMove.bind(this);
    this._onLockChange = this._onLockChange.bind(this);
    document.addEventListener('pointerlockchange', this._onLockChange);
    document.addEventListener('mousemove', this._onMouseMove);
    this.dom.addEventListener('mousedown', () => {
      if (!this.locked && document.pointerLockElement !== this.dom) {
        this.dom.requestPointerLock && this.dom.requestPointerLock();
      }
    });
  }

  _onLockChange() {
    this.locked = document.pointerLockElement === this.dom;
  }

  _onMouseMove(e) {
    if (!this.locked) return;
    this.yaw -= e.movementX * SENSITIVITY;
    this.pitch -= e.movementY * SENSITIVITY;
    const lim = Math.PI / 2 - 0.01;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  spawn() {
    this.camera.position.set(this.spawnX, this.spawnY, this.spawnZ);
    this.yaw = Math.PI * 0.25; // look toward interesting terrain
    this.pitch = -0.35;
  }

  update(dt) {
    // Pure look (yaw->Yaw, pitch->Pitch) via euler order 'YXZ'.
    const e = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(e);
  }
}
